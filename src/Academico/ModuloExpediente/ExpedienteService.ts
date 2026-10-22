import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  IsNull,
  Repository,
} from 'typeorm';
import { CrearExpedienteDTO } from '../DTOs/CrearExpedienteDTO.js';
import { ExpedienteEntity } from '../Entities/ExpedienteEntity.js';
import { BuscarExpedienteDTO } from '../DTOs/BuscarExpedienteDTO.js';
import { ActualizarExpedienteDTO } from '../DTOs/ActualizarExpedienteDTO.js';
import { CatalogoCarreraEntity } from '../../ConfiguracionActiva/Entities/CatalogoCarreraEntity.js';
import { ExpedienteAuditoriaEntity } from '../Entities/ExpedienteAuditoriaEntity.js';

import { ConfigService } from '@nestjs/config';
import { ArchivoDigitalEntity } from '../../ArchivoFisico/Entities/ArchivoDigitalEntity.js';

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as fsPromises from 'fs/promises';

import pdfParse = require('pdf-parse');

import * as fs from 'fs';

import * as crypto from 'crypto';

import * as path from 'path';
import { ZipArchive } from 'archiver';
import { CatalogoEstatusExpedienteEntity } from '../../ConfiguracionActiva/Entities/CatalogoEstatusExpedienteEntity.js';
import { CatalogoNivelAcademicoEntity } from '../../ConfiguracionActiva/Entities/CatalogoNivelAcademicoEntity.js';

@Injectable()
export class ExpedienteService {
  constructor(
    @InjectRepository(ExpedienteEntity)
    private readonly expedienteRepo: Repository<ExpedienteEntity>,

    @InjectRepository(CatalogoCarreraEntity)
    private readonly catalogoCarreraRepo: Repository<CatalogoCarreraEntity>,

    @InjectRepository(ExpedienteAuditoriaEntity)
    private readonly auditoriaRepo: Repository<ExpedienteAuditoriaEntity>,

    @InjectRepository(ArchivoDigitalEntity)
    private readonly archivoDigitalRepo: Repository<ArchivoDigitalEntity>,

    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // =======================================================
  // MOTOR OMNISCIENTE: BÚSQUEDA PROFUNDA EN DOCUMENTOS (OCR)
  // =======================================================
  async buscarPorContenidoOCR(palabraClave: string) {
    if (!palabraClave || palabraClave.length < 3) {
      throw new BadRequestException(
        'Para no saturar la memoria, la búsqueda OCR requiere al menos 3 caracteres.',
      );
    }

    // Buscamos desde la raíz del Expediente para saber a quién le pertenece el archivo
    const expedientes = await this.expedienteRepo
      .createQueryBuilder('exp')
      .innerJoinAndSelect('exp.archivosDigitales', 'archivo')
      .leftJoinAndSelect('exp.persona', 'persona') // <-- Traemos la identidad del alumno
      .where('archivo.contenidoTexto ILIKE :busqueda', {
        busqueda: `%${palabraClave}%`,
      })
      .andWhere('archivo.fechaBaja IS NULL')
      .andWhere('exp.fechaBaja IS NULL')
      // Solo traemos los campos estrictamente necesarios para que sea ultrarrápido
      .select([
        'exp.idExpediente',
        'exp.numControl',
        'persona.nombre',
        'persona.primerApellido',
        'archivo.idArchivo',
        'archivo.nombreOriginal',
      ])
      .limit(50) // Límite de seguridad para evitar colapsar la red si buscan una palabra muy común
      .getMany();

    // Formateamos la respuesta para que sea fácil de consumir en Angular
    return {
      terminoBuscado: palabraClave,
      coincidenciasEncontradas: expedientes.length,
      resultados: expedientes.map((exp) => ({
        alumno:
          `${exp.numControl} - ${exp.persona?.nombre || 'N/A'} ${exp.persona?.primerApellido || ''}`.trim(),
        documentoEncontrado: exp.archivosDigitales[0]?.nombreOriginal,
        idArchivo: exp.archivosDigitales[0]?.idArchivo,
      })),
    };
  }

  // =======================================================
  // 1. BUSCADOR OMNISCIENTE MULTICRITERIO
  // =======================================================
  async buscarExpedientes(filtros: BuscarExpedienteDTO) {
    // Iniciamos la consulta anidando la información personal y académica
    const query = this.expedienteRepo
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.persona', 'persona') // Relación a PersonaEntity
      .leftJoinAndSelect('exp.carrera', 'carrera') // Relación a CatalogoCarreraEntity
      .leftJoinAndSelect('exp.estatus', 'estatus')
      .where('exp.fechaBaja IS NULL'); // Filtro Zero-Trust: Solo expedientes activos

    // Si el usuario escribió algo en la barra de búsqueda (Nombre, Apellido o No. Control)
    if (filtros.termino) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('exp.numControl ILIKE :termino', {
            termino: `%${filtros.termino}%`,
          })
            .orWhere('persona.nombre ILIKE :termino', {
              termino: `%${filtros.termino}%`,
            })
            // 👇 LOS CAMBIOS ESTÁN AQUÍ 👇
            .orWhere('persona.primerApellido ILIKE :termino', {
              termino: `%${filtros.termino}%`,
            })
            .orWhere('persona.segundoApellido ILIKE :termino', {
              termino: `%${filtros.termino}%`,
            });
        }),
      );
    }

    if (filtros.id_carrera) {
      // 1. Verificamos en el catálogo
      const carreraExiste = await this.catalogoCarreraRepo.findOne({
        where: { idCarrera: filtros.id_carrera, activo: true },
      });

      // 2. Si manda basura (ej. 98), le cerramos la puerta en la cara
      if (!carreraExiste) {
        throw new BadRequestException(
          `Integridad comprometida: El identificador de carrera [${filtros.id_carrera}] no es válido o no existe en el catálogo institucional.`,
        );
      }

      // 3. Si es válida, aplicamos el filtro
      query.andWhere('carrera.idCarrera = :id_carrera', {
        id_carrera: filtros.id_carrera,
      });
    }

    return await query.orderBy('exp.fechaCreacion', 'DESC').getMany();
  }

  async crearExpediente(dto: CrearExpedienteDTO): Promise<ExpedienteEntity> {
    try {
      // Mapeamos los IDs puros a los objetos relacionales que TypeORM espera
      const nuevoExpediente = this.expedienteRepo.create({
        numControl: dto.numControl,
        persona: { idPersona: dto.idPersona },
        carrera: { idCarrera: dto.idCarrera },
        nivelAcademico: { idNivel: dto.idNivel },
        estatus: { idEstatus: dto.idEstatus },
        folioDigital: dto.folioDigital,
        generacion: dto.generacion,
        modalidad: dto.modalidad,
        titulacion: {}, // Detona la creación del checklist (Relación 1:1)
      });

      return await this.expedienteRepo.save(nuevoExpediente);
    } catch (error: any) {
      // 23505 = Unique Violation (Número de control duplicado)
      if (error.code === '23505') {
        throw new ConflictException(
          'El Número de Control ya se encuentra registrado en el acervo.',
        );
      }
      // 23503 = Foreign Key Violation (El ID de persona o catálogo no existe)
      if (error.code === '23503') {
        throw new ConflictException(
          'Inconsistencia referencial: La persona o catálogo indicado no existe en la base de datos.',
        );
      }
      throw new InternalServerErrorException(
        'Fallo crítico al persistir el expediente.',
      );
    }
  }

  // =======================================================
  // 2. MUTADOR EVOLUTIVO (TRANSACCIÓN ACID + BLOQUEO PESIMISTA)
  // =======================================================
  async actualizarExpedienteEvolutivo(
    numeroControl: string,
    dto: ActualizarExpedienteDTO,
    idUsuarioAdmin: string,
    ipOrigen?: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Bloqueo pesimista (FOR UPDATE) para evitar condiciones de carrera entre administradores
      const expedienteRaiz = await queryRunner.manager
        .createQueryBuilder(ExpedienteEntity, 'exp')
        .leftJoinAndSelect('exp.estatus', 'estatus')
        .leftJoinAndSelect('exp.nivelAcademico', 'nivel')
        .where('exp.numControl = :numeroControl', { numeroControl })
        .andWhere('exp.fechaBaja IS NULL')
        .setLock('pessimistic_write', undefined, ['exp'])
        .getOne();

      if (!expedienteRaiz) {
        throw new NotFoundException(
          `No se localizó un expediente activo con el Número de Control [${numeroControl}].`,
        );
      }

      // 2. Fotografía del estado anterior para Event Sourcing
      const estadoAnterior = {
        idEstatus: expedienteRaiz.estatus?.idEstatus || null,
        idNivelAcademico: expedienteRaiz.nivelAcademico?.idNivel || null,
        folioDigital: expedienteRaiz.folioDigital,
        fechaEgreso: expedienteRaiz.fechaEgreso,
      };

      // 3. Mutación controlada de propiedades
      if (dto.folioDigital !== undefined) {
        expedienteRaiz.folioDigital = dto.folioDigital;
      }
      if (dto.fechaEgreso !== undefined) {
        expedienteRaiz.fechaEgreso = new Date(dto.fechaEgreso);
      }
      if (dto.idEstatus !== undefined) {
        expedienteRaiz.estatus = {
          idEstatus: dto.idEstatus,
        } as CatalogoEstatusExpedienteEntity;
      }
      if (dto.idNivelAcademico !== undefined) {
        expedienteRaiz.nivelAcademico = {
          idNivel: dto.idNivelAcademico,
        } as CatalogoNivelAcademicoEntity;
      }

      const expedienteActualizado = await queryRunner.manager.save(
        ExpedienteEntity,
        expedienteRaiz,
      );

      // 4. Registro forense dentro de la MISMA transacción
      await this.registrarEventoForense(
        expedienteActualizado.idExpediente,
        idUsuarioAdmin,
        'EVOLUCION_ACADEMICA',
        {
          antes: estadoAnterior,
          despues: dto,
        },
        ipOrigen,
        queryRunner.manager,
      );

      // 5. Confirmación atómica de ambos cambios
      await queryRunner.commitTransaction();
      return expedienteActualizado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Fallo transaccional al evolucionar el expediente académico.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // =======================================================
  // 3. TABLERO DE DIRECCIÓN: ESTADÍSTICAS DEMOGRÁFICAS
  // =======================================================
  async obtenerEstadisticasDemograficas() {
    // 1. Ejecutamos todas las consultas agregadas EN PARALELO para máximo rendimiento
    const [
      totalExpedientes,
      estadisticaCarreras,
      estadisticaGeneracion,
      estadisticaEgreso,
    ] = await Promise.all([
      // A. Total global de expedientes activos
      this.expedienteRepo
        .createQueryBuilder('exp')
        .where('exp.fechaBaja IS NULL')
        .getCount(),

      // B. Agrupación por Carrera (Top carreras con más expedientes)
      this.expedienteRepo
        .createQueryBuilder('exp')
        .innerJoin('exp.carrera', 'carrera')
        .select('carrera.nombre', 'carrera')
        .addSelect('COUNT(exp.idExpediente)', 'total')
        .where('exp.fechaBaja IS NULL')
        .groupBy('carrera.nombre')
        .orderBy('total', 'DESC')
        .getRawMany(),

      // C. Agrupación por Generación (ej. 2020-2024)
      this.expedienteRepo
        .createQueryBuilder('exp')
        .select('exp.generacion', 'generacion')
        .addSelect('COUNT(exp.idExpediente)', 'total')
        .where('exp.fechaBaja IS NULL')
        .andWhere('exp.generacion IS NOT NULL') // Ignoramos los que no tienen generación
        .groupBy('exp.generacion')
        .orderBy('generacion', 'DESC')
        .getRawMany(),

      // D. Agrupación por Año de Egreso (Extrayendo solo el año de la fecha)
      this.expedienteRepo
        .createQueryBuilder('exp')
        .select('EXTRACT(YEAR FROM exp.fechaEgreso)', 'anio')
        .addSelect('COUNT(exp.idExpediente)', 'total')
        .where('exp.fechaBaja IS NULL')
        .andWhere('exp.fechaEgreso IS NOT NULL')
        .groupBy('EXTRACT(YEAR FROM exp.fechaEgreso)')
        .orderBy('anio', 'DESC')
        .getRawMany(),
    ]);

    // 2. Ensamblamos el JSON limpio para el Dashboard de Angular
    return {
      resumenGlobal: {
        totalExpedientesActivos: totalExpedientes,
      },
      demografia: {
        porCarrera: estadisticaCarreras.map((item) => ({
          carrera: item.carrera,
          total: Number(item.total),
        })),
      },
      historiaAcademica: {
        porGeneracion: estadisticaGeneracion.map((item) => ({
          generacion: item.generacion,
          total: Number(item.total),
        })),
        porAnioEgreso: estadisticaEgreso.map((item) => ({
          anio: Number(item.anio),
          total: Number(item.total),
        })),
      },
    };
  }

  // =======================================================
  // 4. SEGURIDAD ZERO-TRUST: AUDITORÍA CRIPTOGRÁFICA Y SELLADO
  // =======================================================
  async auditarIntegridadExpediente(numeroControl: string) {
    // 1. LA SUBCONSULTA OCULTA: Localizamos el expediente y traemos sus archivos
    const expedienteRaiz = await this.expedienteRepo
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.archivosDigitales', 'archivos')
      .where('exp.numControl = :numeroControl', { numeroControl })
      .andWhere('exp.fechaBaja IS NULL')
      .andWhere('archivos.fechaBaja IS NULL')
      .getOne();

    if (!expedienteRaiz) {
      throw new NotFoundException(
        `Validación fallida: No se localizó un expediente activo con el folio [${numeroControl}] o no tiene archivos digitalizados.`,
      );
    }

    const archivos = expedienteRaiz.archivosDigitales || [];
    if (archivos.length === 0) {
      return { estatusGlobal: 'SIN_ARCHIVOS', detalles: [] };
    }

    const reporteAuditoria = [];
    let estatusGlobalExpediente = 'INTEGRO'; // Asumimos inocencia hasta demostrar lo contrario

    await this.archivoDigitalRepo.save(archivos);

    // 2. ITERAMOS Y AUDITAMOS CADA DOCUMENTO FÍSICO
    for (const archivo of archivos) {
      const rutaFisica = archivo.rutaLocal;

      // A) Verificamos existencia física
      const existeEnDisco = await this.existeArchivoFisico(rutaFisica);
      if (!existeEnDisco) {
        estatusGlobalExpediente = 'PELIGRO_CRITICO';
        reporteAuditoria.push({
          idArchivo: archivo.idArchivo,
          documento: archivo.nombreOriginal,
          estatus: 'DESAPARECIDO',
          mensaje: 'El archivo no se encuentra en el disco duro del servidor.',
        });
        continue;
      }

      // B) Leemos el archivo en memoria y calculamos su firma SHA-256 actual
      const fileBuffer = await fsPromises.readFile(rutaFisica);
      const hashCalculado = crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex');

      // C) Lógica de Sellado o Auditoría
      if (archivo.hashSha256 === 'calculo_pendiente') {
        // Fase de Sellado Inicial
        archivo.hashSha256 = hashCalculado;
        await this.archivoDigitalRepo.save(archivo); // Sellamos en PostgreSQL

        reporteAuditoria.push({
          idArchivo: archivo.idArchivo,
          documento: archivo.nombreOriginal,
          estatus: 'SELLADO_INICIAL',
          hash: hashCalculado,
          mensaje:
            'Firma criptográfica calculada y sellada en la base de datos exitosamente.',
        });
      } else if (archivo.hashSha256 === hashCalculado) {
        // Fase de Verificación Exitosa
        reporteAuditoria.push({
          idArchivo: archivo.idArchivo,
          documento: archivo.nombreOriginal,
          estatus: 'INTEGRO',
          hash: hashCalculado,
          mensaje: 'El documento no ha sido alterado.',
        });
      } else {
        // Fase de Detección de Tampering (Hackeo/Alteración)
        estatusGlobalExpediente = 'PELIGRO_CRITICO';
        reporteAuditoria.push({
          idArchivo: archivo.idArchivo,
          documento: archivo.nombreOriginal,
          estatus: 'CORRUPTO_O_ALTERADO',
          hashEsperado: archivo.hashSha256,
          hashEncontrado: hashCalculado,
          mensaje:
            'ALERTA: La huella digital del archivo físico no coincide con el registro inmutable de la base de datos.',
        });
      }
    }

    // 3. RETORNAMOS EL VEREDICTO FORENSE
    return {
      numeroControl: expedienteRaiz.numControl,
      idInternoOculto: expedienteRaiz.idExpediente,
      fechaAuditoria: new Date(),
      totalArchivosAuditados: archivos.length,
      veredictoGlobal: estatusGlobalExpediente,
      reporte: reporteAuditoria,
    };
  }

  // =======================================================
  // 5. ANALÍTICA INDIVIDUAL: RADIOGRAFÍA DEL ESTUDIANTE
  // =======================================================
  async obtenerAnaliticaTrayectoria(numeroControl: string) {
    // 1. Resolución Indirecta y Extracción Profunda
    const expediente = await this.expedienteRepo
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.estatus', 'estatus')
      // Traemos los archivos y préstamos activos
      .leftJoinAndSelect(
        'exp.archivosDigitales',
        'archivos',
        'archivos.fechaBaja IS NULL',
      )
      .leftJoinAndSelect(
        'exp.prestamos',
        'prestamos',
        'prestamos.fechaRetorno IS NULL',
      )
      .where('exp.numControl = :numeroControl', { numeroControl })
      .andWhere('exp.fechaBaja IS NULL')
      .getOne();

    if (!expediente) {
      throw new NotFoundException(
        `Validación fallida: No se localizó un expediente activo con el folio [${numeroControl}].`,
      );
    }

    // 2. Cálculos de Inteligencia de Negocios
    const totalDocumentos = expediente.archivosDigitales?.length || 0;
    const prestamosActivos = expediente.prestamos?.length || 0;

    // Calculamos el tiempo de vida del expediente en el ITD
    const msPorDia = 1000 * 60 * 60 * 24;
    const diasDesdeCreacion = Math.floor(
      (new Date().getTime() - expediente.fechaCreacion.getTime()) / msPorDia,
    );

    // 3. Ensamblaje de la Radiografía
    return {
      identidad: {
        numeroControl: expediente.numControl,
        generacion: expediente.generacion || 'No especificada',
        estatusActual: expediente.estatus?.nombre || 'SIN ESTATUS ASIGNADO',
      },
      saludDocumental: {
        documentosEnBoveda: totalDocumentos,
        clasificacion:
          totalDocumentos === 0
            ? 'CRÍTICO: Expediente Vacío'
            : totalDocumentos < 5
              ? 'ADVERTENCIA: Documentación Incompleta'
              : 'ÓPTIMO: Documentación Robusta',
      },
      actividadFisica: {
        prestamosActivosEnCurso: prestamosActivos,
        alertaPrestamo:
          prestamosActivos > 0
            ? 'El expediente físico se encuentra fuera del archivo central.'
            : 'Expediente físico resguardado.',
      },
      antiguedad: {
        diasEnSistema: diasDesdeCreacion,
        fechaApertura: expediente.fechaCreacion,
      },
    };
  }

  // =======================================================
  // 6. INTEROPERABILIDAD: PAQUETE DE EXPORTACIÓN INSTITUCIONAL
  // =======================================================
  async exportarPaqueteInstitucional(numeroControl: string) {
    // 1. LA SUBCONSULTA OCULTA: Traemos toda la información transversal
    const expediente = await this.expedienteRepo
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.persona', 'persona')
      .leftJoinAndSelect('exp.carrera', 'carrera')
      .leftJoinAndSelect('exp.estatus', 'estatus')
      .leftJoinAndSelect(
        'exp.archivosDigitales',
        'archivos',
        'archivos.fechaBaja IS NULL',
      )
      .leftJoinAndSelect('archivos.tipoArchivo', 'tipoArchivo')
      .where('exp.numControl = :numeroControl', { numeroControl })
      .andWhere('exp.fechaBaja IS NULL')
      .getOne();

    if (!expediente) {
      throw new NotFoundException(
        `Interoperabilidad fallida: No se localizó el expediente [${numeroControl}].`,
      );
    }

    // 2. GENERACIÓN DEL ENVELOPE (Estándar de Exportación)
    const tiempoExpiracionMs = 5 * 60 * 1000; // 5 minutos de validez para las URLs temporales
    const timestampVencimiento = new Date().getTime() + tiempoExpiracionMs;

    const paqueteTecNM = {
      cabecera: {
        institucionOrigen: 'Instituto Tecnológico de Durango (ITD)',
        sistema: 'SIGAH Enterprise v3.0',
        fechaEmisionZ: new Date().toISOString(),
        idTransaccion: crypto.randomUUID(), // Trazabilidad de la petición
      },
      identidadAcademica: {
        numeroControl: expediente.numControl,
        curpVerificada: expediente.persona?.curp || 'NO_REGISTRADA',
        nombreOficial: `${expediente.persona?.nombre} ${expediente.persona?.primerApellido} ${expediente.persona?.segundoApellido}`,
        programaEducativo: expediente.carrera?.nombre || 'NO_ASIGNADO',
        estatusActual: expediente.estatus?.nombre || 'DESCONOCIDO',
        fechaEgreso: expediente.fechaEgreso
          ? expediente.fechaEgreso.toISOString().split('T')[0]
          : null,
      },
      acervoDocumentalOficial: (expediente.archivosDigitales || []).map(
        (archivo) => ({
          tipoDocumento: archivo.tipoArchivo?.nombre || 'DOCUMENTO_GENERICO',
          firmaCriptograficaSha256: archivo.hashSha256,
          pesoBytes: archivo.pesoBytes,
          // URL de un solo uso o con caducidad de 5 minutos
          urlDescargaTemporal: `/api/v3/expedientes/interoperabilidad/descarga/${expediente.idExpediente}/${archivo.idArchivo}?expires=${timestampVencimiento}`,
        }),
      ),
    };

    return paqueteTecNM;
  }

  // =======================================================
  // 7. MOTOR EFÍMERO: VALIDACIÓN DE TIEMPO Y DESCARGA
  // =======================================================
  async descargarArchivoTemporal(
    idExpediente: string,
    idArchivo: string,
    timestampExpiracion: string,
  ) {
    // 1. EL RELOJ IMPLACABLE: Validamos si el tiempo se agotó (Zero-Trust)
    const tiempoLimite = parseInt(timestampExpiracion, 10);
    if (isNaN(tiempoLimite) || new Date().getTime() > tiempoLimite) {
      throw new UnauthorizedException(
        'Ciberseguridad: El enlace temporal ha caducado. La dependencia debe solicitar un nuevo paquete de validación.',
      );
    }

    // 2. BUSCAMOS LA RELACIÓN EXACTA EN BASE DE DATOS
    const expediente = await this.expedienteRepo
      .createQueryBuilder('exp')
      .innerJoinAndSelect(
        'exp.archivosDigitales',
        'archivos',
        'archivos.idArchivo = :idArchivo',
        { idArchivo },
      )
      .where('exp.idExpediente = :idExpediente', { idExpediente })
      .andWhere('archivos.fechaBaja IS NULL')
      .getOne();

    if (
      !expediente ||
      !expediente.archivosDigitales ||
      expediente.archivosDigitales.length === 0
    ) {
      throw new NotFoundException(
        'Violación de acceso: El archivo no existe o no pertenece a este expediente institucional.',
      );
    }

    const archivo = expediente.archivosDigitales[0];
    const rutaFisica = archivo.rutaLocal;

    // 3. VALIDAMOS EL DISCO DURO FÍSICO
    const existeEnDisco = await this.existeArchivoFisico(rutaFisica);
    if (!existeEnDisco) {
      throw new NotFoundException(
        'Fallo Físico: El documento digitalizado no se encuentra en la bóveda del servidor.',
      );
    }

    // 4. ABRIMOS LA COMPUERTA (Stream)
    // No cargamos todo el PDF a la RAM, lo enviamos como un flujo de agua para no saturar el servidor
    return {
      stream: fs.createReadStream(rutaFisica),
      nombreArchivo: archivo.nombreOriginal,
    };
  }

  // =======================================================
  // MOTOR FORENSE: REGISTRO INMUTABLE DE EVENTOS (SOPORTE ACID)
  // =======================================================
  private async registrarEventoForense(
    idExpediente: string,
    idUsuarioAdmin: string,
    tipoAccion: string,
    detallesCambio: Record<string, any>,
    ipOrigen?: string,
    manager?: EntityManager, // <-- Permite ejecutar dentro de una transacción activa
  ) {
    const repo = manager
      ? manager.getRepository(ExpedienteAuditoriaEntity)
      : this.auditoriaRepo;

    const nuevoRegistro = repo.create({
      expediente: { idExpediente },
      usuarioAccion: { idUsuario: idUsuarioAdmin },
      tipoAccion,
      detallesCambio,
      ipOrigen: ipOrigen || 'IP_DESCONOCIDA',
    });

    await repo.save(nuevoRegistro);
  }

  // =======================================================
  // TRAZABILIDAD FORENSE: LECTURA DE LA LÍNEA DE TIEMPO
  // =======================================================
  async obtenerHistorialEventos(numeroControl: string) {
    // 1. LA SUBCONSULTA OCULTA: Localizamos el ID interno del expediente
    const expediente = await this.expedienteRepo.findOne({
      where: { numControl: numeroControl, fechaBaja: IsNull() },
      // 👇 LA CORRECCIÓN EXACTA DE TYPEORM 0.3 👇
      select: {
        idExpediente: true,
        numControl: true,
      },
    });

    if (!expediente) {
      throw new NotFoundException(
        `Validación fallida: No se localizó un expediente activo con el folio [${numeroControl}].`,
      );
    }

    // 2. EXTRACCIÓN DE LA CAJA NEGRA (Ordenada del evento más reciente al más antiguo)
    const historial = await this.auditoriaRepo
      .createQueryBuilder('auditoria')
      .leftJoin('auditoria.usuarioAccion', 'admin')
      .select([
        'auditoria.idAuditoria',
        'auditoria.tipoAccion',
        'auditoria.detallesCambio',
        'auditoria.ipOrigen',
        'auditoria.fechaAccion',
        'admin.email', // Traemos el correo institucional de quien hizo el cambio
      ])
      .where('auditoria.id_expediente = :idExpediente', {
        idExpediente: expediente.idExpediente,
      })
      .orderBy('auditoria.fechaAccion', 'DESC')
      .getMany();

    // 3. ENSAMBLAJE PARA EL FRONTEND
    return {
      numeroControl: expediente.numControl,
      totalEventosRegistrados: historial.length,
      lineaDeTiempo: historial.map((evento) => ({
        idEvento: evento.idAuditoria,
        fecha: evento.fechaAccion,
        accion: evento.tipoAccion,
        responsable: evento.usuarioAccion?.email || 'SISTEMA_AUTOMATIZADO',
        ip: evento.ipOrigen,
        detalles: evento.detallesCambio,
      })),
    };
  }

  // =======================================================
  // ESCALABILIDAD DE ALMACENAMIENTO: BÓVEDA FRÍA (TRANSACCIONAL ACID)
  // =======================================================
  async congelarExpedienteEnBovedaFria(
    numeroControl: string,
    idUsuarioAdmin: string,
    ipOrigen?: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let rutaFriaComprimida = '';

    try {
      // 1. Subconsulta con bloqueo para evitar doble congelamiento simultáneo
      const expediente = await queryRunner.manager
        .createQueryBuilder(ExpedienteEntity, 'exp')
        .leftJoinAndSelect(
          'exp.archivosDigitales',
          'archivos',
          'archivos.fechaBaja IS NULL',
        )
        .where('exp.numControl = :numeroControl', { numeroControl })
        .andWhere('exp.fechaBaja IS NULL')
        .setLock('pessimistic_write', undefined, ['exp'])
        .getOne();

      if (!expediente) {
        throw new NotFoundException(
          `No se localizó un expediente activo con el folio [${numeroControl}].`,
        );
      }

      const archivos = expediente.archivosDigitales || [];
      if (archivos.length === 0) {
        throw new BadRequestException(
          'Operación denegada: El expediente no contiene archivos digitales para congelar.',
        );
      }

      // 2. Filtramos archivos físicos reales que aún no estén en un .zip
      const rutasOriginalesParaBorrar: string[] = [];
      const archivosPorCongelar: ArchivoDigitalEntity[] = [];
      let espacioLiberadoBytes = 0;

      for (const archivo of archivos) {
        if (
          !archivo.rutaLocal.endsWith('.zip') &&
          (await this.existeArchivoFisico(archivo.rutaLocal))
        ) {
          const stats = await fsPromises.stat(archivo.rutaLocal);
          espacioLiberadoBytes += stats.size;
          rutasOriginalesParaBorrar.push(archivo.rutaLocal);
          archivosPorCongelar.push(archivo);
        }
      }

      if (archivosPorCongelar.length === 0) {
        throw new BadRequestException(
          'El expediente ya se encuentra archivado en frío o sus archivos físicos no están disponibles.',
        );
      }

      // 3. Preparamos el directorio de Bóveda Fría
      const folderFrio = this.configService.get<string>(
        'STORAGE_COLD_PATH',
        'boveda_fria_itd',
      );
      const bovedaFriaPath = path.resolve(process.cwd(), folderFrio);
      await fsPromises.mkdir(bovedaFriaPath, { recursive: true });

      const nombreZip = `EXP_FRIO_${numeroControl}_${Date.now()}.zip`;
      rutaFriaComprimida = path.join(bovedaFriaPath, nombreZip);

      // 4. Empaquetado en ZIP con cierre seguro de Streams
      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(rutaFriaComprimida);
        const zipArchive = new ZipArchive({ zlib: { level: 9 } });

        const abortarFlujo = (err: Error) => {
          zipArchive.abort();
          if (!output.destroyed) {
            output.destroy();
          }
          reject(err);
        };

        output.on('close', () => resolve());
        output.on('error', abortarFlujo);
        zipArchive.on('error', abortarFlujo);

        zipArchive.pipe(output);

        for (const archivo of archivosPorCongelar) {
          zipArchive.file(archivo.rutaLocal, { name: archivo.nombreOriginal });
        }

        zipArchive.finalize();
      });

      // 5. Actualizamos las entidades en la Base de Datos (Dentro de la transacción)
      for (const archivo of archivosPorCongelar) {
        archivo.rutaLocal = rutaFriaComprimida;
        await queryRunner.manager.save(ArchivoDigitalEntity, archivo);
      }

      // 6. Registramos en la Caja Negra (Dentro de la transacción)
      await this.registrarEventoForense(
        expediente.idExpediente,
        idUsuarioAdmin,
        'MIGRACION_BOVEDA_FRIA',
        {
          archivosCongelados: archivosPorCongelar.length,
          bytesLiberados: espacioLiberadoBytes,
          nuevaUbicacionFria: rutaFriaComprimida,
        },
        ipOrigen,
        queryRunner.manager,
      );

      // 7. COMMIT: La Base de Datos asegura los cambios de forma permanente
      await queryRunner.commitTransaction();

      // 8. LIMPIEZA POST-COMMIT: Borramos los PDFs pesados solo cuando la BD ya está a salvo
      for (const rutaVieja of rutasOriginalesParaBorrar) {
        try {
          await fsPromises.unlink(rutaVieja);
        } catch (unlinkErr) {
          console.warn(
            `[ColdStorage Warning] No se pudo eliminar el archivo residual ${rutaVieja}:`,
            unlinkErr,
          );
        }
      }

      return {
        numeroControl: expediente.numControl,
        documentosCongelados: archivosPorCongelar.length,
        megabytesLiberados:
          (espacioLiberadoBytes / (1024 * 1024)).toFixed(2) + ' MB',
        estado: 'ARCHIVADO_EN_FRIO',
      };
    } catch (error) {
      // ROLLBACK DE BASE DE DATOS
      await queryRunner.rollbackTransaction();

      // ROLLBACK COMPENSATORIO DE DISCO: Si se alcanzó a crear un ZIP huérfano, lo eliminamos
      if (
        rutaFriaComprimida &&
        (await this.existeArchivoFisico(rutaFriaComprimida))
      ) {
        try {
          await fsPromises.unlink(rutaFriaComprimida);
        } catch {
          // Ignoramos error de limpieza secundaria
        }
      }

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Fallo crítico durante la transición transaccional a Bóveda Fría. Los archivos originales permanecen intactos.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // =======================================================
  // SEGURIDAD ZERO-TRUST: MARCAS DE AGUA DINÁMICAS
  // =======================================================
  async sellarDocumentoConMarcaDeAgua(
    rutaFisica: string,
    emailResponsable: string,
    ipOrigen: string,
  ) {
    // 1. Leemos el archivo original de la bóveda
    const pdfBytes = await fsPromises.readFile(rutaFisica);

    // 2. Cargamos el documento en el motor de pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // 3. Preparamos el sello forense
    const fuenteSello = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const textoForense = `DOCUMENTO OFICIAL ITD\nDescargado por: ${emailResponsable}\nIP: ${ipOrigen}\nFecha: ${new Date().toISOString()}`;

    // 4. Iteramos sobre CADA página del PDF para que no puedan saltarse el sello
    const paginas = pdfDoc.getPages();
    for (const pagina of paginas) {
      const { width, height } = pagina.getSize();

      pagina.drawText(textoForense, {
        x: width / 2 - 200, // Centrado aproximado
        y: height / 2,
        size: 24,
        font: fuenteSello,
        color: rgb(0.8, 0.2, 0.2), // Un color rojizo de advertencia
        opacity: 0.25, // 25% de opacidad para que se pueda leer el texto original atrás
        rotate: degrees(-45), // Diagonal dramática
        lineHeight: 30,
      });
    }

    // 5. Guardamos el PDF modificado en la memoria RAM (No tocamos el disco)
    const pdfSelladoBytes = await pdfDoc.save();

    // Retornamos el Buffer y el tamaño para el Controller
    return Buffer.from(pdfSelladoBytes);
  }

  // =======================================================
  //  * Funciones Axuliares y Privadas
  // =======================================================

  // =======================================================
  // UTILERÍA INTERNA: EXTRACCIÓN DE METADATOS DE ARCHIVO
  // =======================================================
  async obtenerDetalleArchivo(idArchivo: string) {
    const archivo = await this.archivoDigitalRepo.findOne({
      where: {
        idArchivo: idArchivo,
        fechaBaja: IsNull(), // Aprovechamos la sintaxis estricta de TypeORM 0.3
      },
      select: {
        idArchivo: true,
        nombreOriginal: true,
        rutaLocal: true,
        hashSha256: true,
      },
    });

    if (!archivo) {
      throw new NotFoundException(
        `Fallo de lectura: No se localizó un documento activo con el identificador [${idArchivo}].`,
      );
    }

    return archivo;
  }

  // =======================================================
  // INTELIGENCIA DOCUMENTAL: EXTRACCIÓN OCR DE TEXTO
  // =======================================================
  async extraerTextoYGuardar(idArchivo: string, rutaFisica: string) {
    try {
      // 1. Leemos el archivo físico de la bóveda
      const buffer = await fsPromises.readFile(rutaFisica);

      // 2. El motor OCR extrae todo el texto oculto en el PDF
      const pdfData = await (pdfParse as any)(buffer);

      // 3. Limpieza de datos: Quitamos saltos de línea múltiples y espacios extra
      const textoLimpio = pdfData.text
        .replace(/\n/g, ' ') // Cambia saltos de línea por espacios
        .replace(/\s+/g, ' ') // Elimina espacios dobles o triples
        .trim();

      // 4. Guardamos el conocimiento en la Base de Datos

      await this.archivoDigitalRepo.update(idArchivo, {
        contenidoTexto: textoLimpio,
      });

      return {
        paginasLeidas: pdfData.numpages,
        caracteresExtraidos: textoLimpio.length,
        vistaPrevia: textoLimpio.substring(0, 100) + '...', // Un pequeño adelanto
      };
    } catch (error) {
      // Si el PDF es solo una imagen escaneada sin texto incrustado, no queremos que el sistema colapse.
      // Simplemente lo registramos y continuamos.
      console.warn(
        `[OCR Warning] No se pudo extraer texto del archivo ${idArchivo}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  // =======================================================
  // UTILERÍA ASÍNCRONA: VERIFICACIÓN FÍSICA NO BLOQUEANTE
  // =======================================================
  private async existeArchivoFisico(ruta: string): Promise<boolean> {
    try {
      await fsPromises.access(ruta, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  // =======================================================
  // SEGURIDAD ZERO-TRUST: ELIMINACIÓN LÓGICA (SOFT DELETE)
  // =======================================================
  async eliminarDocumentoLogicamente(
    idArchivo: string,
    idUsuarioAdmin: string,
    ipOrigen: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const archivo = await queryRunner.manager.findOne(ArchivoDigitalEntity, {
        where: { idArchivo },
        relations: { expediente: true },
      });

      if (!archivo || archivo.fechaBaja) {
        throw new NotFoundException(
          'Fallo forense: El documento no existe o ya fue dado de baja previamente.',
        );
      }

      // Soft delete: TypeORM inyecta automáticamente la fecha en "fechaBaja" sin borrar el registro real
      await queryRunner.manager.softRemove(ArchivoDigitalEntity, archivo);

      // Auditoría en Caja Negra
      await this.registrarEventoForense(
        archivo.expediente.idExpediente,
        idUsuarioAdmin,
        'ELIMINACION_DOCUMENTO_FISICO',
        {
          idArchivoDesvinculado: idArchivo,
          documentoAfectado: archivo.nombreOriginal,
        },
        ipOrigen,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
      return archivo;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Fallo transaccional al intentar desvincular el documento.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // =======================================================
}
