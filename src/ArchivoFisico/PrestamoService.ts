import { Injectable, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as otpGenerator from 'otp-generator';
import * as bcrypt from 'bcrypt';

import { ExpedienteEntity } from '../Academico/Entities/ExpedienteEntity.js';
import { SolicitarPrestamoDTO } from './DTOs/SolicitarPrestamoDTO.js';
import { PrestamoEntity } from './Entities/PrestamoEntity.js';

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
}