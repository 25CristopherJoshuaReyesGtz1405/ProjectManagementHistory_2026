import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as otpGenerator from 'otp-generator';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';

import {
  CrearOActualizarOperadorAdminDTO,
  CambiarEstadoOperadorDTO,
  ForzarTransicionFsmAdminDTO,
  AsignarCustodiaNoRepudioAdminDTO,
  RelevoCustodiaForzosaAdminDTO,
  CrearConvenioB2BAdminDTO,
  ActualizarSinodalAdminDTO,
  SaneamientoIdentidadAdminDTO,
} from './DTOs/AdminGobernanzaDTOs.js';

import { EstadoTitulacion } from '../../Academico/Constant/FSM_Titulacion.js';
import { CatalogoSinodalEntity } from '../../Academico/Entities/CatalogoSinodalEntity.js';
import { ConvenioInteroperabilidadEntity } from '../../Academico/Entities/ConvenioInteroperabilidadEntity.js';
import { ExpedienteAuditoriaEntity } from '../../Academico/Entities/ExpedienteAuditoriaEntity.js';
import { ExpedienteEntity } from '../../Academico/Entities/ExpedienteEntity.js';
import { TramiteTitulacionEntity } from '../../Academico/Entities/TramiteTitulacionEntity.js';
import { ExpedienteService } from '../../Academico/ModuloExpediente/ExpedienteService.js';

import { ArchivoDigitalEntity } from '../../ArchivoFisico/Entities/ArchivoDigitalEntity.js';
import { PrestamoEntity } from '../../ArchivoFisico/Entities/PrestamoEntity.js';
import { DriveService } from '../../ArchivoFisico/ModuloDigitalizacion/DriveService.js';

import { CatalogoCarreraEntity } from '../../ConfiguracionActiva/Entities/CatalogoCarreraEntity.js';
import { CatalogoRolUsuarioEntity } from '../../ConfiguracionActiva/Entities/CatalogoRolUsuarioEntity.js';

import { LruCacheService } from '../../NucleoActivo/CacheActivo/LruCache.service.js';

import { AlertaSeguridadEntity } from '../Entities/AlertaSeguridadEntity.js';
import { PersonaEntity } from '../Entities/PersonaEntity.js';
import { TicketSoporteEntity } from '../Entities/TicketSoporteEntity.js';
import { UsuarioEntity } from '../Entities/UsuarioEntity.js';

import { NotificacionService } from '../ModuloNotificacion/NotificacionService.js';

@Injectable()
export class AdminGobernanzaService {
  private readonly logger = new Logger(AdminGobernanzaService.name);
  private readonly META_ACERVO_HISTORICO = 60000;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly cacheService: LruCacheService,
    private readonly notificacionService: NotificacionService,
    private readonly expedienteService: ExpedienteService,
    private readonly driveService: DriveService,
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>,
    @InjectRepository(PersonaEntity)
    private readonly personaRepo: Repository<PersonaEntity>,
    @InjectRepository(AlertaSeguridadEntity)
    private readonly alertaSeguridadRepo: Repository<AlertaSeguridadEntity>,
    @InjectRepository(TicketSoporteEntity)
    private readonly ticketSoporteRepo: Repository<TicketSoporteEntity>,
    @InjectRepository(CatalogoRolUsuarioEntity)
    private readonly rolRepo: Repository<CatalogoRolUsuarioEntity>,
    @InjectRepository(CatalogoCarreraEntity)
    private readonly carreraRepo: Repository<CatalogoCarreraEntity>,
    @InjectRepository(ExpedienteEntity)
    private readonly expedienteRepo: Repository<ExpedienteEntity>,
    @InjectRepository(TramiteTitulacionEntity)
    private readonly tramiteTitulacionRepo: Repository<TramiteTitulacionEntity>,
    @InjectRepository(CatalogoSinodalEntity)
    private readonly sinodalRepo: Repository<CatalogoSinodalEntity>,

    @InjectRepository(ConvenioInteroperabilidadEntity)
    private readonly convenioRepo: Repository<ConvenioInteroperabilidadEntity>,
    @InjectRepository(ExpedienteAuditoriaEntity)
    private readonly auditoriaRepo: Repository<ExpedienteAuditoriaEntity>,
    @InjectRepository(PrestamoEntity)
    private readonly prestamoRepo: Repository<PrestamoEntity>,
    @InjectRepository(ArchivoDigitalEntity)
    private readonly archivoDigitalRepo: Repository<ArchivoDigitalEntity>,
    @InjectQueue('digitalizacion-queue')
    private readonly digitalizacionQueue: Queue,
    @InjectQueue('titulacion-queue')
    private readonly titulacionQueue: Queue,
  ) {}

  // =========================================================================
  // 1. TELEMETRÍA EJECUTIVA 360° Y LEAN SIX SIGMA (META 60,000 EXPEDIENTES)
  // =========================================================================
  async obtenerRadiografiaEjecutivaGlobal() {
    const [
      demografia,
      totalArchivosDigitales,
      archivosSinSellarSha256,
      archivosEnBovedaFria,
      prestamosActivosList,
      tramitesTitulacionList,
      operadoresActivosCount,
      alertasSeguridadRecientes,
      ticketsAbiertosCount,
    ] = await Promise.all([
      this.expedienteService.obtenerEstadisticasDemograficas(),
      this.archivoDigitalRepo.count({ where: { fechaBaja: IsNull() } }),
      this.archivoDigitalRepo.count({
        where: { hashSha256: 'calculo_pendiente', fechaBaja: IsNull() },
      }),
      this.archivoDigitalRepo
        .createQueryBuilder('arc')
        .where('arc.rutaLocal LIKE :zip', { zip: '%.zip' })
        .andWhere('arc.fechaBaja IS NULL')
        .getCount(),
      this.prestamoRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.estatusPrestamo', 'est')
        .leftJoinAndSelect('p.expediente', 'exp')
        .leftJoinAndSelect('p.usuarioSolicitante', 'usr')
        .where('est.idEstatusPrestamo IN (:...ids)', { ids: [1, 4] })
        .andWhere('p.fechaBaja IS NULL')
        .getMany(),
      this.tramiteTitulacionRepo.find({
        relations: { expediente: true, firmasSinodo: true },
      }),
      this.usuarioRepo.count({ where: { fechaBaja: IsNull() } }),
      this.alertaSeguridadRepo.find({
        order: { fechaIncidente: 'DESC' },
        take: 15,
      }),
      this.ticketSoporteRepo.count({
        where: [{ estado: 'ABIERTO' }, { estado: 'EN_ATENCION' }],
      }),
    ]);

    const ahoraMs = Date.now();
    const SLA_48_HORAS_MS = 48 * 60 * 60 * 1000;

    let prestamosEnSla = 0;
    let prestamosVencidosSla = 0;
    let solicitudesPendientesOtp = 0;

    for (const p of prestamosActivosList) {
      if (p.estatusPrestamo?.idEstatusPrestamo === 1) {
        solicitudesPendientesOtp++;
      } else {
        const refFecha = p.fechaSalida
          ? new Date(p.fechaSalida).getTime()
          : new Date(p.fechaCreacion).getTime();
        if (ahoraMs - refFecha > SLA_48_HORAS_MS) {
          prestamosVencidosSla++;
        } else {
          prestamosEnSla++;
        }
      }
    }

    const embudoTitulacion = {
      fase1Fiscalizacion: 0,
      fase2NoInconveniencia: 0,
      fase3SinodoYActas: 0,
      finalizadosEntregados: 0,
      totalTramites: tramitesTitulacionList.length,
    };

    for (const t of tramitesTitulacionList) {
      if (
        t.estatusActual === EstadoTitulacion.PASO_1_REGISTRO ||
        t.estatusActual === EstadoTitulacion.PASO_3_TRIAGE_DOCS
      ) {
        embudoTitulacion.fase1Fiscalizacion++;
      } else if (
        t.estatusActual === EstadoTitulacion.PASO_4_PAGO_EXAMEN ||
        t.estatusActual === EstadoTitulacion.PASO_5_CARTA_NO_INCONVENIENCIA
      ) {
        embudoTitulacion.fase2NoInconveniencia++;
      } else if (t.estatusActual === EstadoTitulacion.FINALIZADO_ENTREGADO) {
        embudoTitulacion.finalizadosEntregados++;
      } else {
        embudoTitulacion.fase3SinodoYActas++;
      }
    }

    const totalExp = demografia.resumenGlobal.totalExpedientesActivos;
    const porcentajeMeta60k = Number(
      ((totalExp / this.META_ACERVO_HISTORICO) * 100).toFixed(2),
    );

    return {
      metaInstitucional60k: {
        metaObjetivo: this.META_ACERVO_HISTORICO,
        expedientesActuales: totalExp,
        porcentajeCompletitud: porcentajeMeta60k,
        expedientesRestantes: Math.max(
          0,
          this.META_ACERVO_HISTORICO - totalExp,
        ),
      },
      bovedaYSeguridadCriptografica: {
        totalDocumentosDigitalizados: totalArchivosDigitales,
        documentosSelladosSha256: Math.max(
          0,
          totalArchivosDigitales - archivosSinSellarSha256,
        ),
        documentosPendientesSellado: archivosSinSellarSha256,
        documentosEnBovedaFriaZip: archivosEnBovedaFria,
        porcentajeIntegridadSha256:
          totalArchivosDigitales > 0
            ? Math.round(
                ((totalArchivosDigitales - archivosSinSellarSha256) /
                  totalArchivosDigitales) *
                  100,
              )
            : 100,
      },
      aduanaFisicaSla: {
        totalCarpetasFueraDeBoveda: prestamosActivosList.length,
        enCustodiaDentroDeSla: prestamosEnSla,
        excedidosSla48Horas: prestamosVencidosSla,
        esperandoConfirmacionOtp: solicitudesPendientesOtp,
      },
      embudoTitulacion,
      gobernanzaOperativa: {
        operadoresActivos: operadoresActivosCount,
        ticketsSoportePendientes: ticketsAbiertosCount,
        incidentesCiberseguridadRecientes: alertasSeguridadRecientes.length,
        cacheRamLru: this.cacheService.obtenerEstadisticasRam(),
      },
      demografiaCarreras: demografia.demografia.porCarrera,
      historiaPorGeneracion: demografia.historiaAcademica.porGeneracion,
    };
  }

  private calcularHashSha256Stream(rutaFisica: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(rutaFisica);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  // =========================================================================
  // 2. BARRIDO MASIVO DE SELLADO Y AUDITORÍA CRIPTOGRÁFICA SHA-256
  // =========================================================================
  async ejecutarBarridoSelladoSha256Masivo(
    idUsuarioAdmin: string,
    ipOrigen: string,
  ) {
    const archivosPendientes = await this.archivoDigitalRepo.find({
      where: { fechaBaja: IsNull() },
      relations: { expediente: true },
      order: { fechaCreacion: 'DESC' },
      take: 250,
    });

    let selladosNuevos = 0;
    let verificadosIntactos = 0;
    let anomaliasCriticas = 0;
    const detalleAnomalias: {
      numControl: string;
      nombreOriginal: string;
      problema: string;
    }[] = [];

    for (const archivo of archivosPendientes) {
      try {
        await fsPromises.access(archivo.rutaLocal, fs.constants.F_OK);

        const hashReal = await this.calcularHashSha256Stream(archivo.rutaLocal);

        if (!archivo.hashSha256 || archivo.hashSha256 === 'calculo_pendiente') {
          archivo.hashSha256 = hashReal;
          await this.archivoDigitalRepo.save(archivo);
          selladosNuevos++;
        } else if (archivo.hashSha256 === hashReal) {
          verificadosIntactos++;
        } else {
          anomaliasCriticas++;
          detalleAnomalias.push({
            numControl: archivo.expediente?.numControl || 'S/N',
            nombreOriginal: archivo.nombreOriginal,
            problema: 'TAMPERING_HASH_MISMATCH',
          });
        }
      } catch {
        anomaliasCriticas++;
        detalleAnomalias.push({
          numControl: archivo.expediente?.numControl || 'S/N',
          nombreOriginal: archivo.nombreOriginal,
          problema: 'ARCHIVO_NO_ENCONTRADO_EN_DISCO',
        });
      }
    }

    if (archivosPendientes[0]?.expediente?.idExpediente) {
      await this.auditoriaRepo.save(
        this.auditoriaRepo.create({
          expediente: {
            idExpediente: archivosPendientes[0].expediente.idExpediente,
          },
          usuarioAccion: { idUsuario: idUsuarioAdmin },
          tipoAccion: 'BARRIDO_MASIVO_SHA256_ADMIN',
          detallesCambio: {
            totalInspeccionados: archivosPendientes.length,
            selladosNuevos,
            verificadosIntactos,
            anomaliasCriticas,
            detalleAnomalias,
          },
          ipOrigen,
        }),
      );
    }

    return {
      totalInspeccionados: archivosPendientes.length,
      selladosNuevos,
      verificadosIntactos,
      anomaliasCriticas,
      detalleAnomalias,
      timestampAuditoria: new Date().toISOString(),
    };
  }

  // =========================================================================
  // 3. GOBIERNO DE OPERADORES ZERO-TRUST + PURGA INSTANTÁNEA EN RAM (LRU)
  // =========================================================================
  async listarOperadoresInstitucionales() {
    const usuarios = await this.usuarioRepo.find({
      withDeleted: true,
      relations: { rol: true },
      order: { fechaCreacion: 'DESC' },
    });

    const prestamosActivos = await this.prestamoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.usuarioSolicitante', 'u')
      .leftJoinAndSelect('p.estatusPrestamo', 'est')
      .where('est.idEstatusPrestamo IN (:...ids)', { ids: [1, 4] })
      .andWhere('p.fechaBaja IS NULL')
      .getMany();

    const conteoPorUsuario = new Map<string, number>();
    for (const p of prestamosActivos) {
      const idUsr = p.usuarioSolicitante?.idUsuario;
      if (idUsr) {
        conteoPorUsuario.set(idUsr, (conteoPorUsuario.get(idUsr) || 0) + 1);
      }
    }

    return usuarios.map((u) => ({
      idUsuario: u.idUsuario,
      uidFirebase: u.uidFirebase,
      email: u.email,
      nombreCompleto: u.nombreCompleto,
      rol: u.rol?.nombre || 'VENTANILLA',
      idRol: u.rol?.idRol || 4,
      departamento: u.departamento || 'Servicios Escolares ITD',
      trustScore: u.trustScore ?? 100,
      activo: !u.fechaBaja,
      fechaBaja: u.fechaBaja,
      ultimoAcceso: u.ultimoAcceso,
      fechaCreacion: u.fechaCreacion,
      carpetasEnCustodiaActual: conteoPorUsuario.get(u.idUsuario) || 0,
    }));
  }

  async crearOActualizarOperadorAdmin(dto: CrearOActualizarOperadorAdminDTO) {
    const nombreRolLimpio = dto.rolNombre.trim().toUpperCase();
    let rolEntidad = await this.rolRepo.findOne({
      where: { nombre: nombreRolLimpio },
    });

    if (!rolEntidad) {
      rolEntidad = await this.rolRepo.save(
        this.rolRepo.create({ nombre: nombreRolLimpio }),
      );
    }

    let usuario = await this.usuarioRepo.findOne({
      where: [
        { email: dto.email.trim() },
        { uidFirebase: dto.uidFirebase.trim() },
      ],
      withDeleted: true,
    });

    if (usuario) {
      usuario.nombreCompleto = dto.nombreCompleto.trim();
      usuario.email = dto.email.trim();
      usuario.uidFirebase = dto.uidFirebase.trim();
      usuario.rol = rolEntidad;
      usuario.departamento =
        dto.departamento || usuario.departamento || 'Servicios Escolares ITD';
      usuario.trustScore = dto.trustScore ?? usuario.trustScore ?? 100;
      usuario.fechaBaja = null as any;
    } else {
      usuario = this.usuarioRepo.create({
        uidFirebase: dto.uidFirebase.trim(),
        email: dto.email.trim(),
        nombreCompleto: dto.nombreCompleto.trim(),
        rol: rolEntidad,
        departamento: dto.departamento || 'Servicios Escolares ITD',
        trustScore: dto.trustScore ?? 100,
      });
    }

    const guardado = await this.usuarioRepo.save(usuario);
    // Purga inmediata en RAM para que JwtAuthGuard tome el nuevo rol al instante
    this.cacheService.delete(`user_identity_${guardado.uidFirebase}`);
    return guardado;
  }

  async cambiarEstadoORolOperador(
    idUsuario: string,
    dto: CambiarEstadoOperadorDTO,
  ) {
    const usuario = await this.usuarioRepo.findOne({
      where: { idUsuario },
      withDeleted: true,
      relations: { rol: true },
    });

    if (!usuario) {
      throw new NotFoundException(`No existe el operador con ID ${idUsuario}.`);
    }

    if (dto.rolNombre) {
      const nombreRolLimpio = dto.rolNombre.trim().toUpperCase();
      let rolEntidad = await this.rolRepo.findOne({
        where: { nombre: nombreRolLimpio },
      });
      if (!rolEntidad) {
        rolEntidad = await this.rolRepo.save(
          this.rolRepo.create({ nombre: nombreRolLimpio }),
        );
      }
      usuario.rol = rolEntidad;
    }

    if (dto.trustScore !== undefined) {
      usuario.trustScore = dto.trustScore;
    }

    if (dto.departamento !== undefined) {
      usuario.departamento = dto.departamento.trim();
    }

    if (dto.activo !== undefined) {
      usuario.fechaBaja = dto.activo ? (null as any) : new Date();
    }

    const actualizado = await this.usuarioRepo.save(usuario);
    // Invalida el caché LRU en memoria RAM inmediatamente
    this.cacheService.delete(`user_identity_${actualizado.uidFirebase}`);

    return {
      idUsuario: actualizado.idUsuario,
      nombreCompleto: actualizado.nombreCompleto,
      rol: actualizado.rol?.nombre,
      trustScore: actualizado.trustScore,
      activo: !actualizado.fechaBaja,
      cacheRamInvalidado: true,
    };
  }

  // =========================================================================
  // 4. ADUANA FÍSICA SUPREMA: PRÉSTAMOS GLOBALES, NO REPUDIO Y RELEVO FORZOSO
  // =========================================================================
  async listarTodosLosPrestamosActivosGlobal() {
    const prestamos = await this.prestamoRepo
      .createQueryBuilder('prestamo')
      .innerJoinAndSelect('prestamo.expediente', 'expediente')
      .leftJoinAndSelect('expediente.persona', 'persona')
      .leftJoinAndSelect('expediente.carrera', 'carrera')
      .innerJoinAndSelect('prestamo.estatusPrestamo', 'estatus')
      .leftJoinAndSelect('prestamo.motivo', 'motivo')
      .leftJoinAndSelect('prestamo.usuarioSolicitante', 'solicitante')
      .leftJoinAndSelect('prestamo.usuarioAutoriza', 'autoriza')
      .where('estatus.idEstatusPrestamo IN (:...estados)', { estados: [1, 4] })
      .andWhere('prestamo.fechaBaja IS NULL')
      .orderBy('prestamo.fechaCreacion', 'DESC')
      .getMany();

    const ahoraMs = Date.now();
    const SLA_48H_MS = 48 * 60 * 60 * 1000;

    return prestamos.map((p) => {
      const refMs = p.fechaSalida
        ? new Date(p.fechaSalida).getTime()
        : new Date(p.fechaCreacion).getTime();
      const horasTranscurridas = Math.round(
        (ahoraMs - refMs) / (1000 * 60 * 60),
      );

      return {
        ...p,
        horasTranscurridas,
        excedeSla48Horas:
          horasTranscurridas > 48 && p.estatusPrestamo?.idEstatusPrestamo === 4,
      };
    });
  }

  /**
   * El Administrador asigna directamente la custodia de un expediente a un operador
   * y dispara una alerta de No Repudio con el código OTP directo a la campana del operador.
   */
  async asignarCustodiaDirectaConNoRepudio(
    dto: AsignarCustodiaNoRepudioAdminDTO,
    usuarioAdmin: UsuarioEntity,
    ipOrigen: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // A) En asignarCustodiaDirectaConNoRepudio:
      const matriculaLimpia = dto.numControl.trim().toUpperCase();

      // 1. Fase de bloqueo (sin relaciones LEFT JOIN)
      const expedienteLock = await queryRunner.manager.findOne(
        ExpedienteEntity,
        {
          select: { idExpediente: true },
          where: { numControl: matriculaLimpia },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        },
      );

      if (!expedienteLock) {
        throw new NotFoundException(
          `No existe el expediente con matrícula ${dto.numControl}.`,
        );
      }

      // 2. Fase de extracción con relación a persona
      const expediente = await queryRunner.manager.findOne(ExpedienteEntity, {
        where: { idExpediente: expedienteLock.idExpediente },
        relations: { persona: true },
      });

      if (!expediente) {
        throw new NotFoundException(
          `No existe el expediente con matrícula ${dto.numControl}.`,
        );
      }

      const operadorDestino = await queryRunner.manager.findOne(UsuarioEntity, {
        where: { idUsuario: dto.idUsuarioOperadorDestino, fechaBaja: IsNull() },
      });

      if (!operadorDestino) {
        throw new NotFoundException(
          'El operador destino seleccionado no existe o está inactivo.',
        );
      }

      const prestamoAbierto = await queryRunner.manager.findOne(
        PrestamoEntity,
        {
          where: [
            {
              expediente: { idExpediente: expediente.idExpediente },
              estatusPrestamo: { idEstatusPrestamo: 1 },
            },
            {
              expediente: { idExpediente: expediente.idExpediente },
              estatusPrestamo: { idEstatusPrestamo: 4 },
            },
          ],
        },
      );

      if (prestamoAbierto) {
        throw new ConflictException(
          `El expediente ${expediente.numControl} ya tiene el préstamo activo ${prestamoAbierto.folio}. Usa el Relevo Forzoso si deseas reasignarlo.`,
        );
      }

      const otpPlano = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        specialChars: false,
        lowerCaseAlphabets: false,
      });
      const salt = await bcrypt.genSalt(10);
      const otpHashed = await bcrypt.hash(otpPlano, salt);

      const fechaExpiracionOtp = new Date();
      fechaExpiracionOtp.setHours(fechaExpiracionOtp.getHours() + 24);

      const folioPrestamo = `PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const nuevoPrestamo = queryRunner.manager.create(PrestamoEntity, {
        folio: folioPrestamo,
        expediente: { idExpediente: expediente.idExpediente },
        usuarioSolicitante: { idUsuario: operadorDestino.idUsuario },
        usuarioAutoriza: { idUsuario: usuarioAdmin.idUsuario },
        motivo: { idMotivo: dto.idMotivo || 5 }, // 5 = Auditoría de Jefatura
        estatusPrestamo: { idEstatusPrestamo: 1 }, // 1 = SOLICITADO (Requiere firma OTP del operador)
        observacionesSalida:
          dto.observacionesJefatura ||
          `Asignación de Custodia Oficial por Jefatura (${usuarioAdmin.nombreCompleto})`,
        otpHashed,
        otpExpiracion: fechaExpiracionOtp,
      });

      await queryRunner.manager.save(nuevoPrestamo);

      // Registro en Caja Negra Forense
      await queryRunner.manager.save(
        ExpedienteAuditoriaEntity,
        queryRunner.manager.create(ExpedienteAuditoriaEntity, {
          expediente: { idExpediente: expediente.idExpediente },
          usuarioAccion: { idUsuario: usuarioAdmin.idUsuario },
          tipoAccion: 'ASIGNACION_CUSTODIA_NO_REPUDIO_ADMIN',
          detallesCambio: {
            folioPrestamo,
            operadorAsignado: operadorDestino.email,
            motivo: dto.observacionesJefatura || 'Auditoría de Jefatura',
          },
          ipOrigen,
        }),
      );

      await queryRunner.commitTransaction();

      const nombreAlumno = [
        expediente.persona?.nombre,
        expediente.persona?.primerApellido,
        expediente.persona?.segundoApellido,
      ]
        .filter((v) => v && v.toUpperCase() !== 'N/A')
        .join(' ');

      // Dispara la alerta de No Repudio OTP directo a la campana del operador
      await this.notificacionService.emitirAlertaNoRepudioCustodia({
        idUsuarioVentanillaDestino: operadorDestino.idUsuario,
        nombreAdminAutoriza: usuarioAdmin.nombreCompleto,
        numControl: expediente.numControl,
        nombreAlumno: nombreAlumno || expediente.numControl,
        folioPrestamo,
        codigoOtp: otpPlano,
      });

      return {
        folio: folioPrestamo,
        numControl: expediente.numControl,
        operadorAsignado: operadorDestino.nombreCompleto,
        otpGenerado: otpPlano,
        expira: fechaExpiracionOtp,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Fallo al asignar la custodia con No Repudio OTP.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Relevo Forzoso o Devolución de Oficio por el Administrador (rescate de carpetas huérfanas)
   */
  async ejecutarRelevoCustodiaForzosaAdmin(
    folioPrestamo: string,
    dto: RelevoCustodiaForzosaAdminDTO,
    usuarioAdmin: UsuarioEntity,
    ipOrigen: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // B) En ejecutarRelevoCustodiaForzosaAdmin:
      const prestamoLock = await queryRunner.manager
        .createQueryBuilder(PrestamoEntity, 'prestamo')
        .select('prestamo.idPrestamo')
        .where('prestamo.folio = :folio', { folio: folioPrestamo.trim() })
        .setLock('pessimistic_write')
        .getOne();

      if (!prestamoLock) {
        throw new NotFoundException(
          `No se encontró el préstamo con folio ${folioPrestamo}.`,
        );
      }

      const prestamo = await queryRunner.manager
        .createQueryBuilder(PrestamoEntity, 'prestamo')
        .innerJoinAndSelect('prestamo.expediente', 'expediente')
        .innerJoinAndSelect('prestamo.estatusPrestamo', 'estatusPrestamo')
        .leftJoinAndSelect('prestamo.usuarioSolicitante', 'solicitante')
        .where('prestamo.idPrestamo = :id', { id: prestamoLock.idPrestamo })
        .getOne();

      if (!prestamo) {
        throw new NotFoundException(
          `No se encontró el préstamo con folio ${folioPrestamo}.`,
        );
      }

      const custodioAnterior =
        prestamo.usuarioSolicitante?.email || 'DESCONOCIDO';

      if (dto.tipoAccion === 'DEVOLVER_BOVEDA') {
        prestamo.estatusPrestamo = { idEstatusPrestamo: 5 } as any; // 5 = DEVUELTO
        prestamo.estadoConservacionRetorno = {
          idEstado: dto.idEstadoConservacionRetorno || 1,
        } as any;
        prestamo.observacionesRetorno = `[CHECK-IN FORZOSO JEFATURA] ${dto.motivoForense}`;
        prestamo.fechaRetorno = new Date();
        prestamo.otpHashed = null;
        prestamo.otpExpiracion = null;
      } else {
        if (!dto.idNuevoUsuarioCustodio) {
          throw new BadRequestException(
            'Debes indicar el nuevo operador custodio para transferir el préstamo.',
          );
        }
        prestamo.usuarioSolicitante = {
          idUsuario: dto.idNuevoUsuarioCustodio,
        } as any;
        prestamo.usuarioAutoriza = { idUsuario: usuarioAdmin.idUsuario } as any;
        prestamo.observacionesSalida = `${prestamo.observacionesSalida || ''} | [RELEVO ADMIN: ${dto.motivoForense}]`;
      }

      await queryRunner.manager.save(prestamo);

      await queryRunner.manager.save(
        ExpedienteAuditoriaEntity,
        queryRunner.manager.create(ExpedienteAuditoriaEntity, {
          expediente: { idExpediente: prestamo.expediente.idExpediente },
          usuarioAccion: { idUsuario: usuarioAdmin.idUsuario },
          tipoAccion: `RELEVO_CUSTODIA_${dto.tipoAccion}`,
          detallesCambio: {
            folioPrestamo: prestamo.folio,
            custodioAnterior,
            nuevoCustodio: dto.idNuevoUsuarioCustodio || 'BOVEDA_CENTRAL',
            motivoForense: dto.motivoForense,
          },
          ipOrigen,
        }),
      );

      await queryRunner.commitTransaction();

      return {
        folio: prestamo.folio,
        numControl: prestamo.expediente.numControl,
        accionEjecutada: dto.tipoAccion,
        mensaje:
          dto.tipoAccion === 'DEVOLVER_BOVEDA'
            ? 'El expediente fue reingresado de oficio a la bóveda central y quedó libre de bloqueos.'
            : 'La custodia física del expediente fue transferida exitosamente al nuevo operador.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al ejecutar el relevo forzoso de custodia.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // =========================================================================
  // 5. ARBITRAJE SUPREMO DEL GRAFO FSM DE TITULACIÓN (OVERRIDE Y ROLLBACK)
  // =========================================================================
  async forzarTransicionFsmAdmin(
    idTramite: string,
    dto: ForzarTransicionFsmAdminDTO,
    usuarioAdmin: UsuarioEntity,
    ipOrigen: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // C) En forzarTransicionFsmAdmin:
      const tramiteLock = await queryRunner.manager
        .createQueryBuilder(TramiteTitulacionEntity, 'tramite')
        .select('tramite.idTramite')
        .where('tramite.idTramite = :idTramite', { idTramite })
        .setLock('pessimistic_write')
        .getOne();

      if (!tramiteLock) {
        throw new NotFoundException(
          `No se encontró el trámite con ID ${idTramite}.`,
        );
      }

      const tramite = await queryRunner.manager
        .createQueryBuilder(TramiteTitulacionEntity, 'tramite')
        .innerJoinAndSelect('tramite.expediente', 'expediente')
        .leftJoinAndSelect('tramite.firmasSinodo', 'firmas')
        .where('tramite.idTramite = :idTramite', {
          idTramite: tramiteLock.idTramite,
        })
        .getOne();
        
      if (!tramite) {
        throw new NotFoundException(
          `No se encontró el trámite con ID ${idTramite}.`,
        );
      }

      const mapaProgreso: Record<EstadoTitulacion, number> = {
        [EstadoTitulacion.PASO_1_REGISTRO]: 12.5,
        [EstadoTitulacion.PASO_3_TRIAGE_DOCS]: 25.0,
        [EstadoTitulacion.PASO_4_PAGO_EXAMEN]: 37.5,
        [EstadoTitulacion.PASO_5_CARTA_NO_INCONVENIENCIA]: 50.0,
        [EstadoTitulacion.PASO_6_EXAMEN_PROGRAMADO]: 62.5,
        [EstadoTitulacion.PASO_7_FIRMAS_ACTA]: 75.0,
        [EstadoTitulacion.PASO_8_TRAMITE_SEP]: 87.5,
        [EstadoTitulacion.FINALIZADO_ENTREGADO]: 100.0,
      };

      const estadoAnterior = tramite.estatusActual;
      const progresoAnterior = tramite.progresoPorcentaje;

      tramite.estatusActual = dto.estadoDestino;
      tramite.progresoPorcentaje =
        mapaProgreso[dto.estadoDestino] ?? tramite.progresoPorcentaje;

      if (
        mapaProgreso[dto.estadoDestino] &&
        mapaProgreso[dto.estadoDestino] >= 37.5
      ) {
        tramite.documentosValidados = true;
      }

      const historialNotasMarginales = Array.isArray(
        tramite.pagosConciliados?.notasMarginalesJefatura,
      )
        ? tramite.pagosConciliados.notasMarginalesJefatura
        : [];

      historialNotasMarginales.unshift({
        fechaIso: new Date().toISOString(),
        autorizadoPor: usuarioAdmin.nombreCompleto,
        estadoOrigen: estadoAnterior,
        estadoDestino: dto.estadoDestino,
        folioOficio: dto.folioOficioAutorizacion || 'S/F',
        justificacionLegal: dto.justificacionLegal,
      });

      tramite.pagosConciliados = {
        ...(tramite.pagosConciliados || {}),
        ...(dto.metadatosOverride || {}),
        notasMarginalesJefatura: historialNotasMarginales,
        ultimaIntervencionAdmin: new Date().toISOString(),
      };

      const tramiteGuardado = await queryRunner.manager.save(tramite);

      // Inyección inmutable en la Caja Negra de Auditoría
      await queryRunner.manager.save(
        ExpedienteAuditoriaEntity,
        queryRunner.manager.create(ExpedienteAuditoriaEntity, {
          expediente: { idExpediente: tramite.expediente.idExpediente },
          usuarioAccion: { idUsuario: usuarioAdmin.idUsuario },
          tipoAccion: 'ARBITRAJE_OVERRIDE_FSM_TITULACION',
          detallesCambio: {
            folioTramite: tramite.folio,
            antes: {
              estatusActual: estadoAnterior,
              progreso: progresoAnterior,
            },
            despues: {
              estatusActual: dto.estadoDestino,
              progreso: tramiteGuardado.progresoPorcentaje,
            },
            folioOficioAutorizacion:
              dto.folioOficioAutorizacion || 'OFICIO_INTERNO_JEFATURA',
            justificacionLegal: dto.justificacionLegal,
          },
          ipOrigen,
        }),
      );

      await queryRunner.commitTransaction();
      return tramiteGuardado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Fallo al ejecutar el arbitraje administrativo sobre la Máquina de Estados.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Libera el candado FinOps diario de Verificamex RENAPO para un número de control específico
   */
  async liberarCandadoDiarioRenapoAdmin(
    numControl: string,
    usuarioAdmin: UsuarioEntity,
    ipOrigen: string,
  ) {
    const matricula = numControl.trim().toUpperCase();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tramiteLock = await queryRunner.manager
        .createQueryBuilder(TramiteTitulacionEntity, 'tramite')
        .innerJoin('tramite.expediente', 'exp')
        .select('tramite.idTramite')
        .where('UPPER(exp.numControl) = :matricula', { matricula })
        .orderBy('tramite.fechaCreacion', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      if (!tramiteLock) {
        throw new NotFoundException(
          `No se encontró trámite de titulación para la matrícula ${matricula}.`,
        );
      }

      const tramite = await queryRunner.manager.findOne(
        TramiteTitulacionEntity,
        {
          where: { idTramite: tramiteLock.idTramite },
          relations: { expediente: true },
        },
      );

      const meta = { ...(tramite!.pagosConciliados || {}) };
      delete meta.renapoUltimaFechaDia;
      meta.candadoRenapoLiberadoPor = usuarioAdmin.nombreCompleto;
      tramite!.pagosConciliados = meta;

      await queryRunner.manager.save(TramiteTitulacionEntity, tramite!);

      await queryRunner.manager.save(
        ExpedienteAuditoriaEntity,
        queryRunner.manager.create(ExpedienteAuditoriaEntity, {
          expediente: { idExpediente: tramite!.expediente.idExpediente },
          usuarioAccion: { idUsuario: usuarioAdmin.idUsuario },
          tipoAccion: 'LIBERACION_CANDADO_FINOPS_RENAPO',
          detallesCambio: {
            numControl: matricula,
            folioTramite: tramite!.folio,
            autorizadoPor: usuarioAdmin.email,
          },
          ipOrigen,
        }),
      );

      await queryRunner.commitTransaction();

      return {
        numControl: matricula,
        mensaje: `Candado FinOps diario liberado. El operador ya puede ejecutar una nueva validación oficial en RENAPO para ${matricula}.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Fallo al liberar el candado FinOps de RENAPO.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // =========================================================================
  // 6. GOBIERNO DEL CATÁLOGO DE SINODALES Y RECTIFICACIÓN DE IDENTIDAD
  // =========================================================================
  async listarTodosLosSinodalesAdmin() {
    return await this.sinodalRepo.find({
      order: { activo: 'DESC', nombreCompleto: 'ASC' },
    });
  }

  async actualizarSinodalAdmin(
    idSinodal: string,
    dto: ActualizarSinodalAdminDTO,
  ) {
    const sinodal = await this.sinodalRepo.findOne({ where: { idSinodal } });
    if (!sinodal) {
      throw new NotFoundException(
        `No se encontró el sinodal con ID ${idSinodal}.`,
      );
    }

    if (dto.gradoAcademico !== undefined)
      sinodal.gradoAcademico = dto.gradoAcademico.trim();
    if (dto.nombreCompleto !== undefined)
      sinodal.nombreCompleto = dto.nombreCompleto.trim();
    if (dto.departamento !== undefined)
      sinodal.departamento = dto.departamento.trim();
    if (dto.claveEmpleado !== undefined)
      sinodal.claveEmpleado = dto.claveEmpleado.trim();
    if (dto.activo !== undefined) sinodal.activo = dto.activo;

    return await this.sinodalRepo.save(sinodal);
  }

  async rectificarIdentidadPersonaAdmin(
    dto: SaneamientoIdentidadAdminDTO,
    usuarioAdmin: UsuarioEntity,
    ipOrigen: string,
  ) {
    const expediente = await this.expedienteRepo.findOne({
      where: { numControl: dto.numControl.trim().toUpperCase() },
      relations: { persona: true },
    });

    if (!expediente || !expediente.persona) {
      throw new NotFoundException(
        `No se encontró el expediente o persona para la matrícula ${dto.numControl}.`,
      );
    }

    const persona = expediente.persona;
    const estadoAnterior = {
      curp: persona.curp,
      nombre: persona.nombre,
      primerApellido: persona.primerApellido,
      segundoApellido: persona.segundoApellido,
    };

    const nuevaCurp = dto.curpOficial.trim().toUpperCase();
    const duplicada = await this.personaRepo
      .createQueryBuilder('p')
      .where('UPPER(p.curp) = :curp', { curp: nuevaCurp })
      .andWhere('p.idPersona != :idActual', { idActual: persona.idPersona })
      .getOne();

    if (!duplicada) {
      persona.curp = nuevaCurp;
    }

    persona.nombre = dto.nombre.trim().toUpperCase();
    persona.primerApellido = dto.primerApellido.trim().toUpperCase();
    persona.segundoApellido = (dto.segundoApellido || '').trim().toUpperCase();

    const personaGuardada = await this.personaRepo.save(persona);

    await this.auditoriaRepo.save(
      this.auditoriaRepo.create({
        expediente: { idExpediente: expediente.idExpediente },
        usuarioAccion: { idUsuario: usuarioAdmin.idUsuario },
        tipoAccion: 'RECTIFICACION_JURIDICA_IDENTIDAD',
        detallesCambio: {
          antes: estadoAnterior,
          despues: {
            curp: personaGuardada.curp,
            nombre: personaGuardada.nombre,
            primerApellido: personaGuardada.primerApellido,
            segundoApellido: personaGuardada.segundoApellido,
          },
          motivoRectificacion: dto.motivoRectificacion,
        },
        ipOrigen,
      }),
    );

    return personaGuardada;
  }

  // =========================================================================
  // 7. GOBIERNO DE CONVENIOS B2B (GENERACIÓN DE LLAVES API ZERO-TRUST)
  // =========================================================================
  async listarConveniosInteroperabilidad() {
    return await this.convenioRepo.find({
      order: { fechaCreacion: 'DESC' },
    });
  }

  async crearConvenioInteroperabilidadAdmin(dto: CrearConvenioB2BAdminDTO) {
    // Generamos la API Key plana que el Administrador entregará a la institución externa
    const entropiaHex = crypto.randomBytes(18).toString('hex').toUpperCase();
    const apiKeyPlanaUnicaVez = `ITD_B2B_LIVE_${entropiaHex}`;

    // En la base de datos jamás se guarda la llave plana, solo su hash SHA-256
    const apiKeyHash = crypto
      .createHash('sha256')
      .update(apiKeyPlanaUnicaVez)
      .digest('hex');

    const nuevoConvenio = this.convenioRepo.create({
      nombreEmpresa: dto.nombreEmpresa.trim(),
      folioOficioLegal: dto.folioOficioLegal.trim().toUpperCase(),
      apiKeyHash,
      limiteDiarioPeticiones: dto.limiteDiarioPeticiones,
      activo: true,
      motivoBloqueo: null as any,
      fechaVencimiento: new Date(dto.fechaVencimiento),
    });

    const guardado = await this.convenioRepo.save(nuevoConvenio);

    return {
      convenio: guardado,
      apiKeyPlanaMostrarUnaSolaVez: apiKeyPlanaUnicaVez,
      advertenciaZeroTrust:
        'Copia esta llave x-api-key ahora. Por seguridad Zero-Trust sólo se almacena su hash SHA-256 en PostgreSQL.',
    };
  }

  async recargarOReactivarConvenioB2B(
    idConvenio: string,
    body: { nuevaCuotaDiaria?: number; activo?: boolean },
  ) {
    const convenio = await this.convenioRepo.findOne({ where: { idConvenio } });
    if (!convenio) {
      throw new NotFoundException(
        `No existe el convenio con ID ${idConvenio}.`,
      );
    }

    if (body.nuevaCuotaDiaria !== undefined) {
      convenio.limiteDiarioPeticiones = body.nuevaCuotaDiaria;
    }
    if (body.activo !== undefined) {
      convenio.activo = body.activo;
      if (body.activo) {
        convenio.motivoBloqueo = null as any;
      }
    }

    return await this.convenioRepo.save(convenio);
  }

  // =========================================================================
  // 8. ORQUESTADOR DE COLAS BULLMQ, GOOGLE DRIVE Y CAJA NEGRA DE SEGURIDAD
  // =========================================================================
  async obtenerEstadoColasYAlmacenamientoHibrido() {
    const [conteosDigitalizacion, conteosTitulacion, driveConectado] =
      await Promise.all([
        this.digitalizacionQueue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ),
        this.titulacionQueue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ),
        this.driveService.probarConexion().catch(() => false),
      ]);

    return {
      colasBullMq: {
        digitalizacionOcrQueue: conteosDigitalizacion,
        titulacionRpaSepQueue: conteosTitulacion,
      },
      bovedaNubeGoogleDrive: {
        enlaceOauthServiceAccountActivo: driveConectado,
        rootFolderIdConfigurado: Boolean(
          this.configService.get<string>('GOOGLE_DRIVE_ROOT_FOLDER_ID'),
        ),
      },
      cacheLruRam: this.cacheService.obtenerEstadisticasRam(),
    };
  }

  async reintentarTrabajosFallidosBullMq() {
    const [fallidosDig, fallidosTit] = await Promise.all([
      this.digitalizacionQueue.getFailed(0, 50),
      this.titulacionQueue.getFailed(0, 50),
    ]);

    let reintentados = 0;
    for (const job of [...fallidosDig, ...fallidosTit]) {
      try {
        await job.retry();
        reintentados++;
      } catch (err) {
        this.logger.warn(`No se pudo reintentar el job ${job.id}: ${err}`);
      }
    }

    return {
      totalReintentados: reintentados,
      mensaje: `Se reencolaron ${reintentados} trabajo(s) en los workers de BullMQ.`,
    };
  }

  /**
   * Respalda bajo demanda los PDFs de un expediente hacia la Bóveda Híbrida en Google Drive
   */
  async respaldarExpedienteEnGoogleDriveAdmin(numControl: string) {
    const matricula = numControl.trim().toUpperCase();
    const expediente = await this.expedienteRepo.findOne({
      where: { numControl: matricula },
      relations: { archivosDigitales: true },
    });

    if (!expediente) {
      throw new NotFoundException(`No existe el expediente ${matricula}.`);
    }

    const archivos = (expediente.archivosDigitales || []).filter(
      (a) => !a.fechaBaja,
    );
    if (archivos.length === 0) {
      throw new BadRequestException(
        `El expediente ${matricula} no tiene archivos digitales para respaldar en Google Drive.`,
      );
    }

    const idCarpetaDrive =
      await this.driveService.obtenerOCrearCarpetaExpediente(
        `EXP_${matricula}`,
      );

    const respaldados: {
      nombre: string;
      idDrive: string;
      urlVisor?: string | null;
    }[] = [];

    for (const arc of archivos) {
      const resultado = await this.driveService.subirArchivoDesdeDisco(
        arc.rutaLocal,
        'application/pdf',
        idCarpetaDrive,
        arc.nombreOriginal,
      );
      respaldados.push({
        nombre: arc.nombreOriginal,
        idDrive: resultado.idDrive,
        urlVisor: resultado.urlVisor,
      });
    }

    return {
      numControl: matricula,
      idCarpetaDrive,
      totalRespaldados: respaldados.length,
      archivos: respaldados,
    };
  }

  async listarBitacoraGlobalYAlertasSeguridad() {
    const [eventosForenses, alertasCiberseguridad] = await Promise.all([
      this.auditoriaRepo.find({
        relations: { expediente: true, usuarioAccion: true },
        order: { fechaAccion: 'DESC' },
        take: 80,
      }),
      this.alertaSeguridadRepo.find({
        relations: { usuarioSospechoso: true },
        order: { fechaIncidente: 'DESC' },
        take: 50,
      }),
    ]);

    return {
      eventosForenses: eventosForenses.map((ev) => ({
        idAuditoria: ev.idAuditoria,
        numControl: ev.expediente?.numControl || 'GLOBAL',
        tipoAccion: ev.tipoAccion,
        responsable:
          ev.usuarioAccion?.nombreCompleto ||
          ev.usuarioAccion?.email ||
          'SISTEMA',
        ipOrigen: ev.ipOrigen,
        fechaAccion: ev.fechaAccion,
        detallesCambio: ev.detallesCambio,
      })),
      alertasCiberseguridad,
    };
  }
}
