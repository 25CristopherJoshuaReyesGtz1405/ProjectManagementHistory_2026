import { Injectable, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EstadoTitulacion, validarTransicionFSM } from '../Constant/FSM_Titulacion.js';
import { ExpedienteEntity } from '../Entities/ExpedienteEntity.js';
import { FirmaSinodalEntity } from '../Entities/FirmaSinodalEntity.js';
import { TramiteTitulacionEntity } from '../Entities/TramiteTitulacionEntity.js';

// Importa tu servicio de auditoría aquí o despacha los eventos a BullMQ

@Injectable()
export class TitulacionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) {}

  // =======================================================
  // 1. GATEKEEPER Y CREACIÓN DE TRÁMITE (ACID)
  // =======================================================
  async iniciarTramiteTitulacion(numeroControl: string, idUsuarioSolicitante: string, ipOrigen: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Bloqueo pesimista para evitar que el mismo alumno inicie 2 trámites dando doble clic
      const expediente = await queryRunner.manager.createQueryBuilder(ExpedienteEntity, 'exp')
        .leftJoinAndSelect('exp.titulacion', 'reqs')
        .where('exp.numControl = :numeroControl', { numeroControl })
        .andWhere('exp.fechaBaja IS NULL')
        .setLock('pessimistic_write', undefined, ['exp'])
        .getOne();

      if (!expediente) throw new NotFoundException('Expediente no localizado en el acervo.');

      // Validación estricta Zero-Trust de créditos
      const reqs = expediente.titulacion;
      if (!reqs || !reqs.inglesB1 || !reqs.servicioSocial || !reqs.residenciaProfesional) {
        throw new ConflictException('Bloqueo Operativo: El egresado no ha liberado los créditos complementarios obligatorios.');
      }

      // Verificamos si ya existe un trámite activo
      const tramitePrevio = await queryRunner.manager.findOne(TramiteTitulacionEntity, {
        where: { expediente: { idExpediente: expediente.idExpediente } },
        order: { fechaCreacion: 'DESC' }
      });

      if (tramitePrevio && tramitePrevio.estatusActual !== EstadoTitulacion.FINALIZADO_ENTREGADO) {
        throw new ConflictException('Inconsistencia: Ya existe una instancia de titulación activa para esta matrícula.');
      }

      // Generación del Folio Seguro
      const folioTramite = `TIT_${numeroControl}_${Date.now()}`;

      const nuevoTramite = queryRunner.manager.create(TramiteTitulacionEntity, {
        folio: folioTramite,
        expediente: { idExpediente: expediente.idExpediente },
        usuarioSolicitante: { idUsuario: idUsuarioSolicitante },
        estatusActual: EstadoTitulacion.PASO_1_REGISTRO,
        progresoPorcentaje: 12.5,
        documentosValidados: false,
      });

      const tramiteGuardado = await queryRunner.manager.save(nuevoTramite);

      // Aquí puedes llamar a tu método registrarEventoForense del ExpedienteService
      
      await queryRunner.commitTransaction();
      return tramiteGuardado;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Fallo crítico al inicializar la Máquina de Estados de Titulación.');
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
    idUsuarioSinodal: string,
    ipOrigen: string
  ) {
    let quorumCompletado = false;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Bloqueamos la FSM completa para evitar Race Conditions (Ej. 2 maestros firman el mismo milisegundo)
      const tramite = await queryRunner.manager.createQueryBuilder(TramiteTitulacionEntity, 'tramite')
        .leftJoinAndSelect('tramite.firmasSinodo', 'firmas')
        .where('tramite.idTramite = :idTramite', { idTramite })
        .setLock('pessimistic_write', undefined, ['tramite'])
        .getOne();

      if (!tramite) throw new NotFoundException('Instancia de titulación no encontrada.');

      // 1. Verificación de Estado (Solo se firma en el PASO 7)
      if (tramite.estatusActual !== EstadoTitulacion.PASO_7_FIRMAS_ACTA) {
        throw new ConflictException('El trámite no se encuentra en fase de validación sinodal.');
      }

      const firmasActuales = tramite.firmasSinodo || [];
      
      // 2. Verificación de Duplicidad de Rol (Idempotencia)
      if (firmasActuales.some(f => f.rolSinodal === rolSinodal)) {
        throw new ConflictException(`Fallo de Consenso: El rol de ${rolSinodal} ya fue firmado en esta acta.`);
      }
      
      // 3. Verificación de Duplicidad de Identidad (Un maestro no puede ser Presidente y Vocal a la vez)
      if (firmasActuales.some(f => f.sinodal.idUsuario === idUsuarioSinodal)) {
        throw new ConflictException('Violación de Smart Contract: Un sínodo no puede firmar dos roles distintos en la misma acta.');
      }

      // 4. Sello Criptográfico (Firma digital simulada usando un SALT maestro del servidor)
      const masterSecret = this.configService.get<string>('SIGAH_CRYPTO_SECRET', 'DEFAULT_SALT_SECURE');
      const selloCriptografico = crypto
        .createHash('sha256')
        .update(`${tramite.idTramite}|${idUsuarioSinodal}|${pinFirmaPlano}|${masterSecret}`)
        .digest('hex');

      // 5. Inserción de la Firma en su Entidad Relacional Independiente
      const nuevaFirma = queryRunner.manager.create(FirmaSinodalEntity, {
        tramite: { idTramite: tramite.idTramite },
        sinodal: { idUsuario: idUsuarioSinodal },
        rolSinodal: rolSinodal,
        selloCriptografico: selloCriptografico,
        ipOrigen: ipOrigen
      });
      await queryRunner.manager.save(nuevaFirma);
      
      // Añadimos a la colección local para la comprobación del Quórum
      firmasActuales.push(nuevaFirma);

      // 6. EVALUACIÓN DEL SMART CONTRACT (Quórum de 3 firmas)
      if (firmasActuales.length === 3) {
        quorumCompletado = true;
        validarTransicionFSM(tramite.estatusActual as EstadoTitulacion, EstadoTitulacion.PASO_8_TRAMITE_SEP);
        
        tramite.estatusActual = EstadoTitulacion.PASO_8_TRAMITE_SEP;
        tramite.progresoPorcentaje = 87.5;
        // La versión de TypeORM mutará automáticamente en el .save()
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
}