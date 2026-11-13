import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EstadoTitulacion, validarTransicionFSM } from '../Constant/FSM_Titulacion.js';
import { ExpedienteEntity } from '../Entities/ExpedienteEntity.js';
import { FirmaSinodalEntity } from '../Entities/FirmaSinodalEntity.js';
import { TramiteTitulacionEntity } from '../Entities/TramiteTitulacionEntity.js';
import { CatalogoSinodalEntity } from '../Entities/CatalogoSinodalEntity.js';
import { PrestamoEntity } from '../../ArchivoFisico/Entities/PrestamoEntity.js';

// Importa tu servicio de auditoría aquí o despacha los eventos a BullMQ

@Injectable()
export class TitulacionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) {}

  // =======================================================
  // 1. GATEKEEPER, CREACIÓN DE TRÁMITE Y PRÉSTAMO AUTOMÁTICO (ACID)
  // =======================================================
  async iniciarTramiteTitulacion(
    numeroControl: string,
    idUsuarioSolicitante: string,
    ipOrigen: string
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const matriculaLimpia = numeroControl.trim().toUpperCase();

      const expedienteLock = await queryRunner.manager
        .createQueryBuilder(ExpedienteEntity, 'exp')
        .select('exp.idExpediente')
        .where('UPPER(exp.numControl) = :matriculaLimpia', { matriculaLimpia })
        .andWhere('exp.fechaBaja IS NULL')
        .setLock('pessimistic_write')
        .getOne();

      if (!expedienteLock) {
        throw new NotFoundException('Expediente no localizado en el acervo.');
      }

      // 2. FASE DE EXTRACCIÓN PROFUNDA (La fila ya está protegida por la transacción)
      const expediente = await queryRunner.manager
        .createQueryBuilder(ExpedienteEntity, 'exp')
        .leftJoinAndSelect('exp.titulacion', 'reqs')
        .leftJoinAndSelect('exp.estatus', 'estatusExp')
        .leftJoinAndSelect('exp.prestamos', 'prestamos', 'prestamos.fechaRetorno IS NULL')
        .where('exp.idExpediente = :id', { id: expedienteLock.idExpediente })
        .getOne();

      if (!expediente) {
        throw new NotFoundException('Expediente no localizado en el acervo.');
      }

      // 1. Verificamos si tiene un préstamo activo de otro operador en Ventanilla
      const prestamoActivoPrevio = (expediente.prestamos || []).find(
        (p: any) => !p.fechaRetorno
      );

      if (prestamoActivoPrevio) {
        throw new ConflictException(
          `Bloqueo de Custodia Física: El expediente ${matriculaLimpia} tiene el préstamo activo ${prestamoActivoPrevio.folio}. Debe liberarse o devolverse antes de iniciar Titulación.`
        );
      }

      // 2. Validación de créditos obligatorios
      const reqs = expediente.titulacion;
      if (!reqs || !reqs.inglesB1 || !reqs.servicioSocial || !reqs.residenciaProfesional) {
        throw new ConflictException(
          'Bloqueo Operativo: El egresado no ha liberado los créditos obligatorios (Inglés B1, Servicio Social y Residencia).'
        );
      }

      // 3. Verificamos que no tenga otro trámite de titulación abierto
      const tramitePrevio = await queryRunner.manager.findOne(TramiteTitulacionEntity, {
        where: { expediente: { idExpediente: expediente.idExpediente } },
        order: { fechaCreacion: 'DESC' }
      });

      if (tramitePrevio && tramitePrevio.estatusActual !== EstadoTitulacion.FINALIZADO_ENTREGADO) {
        throw new ConflictException(
          'Inconsistencia: Ya existe una instancia de titulación activa para esta matrícula.'
        );
      }

      // 4. Creamos la instancia en el Grafo de Titulación (FSM)
      const folioTramite = `TIT_${matriculaLimpia}_${Date.now()}`;
      const nuevoTramite = queryRunner.manager.create(TramiteTitulacionEntity, {
        folio: folioTramite,
        expediente: { idExpediente: expediente.idExpediente },
        usuarioSolicitante: { idUsuario: idUsuarioSolicitante },
        estatusActual: EstadoTitulacion.PASO_1_REGISTRO,
        progresoPorcentaje: 12.5,
        documentosValidados: false,
      });

      const tramiteGuardado = await queryRunner.manager.save(nuevoTramite);

      // 5. ASIGNACIÓN AUTOMÁTICA EN LA TABLA DE PRÉSTAMOS AL USUARIO DE TITULACIÓN
      // Se registra directamente en estatus 4 (EN CUSTODIA) y motivo 2 (Trámite de Titulación)
      const folioPrestamoAuto = `PR-TIT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const prestamoTitulacion = queryRunner.manager.create(PrestamoEntity, {
        folio: folioPrestamoAuto,
        expediente: { idExpediente: expediente.idExpediente },
        usuarioSolicitante: { idUsuario: idUsuarioSolicitante },
        usuarioAutoriza: { idUsuario: idUsuarioSolicitante },
        motivo: { idMotivo: 2 }, // 2 = Trámite de Titulación
        estatusPrestamo: { idEstatusPrestamo: 4 }, // 4 = EN CUSTODIA ACTIVA
        fechaSalida: new Date(),
        observacionesSalida: `Custodia asignada automáticamente por apertura de Trámite de Titulación (${folioTramite}). Puede liberarse momentáneamente si Ventanilla requiere el expediente físico.`,
        otpHashed: null,
        otpExpiracion: null,
      });

      await queryRunner.manager.save(PrestamoEntity, prestamoTitulacion);

      // Guardamos la referencia del folio de préstamo dentro de los metadatos del trámite
      tramiteGuardado.pagosConciliados = {
        folioPrestamoAutomatico: folioPrestamoAuto,
        custodiaFisicaEnTitulacion: true,
        ipApertura: ipOrigen
      };
      await queryRunner.manager.save(TramiteTitulacionEntity, tramiteGuardado);

      await queryRunner.commitTransaction();
      return tramiteGuardado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Fallo crítico al inicializar el Trámite de Titulación y su custodia física.'
      );
    } finally {
      await queryRunner.release();
    }
  }

  // =======================================================
  // 2. SMART CONTRACT: ACTA DE EXAMEN PROFESIONAL MULTI-FIRMA
  // =======================================================
  async firmarActaExamenSinodal(
    idTramite: string,
    rolSinodal: 'PRESIDENTE' | 'SECRETARIO' | 'VOCAL',
    pinFirmaPlano: string,
    identificadorSinodal: string,
    nombreSinodal: string,
    ipOrigen: string
  ) {
    let quorumCompletado = false;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. RESOLUCIÓN HÍBRIDA DEL SINODAL (Soporta UUID o Nombre)
      const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identificadorSinodal);
      
      const sinodalOficial = await queryRunner.manager.findOne(CatalogoSinodalEntity, {
        where: esUuid ? { idSinodal: identificadorSinodal } : { nombreCompleto: identificadorSinodal }
      });

      if (!sinodalOficial) {
        throw new NotFoundException(`No se localizó en el catálogo oficial al sinodal: ${identificadorSinodal}`);
      }

      // 2. FASE DE BLOQUEO ACID (Sin Joins)
      const tramiteLock = await queryRunner.manager.createQueryBuilder(TramiteTitulacionEntity, 'tramite')
        .select('tramite.idTramite')
        .where('tramite.idTramite = :idTramite', { idTramite })
        .setLock('pessimistic_write')
        .getOne();

      if (!tramiteLock) throw new NotFoundException('Instancia de titulación no encontrada.');

      // 3. FASE DE EXTRACCIÓN (Ya protegida)
      const tramite = await queryRunner.manager.createQueryBuilder(TramiteTitulacionEntity, 'tramite')
        .leftJoinAndSelect('tramite.firmasSinodo', 'firmas')
        .leftJoinAndSelect('firmas.sinodal', 'sinodal') // Traemos los maestros que ya firmaron
        .where('tramite.idTramite = :id', { id: tramiteLock.idTramite })
        .getOne();

      if (tramite?.estatusActual !== EstadoTitulacion.PASO_7_FIRMAS_ACTA) {
        throw new ConflictException('El trámite no se encuentra en fase de validación sinodal.');
      }

      const firmasActuales = tramite.firmasSinodo || [];

      // 4. VERIFICACIÓN DE IDENTIDAD Y USURPACIÓN (Usando idSinodal)
      if (firmasActuales.some(f => f.rolSinodal === rolSinodal)) {
        throw new ConflictException(`Fallo de Consenso: El rol de ${rolSinodal} ya fue firmado en esta acta.`);
      }
      if (firmasActuales.some(f => f.sinodal?.idSinodal === sinodalOficial.idSinodal)) {
        throw new ConflictException('Violación de Smart Contract: Un sínodo no puede firmar dos roles distintos en la misma acta.');
      }

      // 5. SELLO CRIPTOGRÁFICO Y PERSISTENCIA
      const masterSecret = this.configService.get<string>('SIGAH_CRYPTO_SECRET', 'DEFAULT_SALT_SECURE');
      const selloCriptografico = crypto
        .createHash('sha256')
        .update(`${tramite.idTramite}|${sinodalOficial.idSinodal}|${pinFirmaPlano}|${masterSecret}`)
        .digest('hex');

      const nuevaFirma = queryRunner.manager.create(FirmaSinodalEntity, {
        tramite: { idTramite: tramite.idTramite },
        sinodal: { idSinodal: sinodalOficial.idSinodal }, // <-- Inyectamos el ID resuelto
        rolSinodal: rolSinodal,
        selloCriptografico: selloCriptografico,
        ipOrigen: ipOrigen
      });

      await queryRunner.manager.save(nuevaFirma);
      firmasActuales.push(nuevaFirma);

      // 6. QUÓRUM DE FIRMAS
      if (firmasActuales.length === 3) {
        quorumCompletado = true;
        validarTransicionFSM(tramite.estatusActual as EstadoTitulacion, EstadoTitulacion.PASO_8_TRAMITE_SEP);
        tramite.estatusActual = EstadoTitulacion.PASO_8_TRAMITE_SEP;
        tramite.progresoPorcentaje = 87.5;
      }

      await queryRunner.manager.save(tramite);
      await queryRunner.commitTransaction();

      return { quorumCompletado, selloEmitido: selloCriptografico };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Fallo durante la evaluación criptográfica del acta de examen.');
    } finally {
      await queryRunner.release();
    }
  }

  // =======================================================
  // 3. CONSULTA GENERAL DE TRÁMITES Y CHECKLIST (PARA DASHBOARD)
  // =======================================================
  async listarTramitesTitulacion() {
    return await this.dataSource
      .getRepository(TramiteTitulacionEntity)
      .createQueryBuilder('tramite')
      .leftJoinAndSelect('tramite.expediente', 'exp')
      .leftJoinAndSelect('exp.persona', 'persona')
      .leftJoinAndSelect('exp.carrera', 'carrera')
      .leftJoinAndSelect('exp.estatus', 'estatusExp')
      .leftJoinAndSelect('exp.titulacion', 'reqs')
      .leftJoinAndSelect('tramite.firmasSinodo', 'firmas')
      .leftJoinAndSelect('firmas.sinodal', 'sinodal')
      .orderBy('tramite.fechaActualizacion', 'DESC')
      .getMany();
  }

  // =======================================================
  // 4. FASE 1: AUDITORÍA DE REQUISITOS Y ANTI-INVASIÓN DE CICLOS
  // =======================================================
  async actualizarChecklistRequisitos(
    numeroControl: string,
    dto: {
      tieneActaNacimiento?: boolean;
      tieneCertificadoPrepa?: boolean;
      tieneCertificadoLicenciatura?: boolean;
      inglesB1?: boolean;
      servicioSocial?: boolean;
      residenciaProfesional?: boolean;
      actividadesComplementarias?: boolean;
      fechaTerminoPrepa?: string;
      fechaIngresoItd?: string;
      noAdeudoLaboratorios?: boolean;
      noAdeudoBiblioteca?: boolean;
      noAdeudoFinanzas?: boolean;
    }
  ) {
    // Validación Legal Anti-Invasión de Ciclos
    if (dto.fechaTerminoPrepa && dto.fechaIngresoItd) {
      const finPrepa = new Date(dto.fechaTerminoPrepa).getTime();
      const inicioItd = new Date(dto.fechaIngresoItd).getTime();
      if (finPrepa >= inicioItd) {
        throw new ConflictException(
          'Bloqueo Normativo (Invasión de Ciclos): La fecha de terminación del bachillerato debe ser estrictamente anterior al ingreso al Instituto Tecnológico.'
        );
      }
    }

    const expedienteRepo = this.dataSource.getRepository(ExpedienteEntity);
    const expediente = await expedienteRepo.findOne({
      where: { numControl: numeroControl },
      relations: {titulacion:true}
    });

    if (!expediente) {
      throw new NotFoundException(`No se localizó el expediente con matrícula ${numeroControl}.`);
    }

    const reqs = expediente.titulacion || ({} as any);
    if (dto.tieneActaNacimiento !== undefined) reqs.tieneActaNacimiento = dto.tieneActaNacimiento;
    if (dto.tieneCertificadoPrepa !== undefined) reqs.tieneCertificadoPrepa = dto.tieneCertificadoPrepa;
    if (dto.tieneCertificadoLicenciatura !== undefined) reqs.tieneCertificadoLicenciatura = dto.tieneCertificadoLicenciatura;
    if (dto.inglesB1 !== undefined) reqs.inglesB1 = dto.inglesB1;
    if (dto.servicioSocial !== undefined) reqs.servicioSocial = dto.servicioSocial;
    if (dto.residenciaProfesional !== undefined) reqs.residenciaProfesional = dto.residenciaProfesional;
    if (dto.actividadesComplementarias !== undefined) reqs.actividadesComplementarias = dto.actividadesComplementarias;

    expediente.titulacion = reqs;
    await expedienteRepo.save(expediente);

    return {
      numControl: expediente.numControl,
      requisitosActualizados: expediente.titulacion
    };
  }

  // =======================================================
  // 5. AVANCE DE LA MÁQUINA DE ESTADOS FINITA (DAG FSM)
  // =======================================================
  async avanzarEstadoTramiteFSM(
    idTramite: string,
    estadoDestino: EstadoTitulacion,
    metadatosFase?: Record<string, any>
  ) {
    const tramiteRepo = this.dataSource.getRepository(TramiteTitulacionEntity);
    const tramite = await tramiteRepo.findOne({
      where: { idTramite },
      relations: {expediente:true,firmasSinodo:true}
    });

    if (!tramite) {
      throw new NotFoundException('Trámite de titulación no localizado.');
    }

    // 1. Validamos matemáticamente en el Grafo Dirigido Acíclico (FSM_Titulacion.ts)
    validarTransicionFSM(tramite.estatusActual as EstadoTitulacion, estadoDestino);

    // 2. Mapa de porcentaje oficial según el estado de los 8 pasos
    const mapaProgreso: Record<EstadoTitulacion, number> = {
      [EstadoTitulacion.PASO_1_REGISTRO]: 12.5,
      [EstadoTitulacion.PASO_3_TRIAGE_DOCS]: 25.0,
      [EstadoTitulacion.PASO_4_PAGO_EXAMEN]: 37.5,
      [EstadoTitulacion.PASO_5_CARTA_NO_INCONVENIENCIA]: 50.0,
      [EstadoTitulacion.PASO_6_EXAMEN_PROGRAMADO]: 62.5,
      [EstadoTitulacion.PASO_7_FIRMAS_ACTA]: 75.0,
      [EstadoTitulacion.PASO_8_TRAMITE_SEP]: 87.5,
      [EstadoTitulacion.FINALIZADO_ENTREGADO]: 100.0
    };

    tramite.estatusActual = estadoDestino;
    tramite.progresoPorcentaje = mapaProgreso[estadoDestino] ?? tramite.progresoPorcentaje;

    if (estadoDestino === EstadoTitulacion.PASO_4_PAGO_EXAMEN) {
      tramite.documentosValidados = true;
    }

    // Guardamos metadatos de Fase 2 (Modalidad, TecNM-AC-PO-006-04/01/02, Mención Honorífica)
    // y Fase 3 (Jurado Sinodal, Fecha/Hora Acto Protocolario, Libro y Foja de Actas)
    if (metadatosFase) {
      tramite.pagosConciliados = {
        ...(tramite.pagosConciliados || {}),
        ...metadatosFase,
        ultimaActualizacionFase: new Date().toISOString()
      };
    }

    return await tramiteRepo.save(tramite);
  }

  async validarCurpConVerificamexProxy(dto: {
    numControl: string;
    curp: string;
    usarApiReal?: boolean;
    apiKeyTemporal?: string;
  }) {
    const numControl = (dto.numControl || '').trim().toUpperCase();
    const curpLimpia = (dto.curp || '').trim().toUpperCase();
    const hoyIso = new Date().toISOString().split('T')[0];

    const tramite = await this.dataSource.getRepository(TramiteTitulacionEntity).findOne({
      where: { expediente: { numControl } },
      relations: {
        expediente: {
          persona: true,
          titulacion: true
        }
      },
      order: { fechaCreacion: 'DESC' as any }
    });

    if (!tramite || !tramite.expediente) {
      throw new NotFoundException(`No se encontró trámite activo para la matrícula ${numControl}.`);
    }

    const persona = tramite.expediente.persona;
    const metaActual = (tramite.pagosConciliados || {}) as Record<string, any>;

    // 1. ESCUDO FINOPS EN POSTGRESQL: Máximo 1 consulta por día por expediente
    if (metaActual.renapoUltimaFechaDia === hoyIso && metaActual.renapoDictamenCache) {
      return {
        desdeCacheDiario: true,
        ...metaActual.renapoDictamenCache
      };
    }

    const tokenVerificamex = (dto.apiKeyTemporal || process.env.VERIFICAMEX_API_KEY || '').trim();
    let registroOficialRenapo: any = null;
    let tokensConsumidos = 0;
    let modoOperacion = 'SANDBOX_PROTECCION_TOKENS';

    // 2A. Modo Sandbox (0 Tokens — Estructura idéntica al JSON oficial de Verificamex)
    if (!dto.usarApiReal || !tokenVerificamex) {
      registroOficialRenapo = {
        curp: curpLimpia,
        nombres: persona?.nombre && persona.nombre !== 'N/A' ? persona.nombre.toUpperCase() : 'CRISTOPHER JOSHUA',
        primerApellido:
          persona?.primerApellido && persona.primerApellido !== 'N/A'
            ? persona.primerApellido.toUpperCase()
            : 'REYES',
        segundoApellido:
          persona?.segundoApellido && persona.segundoApellido !== 'N/A'
            ? persona.segundoApellido.toUpperCase()
            : 'GUTIÉRREZ',
        sexo: curpLimpia.charAt(10) === 'M' ? 'Mujer' : 'Hombre',
        fechaNacimiento: '2004-05-14',
        nacionalidad: 'MEX',
        entidad: 'Durango',
        claveEntidad: 'DG',
        docProbatorio: 1,
        docProbatorioDesc: 'Acta de nacimiento',
        statusCurp: 'RCN',
        statusCurpDesc: 'Registro de cambio no afectando a CURP',
        datosDocProbatorio: {
          entidadRegistro: 'Durango',
          tomo: 1,
          claveMunicipioRegistro: 5,
          anioReg: 2004,
          foja: 14,
          numActa: 418,
          libro: 2
        }
      };
    } else {
      // 2B. Petición Oficial a Verificamex API (-3 Tokens)
      const response = await fetch('https://api.verificamex.com/identity/v1/scrape/renapo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenVerificamex}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ curp: curpLimpia })
      });

      const payload = await response.json();

      if (!response.ok || payload?.data?.citizen?.status === false) {
        throw new BadRequestException(
          payload?.data?.citizen?.mensaje ||
            payload?.message ||
            'No se pudo validar la CURP en RENAPO. Verifica los 18 caracteres o tu API Key.'
        );
      }

      const listaRegistros = payload?.data?.citizen?.registros;
      if (!Array.isArray(listaRegistros) || listaRegistros.length === 0) {
        throw new NotFoundException('RENAPO no devolvió registros para la CURP proporcionada.');
      }

      registroOficialRenapo = listaRegistros[0];
      tokensConsumidos = 3;
      modoOperacion = 'PRODUCCION_VERIFICAMEX';
    }

    // =========================================================================
    // 3. AUTO-HEALING DATA (BLINDADO CONTRA ERROR 23505 persona_curp_key)
    // =========================================================================
    const cambiosAplicados: { campo: string; anterior: string; nuevo: string }[] = [];
    const repoPersona = this.dataSource.getRepository('PersonaEntity');

    if (persona && registroOficialRenapo) {
      const nuevoNombre = (registroOficialRenapo.nombres || '').trim();
      const nuevoPrimerAp = (registroOficialRenapo.primerApellido || '').trim();
      const nuevoSegundoAp = (registroOficialRenapo.segundoApellido || '').trim();
      const nuevaCurpOficial = (registroOficialRenapo.curp || curpLimpia).trim().toUpperCase();

      // Verificamos si la CURP ya está ocupada por otro id_persona en "identidad"."persona"
      const otraPersonaConMismaCurp: any = await repoPersona
        .createQueryBuilder('p')
        .where('UPPER(p.curp) = :curp', { curp: nuevaCurpOficial })
        .andWhere('p.idPersona != :idActual', { idActual: persona.idPersona })
        .getOne();

      if (otraPersonaConMismaCurp) {
        // Si la CURP ya existe en otra fila de persona, NO forzamos el cambio de columna "curp"
        // en esta fila para no violar "persona_curp_key" (Error 23505). Solo saneamos nombres/apellidos.
        cambiosAplicados.push({
          campo: 'CURP (Unicidad Protegida)',
          anterior: persona.curp || 'S/D',
          nuevo: `${nuevaCurpOficial} (Vinculada)`
        });
      } else if (nuevaCurpOficial && persona.curp !== nuevaCurpOficial) {
        cambiosAplicados.push({
          campo: 'CURP',
          anterior: persona.curp || 'S/D',
          nuevo: nuevaCurpOficial
        });
        persona.curp = nuevaCurpOficial;
      }

      if (nuevoNombre && persona.nombre !== nuevoNombre) {
        cambiosAplicados.push({
          campo: 'Nombre(s)',
          anterior: persona.nombre || 'N/A',
          nuevo: nuevoNombre
        });
        persona.nombre = nuevoNombre;
      }

      if (nuevoPrimerAp && persona.primerApellido !== nuevoPrimerAp) {
        cambiosAplicados.push({
          campo: 'Primer Apellido',
          anterior: persona.primerApellido || 'N/A',
          nuevo: nuevoPrimerAp
        });
        persona.primerApellido = nuevoPrimerAp;
      }

      if (nuevoSegundoAp && persona.segundoApellido !== nuevoSegundoAp) {
        cambiosAplicados.push({
          campo: 'Segundo Apellido',
          anterior: persona.segundoApellido || 'N/A',
          nuevo: nuevoSegundoAp
        });
        persona.segundoApellido = nuevoSegundoAp;
      }

      await repoPersona.save(persona);
    }

    // 4. GUARDADO DEL ESCUDO FINOPS DIARIO EN POSTGRESQL Y RETORNO AL FRONTEND
    const respuestaDictamen = {
      desdeCacheDiario: false,
      modoOperacion,
      tokensConsumidos,
      fechaConsultaIso: new Date().toISOString(),
      numControl,
      datosRenapo: registroOficialRenapo,
      cambiosAutoHealing: cambiosAplicados,
    };

    tramite.pagosConciliados = {
      ...metaActual,
      renapoUltimaFechaDia: hoyIso,
      renapoDictamenCache: respuestaDictamen,
    };

    await this.dataSource.getRepository(TramiteTitulacionEntity).save(tramite);
    return respuestaDictamen;
  }

  async listarCatalogoSinodales() {
    const repo = this.dataSource.getRepository(CatalogoSinodalEntity);
    let lista = await repo.find({
      where: { activo: true },
      order: { nombreCompleto: 'ASC' }
    });

    if (lista.length === 0) {
      const semilla = repo.create([
        { gradoAcademico: 'Dr.', nombreCompleto: 'Marco Antonio Gurrola', departamento: 'Sistemas y Computación' },
        { gradoAcademico: 'M.C.', nombreCompleto: 'Claudia Elena Vázquez', departamento: 'Sistemas y Computación' },
        { gradoAcademico: 'Ing.', nombreCompleto: 'Roberto Carlos Salinas', departamento: 'Ingeniería Industrial y Logística' },
        { gradoAcademico: 'M.I.', nombreCompleto: 'Fernando Hernández', departamento: 'Sistemas y Computación' },
        { gradoAcademico: 'Dra.', nombreCompleto: 'Niltza Iracema González García', departamento: 'División de Estudios Profesionales' },
        { gradoAcademico: 'Dra.', nombreCompleto: 'Mayela Lechuga Nevárez', departamento: 'Ciencias Económico-Administrativas' }
      ]);
      lista = await repo.save(semilla);
    }

    return lista;
  }

  async registrarNuevoSinodal(dto: {
    gradoAcademico: string;
    nombreCompleto: string;
    departamento?: string;
  }) 
  {
    const repo = this.dataSource.getRepository(CatalogoSinodalEntity);
    const nombreLimpio = (dto.nombreCompleto || '').trim();
    const gradoLimpio = (dto.gradoAcademico || 'M.C.').trim();

    if (!nombreLimpio) {
      throw new BadRequestException('El nombre del sinodal es obligatorio.');
    }

    const existente = await repo
      .createQueryBuilder('s')
      .where('LOWER(s.nombreCompleto) = LOWER(:nom)', { nom: nombreLimpio })
      .getOne();

    if (existente) {
      return existente;
    }

    const nuevo = repo.create({
      gradoAcademico: gradoLimpio,
      nombreCompleto: nombreLimpio,
      departamento: (dto.departamento || 'Academia Institucional ITD').trim(),
      activo: true
    });

    return await repo.save(nuevo);
  }
}