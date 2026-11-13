import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/ws-soporte',
  cors: {
    origin: '*',
    credentials: true
  }
})
export class SoporteGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SoporteGateway.name);

  handleConnection(client: Socket) {
    const email = client.handshake.query.email as string;
    const rol = client.handshake.query.rol as string;

    if (email) {
      client.join(`usuario_${email}`);
    }
    if (rol && rol.toUpperCase().includes('ADMIN')) {
      client.join('sala_administradores');
    }

    this.logger.log(`Cliente conectado a Soporte WS: ${client.id} (${email || 'Anónimo'})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado de Soporte WS: ${client.id}`);
  }

  /**
   * Une al operador o al administrador a la sala específica de un ticket
   * para recibir mensajes del hilo en tiempo real.
   */
  @SubscribeMessage('unirse_sala_ticket')
  handleJoinTicketRoom(
    @MessageBody() data: { idTicket: string },
    @ConnectedSocket() client: Socket
  ) {
    if (data?.idTicket) {
      client.join(`ticket_${data.idTicket}`);
      return { status: 'joined', room: `ticket_${data.idTicket}` };
    }
  }

  /**
   * Emite un nuevo mensaje en vivo a todos los participantes que tienen abierto el ticket
   * y dispara una alerta a la campana del destinatario.
   */
  emitirNuevoMensaje(idTicket: string, mensajePayload: any, emailDestinatario?: string) {
    this.server.to(`ticket_${idTicket}`).emit('nuevo_mensaje_ticket', {
      idTicket,
      mensaje: mensajePayload
    });

    if (emailDestinatario) {
      this.server.to(`usuario_${emailDestinatario}`).emit('alerta_campana_soporte', {
        idTicket,
        titulo: 'Respuesta de Soporte Técnico',
        mensaje: `${mensajePayload.nombreAutor}: ${mensajePayload.texto}`,
        fecha: new Date()
      });
    }

    this.server.to('sala_administradores').emit('actualizacion_bandeja_admin', {
      idTicket,
      mensaje: mensajePayload
    });
  }

  /**
   * Notifica en vivo cuando se crea un nuevo ticket o cambia su estado (EN_ATENCION / RESUELTO).
   */
  emitirCambioEstadoTicket(ticketActualizado: any, emailOperador?: string) {
    this.server.to(`ticket_${ticketActualizado.idTicket}`).emit('estado_ticket_actualizado', ticketActualizado);
    this.server.to('sala_administradores').emit('ticket_actualizado_admin', ticketActualizado);

    if (emailOperador) {
      this.server.to(`usuario_${emailOperador}`).emit('estado_ticket_actualizado', ticketActualizado);
    }
  }
}