import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as otpGenerator from 'otp-generator';
import * as bcrypt from 'bcrypt';

import { ExpedienteEntity } from '../../Academico/Entities/ExpedienteEntity.js';
import { SolicitarPrestamoDTO } from '../DTOs/SolicitarPrestamoDTO.js';
import { PrestamoEntity } from '../Entities/PrestamoEntity.js';
import { EntregarExpedienteDTO } from '../DTOs/EntregarExpedienteDTO.js';
import { DevolverExpedienteDTO } from '../DTOs/DevolverExpedienteDTO.js';

@Injectable()
export class PrestamoService {
  // Inyectamos el DataSource global para tener control manual de las Transacciones
  constructor(private dataSource: DataSource) {}

  async solicitarPrestamo(dto: SolicitarPrestamoDTO, idUsuarioSolicitante: string) {
    // 1. Iniciamos el QueryRunner para transacciones seguras (ACID)
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. BLOQUEO PESIMISTA (Pessimistic Write)
      // Bloqueamos la fila del expediente en PostgreSQL. Si alguien más intenta 
      // pedir este mismo expediente ahora mismo, la base de datos lo pondrá en espera.
      const expediente = await queryRunner.manager.findOne(ExpedienteEntity, {
        where: { idExpediente: dto.idExpediente },
        lock: { mode: 'pessimistic_write' },
      });

      if (!expediente) {
        throw new NotFoundException('El expediente físico no existe en el acervo.');
      }

      // 3. VALIDACIÓN DE ESTADOS (Evitar Cuellos de Botella)
      // Buscamos si hay un préstamo activo (ej. estatus 1 = Solicitado, 4 = En Custodia)
      const prestamoActivo = await queryRunner.manager.findOne(PrestamoEntity, {
        where: [
          { expediente: { idExpediente: dto.idExpediente }, estatusPrestamo: { idEstatusPrestamo: 1 } },
          { expediente: { idExpediente: dto.idExpediente }, estatusPrestamo: { idEstatusPrestamo: 4 } }
        ]
      });

      if (prestamoActivo) {
        throw new ConflictException('Operación denegada. El expediente ya se encuentra solicitado o en custodia física.');
      }

      // 4. SEGURIDAD ZERO-TRUST (Generación de OTP)
      // Generamos un código único de 6 dígitos numéricos
      const otpPlano = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });
      
      // Hasheamos el código por seguridad militar
      const salt = await bcrypt.genSalt(10);
      const otpHashed = await bcrypt.hash(otpPlano, salt);

      // Calculamos la expiración del OTP (Tiene 24 horas para ir a recoger la carpeta)
      const fechaExpiracionOtp = new Date();
      fechaExpiracionOtp.setHours(fechaExpiracionOtp.getHours() + 24);

      // 5. GENERACIÓN DEL FOLIO ÚNICO
      const folioPrestamo = `PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 6. GUARDAR LA TRANSACCIÓN
      const nuevoPrestamo = queryRunner.manager.create(PrestamoEntity, {
        folio: folioPrestamo,
        expediente: { idExpediente: dto.idExpediente },
        usuarioSolicitante: { idUsuario: idUsuarioSolicitante },
        motivo: { idMotivo: dto.idMotivo },
        estatusPrestamo: { idEstatusPrestamo: 1 }, // 1 = "SOLICITADO"
        observacionesSalida: dto.observacionesSalida,
        otpHashed: otpHashed,
        otpExpiracion: fechaExpiracionOtp
      });

      await queryRunner.manager.save(nuevoPrestamo);

      // 7. COMMIT: Soltamos el bloqueo en PostgreSQL
      await queryRunner.commitTransaction();

      // OJO: Retornamos el OTP Plano SOLO ESTA VEZ para que Angular se lo muestre en un Modal al usuario
      return {
        folio: folioPrestamo,
        mensaje: 'Solicitud aprobada preliminarmente.',
        otp: otpPlano,
        expira: fechaExpiracionOtp
      };

    } catch (err) {
      // ROLLBACK: Si algo falla (un constraint de DB, etc.), deshacemos todo
      await queryRunner.rollbackTransaction();
      
      // Re-lanzamos excepciones controladas (Conflict/NotFound) para que NestJS dé el HTTP 404 o 409
      if (err instanceof ConflictException || err instanceof NotFoundException) throw err;
      
      throw new InternalServerErrorException('Fallo catastrófico al procesar el préstamo físico.');
    } finally {
      // Siempre liberamos el QueryRunner para no agotar el Pool de Conexiones
      await queryRunner.release();
    }
  }

  async entregarExpedienteFisico(dto: EntregarExpedienteDTO, idUsuarioAutoriza: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. SOLUCIÓN ENTERPRISE: Reemplazamos el findOne por el QueryBuilder
      // Forzamos el INNER JOIN para que PostgreSQL acepte el bloqueo pesimista
      const prestamo = await queryRunner.manager.createQueryBuilder(PrestamoEntity, 'prestamo')
        .innerJoinAndSelect('prestamo.estatusPrestamo', 'estatusPrestamo')
        .where('prestamo.folio = :folio', { folio: dto.folio })
        .setLock('pessimistic_write')
        .getOne();

      if (!prestamo) {
        throw new NotFoundException(`El folio ${dto.folio} no existe en el registro histórico.`);
      }

      // 2. Validación de la Máquina de Estados (Solo se entregan los SOLICITADOS = 1)
      if (prestamo.estatusPrestamo.idEstatusPrestamo !== 1) {
        throw new ConflictException('Operación denegada. El expediente no se encuentra en estado SOLICITADO.');
      }

      // 3. Validación de SLA (Tiempo de Vida)
      if (new Date() > prestamo.otpExpiracion!) {
        throw new UnauthorizedException('El código OTP ha expirado. El solicitante debe generar un nuevo préstamo.');
      }

      // 4. VERIFICACIÓN CRIPTOGRÁFICA (Zero-Trust)
      const otpValido = await bcrypt.compare(dto.otp, prestamo.otpHashed as string);
      if (!otpValido) {
        throw new UnauthorizedException('Firma criptográfica inválida. El código OTP dictado es incorrecto.');
      }

      // 5. Transición de Estado y Sellado
      // Cambiamos a estado 4 = EN CUSTODIA
      prestamo.estatusPrestamo = { idEstatusPrestamo: 4 } as any; 
      // Firmamos con el UUID del archivista que entrega (quien disparó el endpoint)
      prestamo.usuarioAutoriza = { idUsuario: idUsuarioAutoriza } as any; 
      // Sellamos la hora exacta
      prestamo.fechaSalida = new Date(); 
      
      // DESTRUCCIÓN DEL TOKEN (Seguridad Militar)
      prestamo.otpHashed = null as any;
      prestamo.otpExpiracion = null as any;

      await queryRunner.manager.save(prestamo);
      await queryRunner.commitTransaction();

      return {
        mensaje: 'Validación biométrica exitosa. El expediente ha sido liberado físicamente.',
        folio: prestamo.folio,
        fechaSalida: prestamo.fechaSalida,
        estadoActual: 'EN CUSTODIA'
      };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      
      // Consola de diagnóstico para el desarrollador
      console.error('🔥 ERROR REAL EN BASE DE DATOS (ENTREGA):', err);

      if (err instanceof ConflictException || err instanceof NotFoundException || err instanceof UnauthorizedException) {
        throw err;
      }
      throw new InternalServerErrorException('Fallo crítico al validar la entrega del expediente físico.');
    } finally {
      await queryRunner.release();
    }
  }

  async regenerarOtp(folio: string, idUsuarioSolicitante: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. SOLUCIÓN ENTERPRISE: Usamos QueryBuilder y obligamos un INNER JOIN 
      // para que PostgreSQL acepte el Bloqueo Pesimista (FOR UPDATE)
      const prestamo = await queryRunner.manager.createQueryBuilder(PrestamoEntity, 'prestamo')
        .innerJoinAndSelect('prestamo.estatusPrestamo', 'estatusPrestamo')
        .innerJoin('prestamo.usuarioSolicitante', 'usuarioSolicitante')
        .where('prestamo.folio = :folio', { folio })
        .andWhere('usuarioSolicitante.idUsuario = :idUsuario', { idUsuario: idUsuarioSolicitante })
        .setLock('pessimistic_write')
        .getOne();

      if (!prestamo) {
        throw new NotFoundException(`No se encontró un préstamo activo con el folio ${folio} a tu nombre.`);
      }

      // 2. Solo podemos regenerar si sigue en estado "SOLICITADO" (1)
      if (prestamo.estatusPrestamo.idEstatusPrestamo !== 1) {
        throw new ConflictException('Operación denegada. Solo se puede regenerar el OTP de expedientes no entregados.');
      }

      // 3. Generación del nuevo OTP y encriptación
      const nuevoOtpPlano = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });
      const salt = await bcrypt.genSalt(10);
      const nuevoOtpHashed = await bcrypt.hash(nuevoOtpPlano, salt);

      // 4. Reiniciamos el reloj (24 horas más)
      const nuevaExpiracion = new Date();
      nuevaExpiracion.setHours(nuevaExpiracion.getHours() + 24);

      prestamo.otpHashed = nuevoOtpHashed;
      prestamo.otpExpiracion = nuevaExpiracion;

      await queryRunner.manager.save(prestamo);
      await queryRunner.commitTransaction();

      // Devolvemos el nuevo OTP
      return {
        mensaje: 'Clave OTP regenerada exitosamente.',
        folio: prestamo.folio,
        nuevoOtp: nuevoOtpPlano,
        expira: nuevaExpiracion
      };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      
      // ¡REGLA DE ORO!: Imprimir el error original en la consola del backend
      console.error('🔥 ERROR REAL EN BASE DE DATOS:', err);
      
      if (err instanceof ConflictException || err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Fallo catastrófico al regenerar la firma criptográfica.');
    } finally {
      await queryRunner.release();
    }
  }

  async devolverExpedienteFisico(dto: DevolverExpedienteDTO, idUsuarioRecibe: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. BLOQUEO PESIMISTA CON QUERY BUILDER
      // Buscamos el préstamo y bloqueamos el registro para evitar concurrencia
      const prestamo = await queryRunner.manager.createQueryBuilder(PrestamoEntity, 'prestamo')
        .innerJoinAndSelect('prestamo.estatusPrestamo', 'estatusPrestamo')
        .where('prestamo.folio = :folio', { folio: dto.folio })
        .setLock('pessimistic_write')
        .getOne();

      if (!prestamo) {
        throw new NotFoundException(`El folio ${dto.folio} no existe en el sistema.`);
      }

      // 2. VALIDACIÓN ESTRICTA DE LA MÁQUINA DE ESTADOS
      // Solo podemos recibir expedientes que físicamente estén afuera (Estado 4 = EN CUSTODIA)
      if (prestamo.estatusPrestamo.idEstatusPrestamo !== 4) {
        throw new ConflictException('Operación inconsistente. El expediente no se encuentra actualmente EN CUSTODIA.');
      }

      // 3. AUDITORÍA FORENSE Y TRANSICIÓN DE ESTADO
      // Pasamos el estatus a 5 = DEVUELTO
      prestamo.estatusPrestamo = { idEstatusPrestamo: 5, nombre: 'DEVUELTO' };
      
      // Registramos en qué estado físico regresó la carpeta (Bueno, Deteriorado, etc.)
      prestamo.estadoConservacionRetorno = { idEstado: dto.idEstadoConservacionRetorno, nombre: 'DEVUELTO' };
      
      // Si el archivista anotó que viene dañado, guardamos el porqué
      if (dto.observacionesRetorno) {
        prestamo.observacionesRetorno = dto.observacionesRetorno;
      }

      // Sellamos la fecha y hora exacta en la que la carpeta cruzó de vuelta la puerta del archivo
      // Nota: Asumo que en tu entidad tienes un campo como 'fechaDevolucion' o 'fechaRetorno'
      prestamo.fechaRetorno = new Date(); 

      // 4. PERSISTENCIA
      await queryRunner.manager.save(prestamo);
      await queryRunner.commitTransaction();

      return {
        mensaje: 'Check-in exitoso. El expediente ha regresado a la bóveda del Archivo Histórico.',
        folio: prestamo.folio,
        fechaRetorno: prestamo.fechaRetorno,
        estadoActual: 'DEVUELTO'
      };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      
      // Consola de diagnóstico para el equipo de desarrollo
      console.error('🔥 ERROR REAL EN BASE DE DATOS (DEVOLUCIÓN):', err);

      if (err instanceof ConflictException || err instanceof NotFoundException) {
        throw err;
      }
      throw new InternalServerErrorException('Fallo crítico al procesar el reingreso del expediente físico.');
    } finally {
      // Liberamos el candado de la base de datos
      await queryRunner.release();
    }
  }

  async obtenerMisPrestamosActivos(idUsuarioSolicitante: string) {
  return await this.dataSource
    .getRepository(PrestamoEntity)
    .createQueryBuilder('prestamo')
    .innerJoinAndSelect('prestamo.expediente', 'expediente')
    .leftJoinAndSelect('expediente.persona', 'persona')
    .leftJoinAndSelect('expediente.carrera', 'carrera')
    .innerJoinAndSelect('prestamo.estatusPrestamo', 'estatus')
    .leftJoinAndSelect('prestamo.motivo', 'motivo')
    .where('prestamo.usuarioSolicitante.idUsuario = :idUsuario', { idUsuario: idUsuarioSolicitante })
    .andWhere('estatus.idEstatusPrestamo IN (:...estados)', { estados: [1, 4] }) // 1 = SOLICITADO, 4 = EN CUSTODIA
    .andWhere('prestamo.fechaBaja IS NULL')
    .orderBy('prestamo.fechaCreacion', 'DESC')
    .getMany();
}

  async obtenerDocumentosPorControl(numeroControl: string) {
    // Retornamos el expediente y hacemos un INNER JOIN a sus archivos digitales
    return await this.dataSource.getRepository(ExpedienteEntity).createQueryBuilder('exp')
      .leftJoinAndSelect('exp.archivosDigitales', 'archivos') // Asegúrate que la relación en ExpedienteEntity se llame archivosDigitales
      .leftJoinAndSelect('archivos.catalogoTipoArchivo', 'tipoArchivo') // Para saber si es Acta, Kardex, etc.
      .leftJoinAndSelect('archivos.usuarioSubio', 'admin') // Para auditoría
      .where('exp.folio = :numeroControl', { numeroControl }) // Ajusta "folio" a "numero_control" si es necesario
      .select([
        'exp.idExpediente',
        'exp.num_control',
        'archivos.idArchivo',
        'archivos.nombreOriginal',
        'archivos.urlArchivo', // ¡La URL mágica de nuestro Visor!
        'archivos.pesoBytes',
        'archivos.fechaCreacion',
        'tipoArchivo.nombre', // Traemos el nombre legible del catálogo
        'admin.email' // Traemos el correo del administrador que lo subió
      ])
      .getOne();
  }

  // En tu PrestamoService.ts

  async obtenerDocumentosPorControl_Op(numeroControl: string) {
    // PASO 1: LA SUBCONSULTA OCULTA
    const expedienteRaiz = await this.dataSource.getRepository(ExpedienteEntity).findOne({
      where: { numControl: numeroControl },
      // ¡AQUÍ ESTÁ EL CAMBIO! Usamos la sintaxis de objeto:
      select: {
        idExpediente: true,
        numControl: true
      }
    });

    if (!expedienteRaiz) {
      return null; 
    }

    // PASO 2: LA EXTRACCIÓN PROFUNDA (Enfoque Top-Down desde Expediente)
    const expedienteConDocumentos = await this.dataSource.getRepository(ExpedienteEntity)
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.archivosDigitales', 'archivos')
      .leftJoinAndSelect('archivos.tipoArchivo', 'tipoArchivo')
      .leftJoinAndSelect('archivos.usuarioSubio', 'admin')
      .where('exp.idExpediente = :idExpediente', { idExpediente: expedienteRaiz.idExpediente })
      .select([
        'exp.idExpediente', 
        'exp.numControl',
        'archivos.idArchivo',
        'archivos.nombreOriginal',
        'archivos.rutaLocal', // ⚠️ CAMBIO CRÍTICO: Pedimos la ruta que SÍ existe en tu BD
        'archivos.pesoBytes',
        'archivos.fechaCreacion',
        'tipoArchivo.nombre', 
        'admin.email'
      ])
      .getOne();

    // PASO 3: ENSAMBLAJE DE LA RESPUESTA CON EL VISOR MÁGICO
    const archivosCrudos = expedienteConDocumentos?.archivosDigitales || [];
    
    // Mapeamos los resultados para inyectarles la URL del proxy seguro sin tocar la BD
    const listaDocumentos = archivosCrudos.map(archivo => ({
      ...archivo,
      // Construimos el enlace para que Angular solo tenga que ponerlo en un <a href="...">
      urlVisor: `/api/v3/archivo-fisico/visor/${expedienteRaiz.idExpediente}/${archivo.nombreOriginal}`
    }));

    return {
      expediente: {
        idInterno: expedienteRaiz.idExpediente,
        numeroControl: expedienteRaiz.numControl
      },
      totalDocumentos: listaDocumentos.length,
      documentos: listaDocumentos
    };
  }
}