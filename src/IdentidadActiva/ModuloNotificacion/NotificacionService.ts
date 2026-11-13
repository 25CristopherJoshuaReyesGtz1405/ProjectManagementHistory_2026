import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { NotificacionEntity } from '../Entities/NotificacionEntity.js';
import { UsuarioEntity } from '../Entities/UsuarioEntity.js';

@Injectable()
export class NotificacionService {
  constructor(private readonly dataSource: DataSource) {}

  // =======================================================
  // 1. BANDEJA DE ENTRADA: OBTENER ALERTAS ACTIVAS
  // =======================================================
  async obtenerAlertasNoLeidas(uidFirebase: string) {
    const usuario = await this.dataSource
      .getRepository(UsuarioEntity)
      .findOne({ where: { uidFirebase, fechaBaja: IsNull() } });

    if (!usuario) throw new ForbiddenException('Credenciales revocadas o usuario inactivo.');

    return await this.dataSource.getRepository(NotificacionEntity).find({
      where: {
        usuarioDestino: { idUsuario: usuario.idUsuario },
        leida: false
      },
      order: { fechaEmision: 'DESC' }
    });
  }

  // =======================================================
  // 2. INTERACCIÓN: MARCAR COMO LEÍDA (DISMISS ZERO-TRUST)
  // =======================================================
  async marcarComoLeida(idNotificacion: string, uidFirebase: string) {
    const usuario = await this.dataSource
      .getRepository(UsuarioEntity)
      .findOne({ where: { uidFirebase } });

    const notificacion = await this.dataSource.getRepository(NotificacionEntity).findOne({
      where: {
        idNotificacion,
        usuarioDestino: { idUsuario: usuario?.idUsuario }
      }
    });

    if (!notificacion) {
      throw new NotFoundException('Fallo de seguridad: Alerta inexistente o perteneciente a otro usuario.');
    }

    notificacion.leida = true;
    return await this.dataSource.getRepository(NotificacionEntity).save(notificacion);
  }

  // =======================================================
  // 3. NUEVO: CREAR ALERTA DE NO REPUDIO (SALIDA POR ADMIN)
  // =======================================================
  async emitirAlertaNoRepudioCustodia(params: {
    idUsuarioVentanillaDestino: string;
    nombreAdminAutoriza: string;
    numControl: string;
    nombreAlumno: string;
    folioPrestamo: string;
    codigoOtp: string;
  }) {
    const titulo = `Firma de No Repudio Requerida • ${params.folioPrestamo}`;
    const mensaje =
      `El Administrador (${params.nombreAdminAutoriza}) asignó el expediente [${params.numControl}] (${params.nombreAlumno}) bajo tu custodia. ` +
      `Folio: [${params.folioPrestamo}] | Código OTP: [${params.codigoOtp}].`;

    const metadataEnlace = {
      esNoRepudioOtp: true,
      folio: params.folioPrestamo,
      numControl: params.numControl,
      otp: params.codigoOtp,
      autorizadoPor: params.nombreAdminAutoriza
    };

    const resultado = await this.dataSource.query(
      `INSERT INTO "identidad"."notificacion_usuario"
        ("titulo", "mensaje", "tipo_alerta", "metadata_enlace", "leida", "fecha_emision", "id_usuario_destino")
       VALUES ($1, $2, $3, $4, false, NOW(), $5)
       RETURNING *`,
      [
        titulo,
        mensaje,
        'NO_REPUDIO_OTP',
        JSON.stringify(metadataEnlace),
        params.idUsuarioVentanillaDestino
      ]
    );

    return resultado[0];
  }

  // 1. Llamar dentro de solicitarPrestamo() en tu PrestamoService tras guardar el préstamo en estatus 1 (SOLICITADO):
  async emitirAlertaSolicitudPrestamoIncompleta(params: {
    idUsuarioSolicita: string;
    numControl: string;
    nombreAlumno: string;
    folioPrestamo: string;
    codigoOtp?: string;
  }) {
    const titulo = `Solicitud de Préstamo Incompleta • ${params.folioPrestamo}`;
    const mensaje =
      `Iniciaste el auto-préstamo del expediente [${params.numControl}] (${params.nombreAlumno}), ` +
      `pero aún no has confirmado la recepción física con tu código OTP de 6 dígitos. Folio: [${params.folioPrestamo}].`;

    const metadataEnlace = {
      esNoRepudioOtp: true,
      solicitudIncompleta: true,
      folio: params.folioPrestamo,
      numControl: params.numControl,
      otp: params.codigoOtp || null
    };

    await this.dataSource.query(
      `INSERT INTO "identidad"."notificacion_usuario"
        ("titulo", "mensaje", "tipo_alerta", "metadata_enlace", "leida", "fecha_emision", "id_usuario_destino")
       VALUES ($1, $2, $3, $4, false, NOW(), $5)`,
      [
        titulo,
        mensaje,
        'PRESTAMO_OTP_PENDIENTE',
        JSON.stringify(metadataEnlace),
        params.idUsuarioSolicita
      ]
    );
  }

  // 2. Llamar dentro de entregarExpediente() en tu PrestamoService cuando el OTP sea validado con éxito:
  async cerrarAlertaPrestamoCompletado(folioPrestamo: string, idUsuario: string) {
    await this.dataSource.query(
      `UPDATE "identidad"."notificacion_usuario"
       SET "leida" = true
       WHERE "id_usuario_destino" = $1
         AND "leida" = false
         AND ("titulo" ILIKE $2 OR "mensaje" ILIKE $2)`,
      [idUsuario, `%${folioPrestamo}%`]
    );
  }
}
