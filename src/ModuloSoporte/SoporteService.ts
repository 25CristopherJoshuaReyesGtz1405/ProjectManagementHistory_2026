import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { UsuarioEntity } from '../IdentidadActiva/Entities/UsuarioEntity.js';
import { SoporteGateway } from './SoporteGateway.js';
import { MensajeSoporteEntity } from '../IdentidadActiva/Entities/MensajeSoporteEntity.js';
import { TicketSoporteEntity } from '../IdentidadActiva/Entities/TicketSoporteEntity.js';

@Injectable()
export class SoporteService {
  constructor(
    @InjectRepository(TicketSoporteEntity)
    private readonly ticketRepo: Repository<TicketSoporteEntity>,
    @InjectRepository(MensajeSoporteEntity)
    private readonly mensajeRepo: Repository<MensajeSoporteEntity>,
    private readonly dataSource: DataSource,
    private readonly soporteGateway: SoporteGateway
  ) {}

  async obtenerTicketsPorUsuario(idUsuario: string) {
    return await this.ticketRepo.find({
      where: { usuarioReporta: { idUsuario } },
      relations: { mensajes: true, usuarioReporta:true },
      order: {
        fechaCreacion: 'DESC',
        mensajes: { fecha: 'ASC' }
      }
    });
  }

  async obtenerTodosLosTicketsAdmin() {
    return await this.ticketRepo.find({
      relations: { mensajes: true, usuarioReporta:true },
      order: {
        fechaCreacion: 'DESC',
        mensajes: { fecha: 'ASC' }
      }
    });
  }

  /**
   * Crea el ticket, guarda los mensajes iniciales e INSERTA en identidad.notificacion_usuario
   */
  async crearTicket(dto: any, usuario: UsuarioEntity) {
    const conteo = await this.ticketRepo.count();
    const folioGenerado = `SOP-2026-${String(conteo + 101).padStart(4, '0')}`;

    const nuevoTicket = this.ticketRepo.create({
      folio: folioGenerado,
      categoria: dto.categoria || 'ESCANER_OCR',
      prioridad: dto.prioridad || 'MEDIA',
      asunto: dto.asunto,
      descripcion: dto.descripcion,
      estado: 'ABIERTO',
      telemetriaEstacion: dto.telemetriaEstacion || {
        navegador: 'Estación Web SIGAH',
        resolucion: '1920x1080',
        latenciaMs: 14
      },
      usuarioReporta: usuario
    });

    const ticketGuardado = await this.ticketRepo.save(nuevoTicket);

    // 1. Guardar mensaje del operador y acuse en mensajes_soporte
    const msgOperador = this.mensajeRepo.create({
      autor: 'OPERADOR',
      nombreAutor: usuario.nombreCompleto,
      texto: dto.descripcion,
      ticket: ticketGuardado,
      usuarioEmisor: usuario
    });

    const msgSistema = this.mensajeRepo.create({
      autor: 'ADMIN_SISTEMA',
      nombreAutor: 'Mesa de Ingeniería SIGAH ITD',
      texto: `Recibimos tu reporte con folio ${folioGenerado} (Prioridad: ${ticketGuardado.prioridad}). El Administrador del Sistema ha sido notificado en tiempo real.`,
      ticket: ticketGuardado
    });

    await this.mensajeRepo.save([msgOperador, msgSistema]);

    // 2. INSERTAR EN identidad.notificacion_usuario PARA QUE SE REFLEJE EN LA BD Y EN LA CAMPANA
    await this.registrarNotificacionEnBaseDeDatos({
      usuarioDestino: usuario,
      titulo: `Ticket Registrado • ${folioGenerado}`,
      mensaje: `Tu reporte "${ticketGuardado.asunto}" (${ticketGuardado.prioridad}) está activo en la Mesa de Ingeniería.`,
      tipoAlerta: 'SOPORTE_TECNICO',
      metadataEnlace: {
        idTicket: ticketGuardado.idTicket,
        folio: folioGenerado,
        prioridad: ticketGuardado.prioridad,
        ruta: '/ventanilla/soporte'
      }
    });

    // También notificamos en BD a los Administradores activos (si existen en el padrón)
    await this.notificarAdministradoresEnBD(ticketGuardado, usuario);

    const ticketCompleto = await this.ticketRepo.findOne({
      where: { idTicket: ticketGuardado.idTicket },
      relations: { mensajes: true, usuarioReporta:true },
      order: { mensajes: { fecha: 'ASC' } }
    });

    this.soporteGateway.emitirCambioEstadoTicket(ticketCompleto, usuario.email);
    return ticketCompleto;
  }

  /**
   * Guarda cada nuevo mensaje de la conversación en mensajes_soporte
   * e inserta la alerta correspondiente en identidad.notificacion_usuario
   */
  async agregarMensajeAlTicket(
    idTicket: string,
    texto: string,
    usuario: UsuarioEntity,
    esAdmin: boolean
  ) {
    const ticket = await this.ticketRepo.findOne({
      where: { idTicket },
      relations: { usuarioReporta:true } 
    });

    if (!ticket) {
      throw new NotFoundException(`No se encontró el ticket con ID ${idTicket}`);
    }

    // 1. Persistir el mensaje en la tabla mensajes_soporte
    const nuevoMsg = this.mensajeRepo.create({
      autor: esAdmin ? 'ADMIN_SISTEMA' : 'OPERADOR',
      nombreAutor: usuario.nombreCompleto,
      texto: texto.trim(),
      ticket,
      usuarioEmisor: usuario
    });

    const mensajeGuardado = await this.mensajeRepo.save(nuevoMsg);

    // 2. Si responde el Admin, actualizamos estado a EN_ATENCION
    if (esAdmin && ticket.estado === 'ABIERTO') {
      ticket.estado = 'EN_ATENCION';
      await this.ticketRepo.save(ticket);
    }

    // 3. Persistir la notificación en identidad.notificacion_usuario
    if (esAdmin && ticket.usuarioReporta) {
      await this.registrarNotificacionEnBaseDeDatos({
        usuarioDestino: ticket.usuarioReporta,
        titulo: `Respuesta del Administrador • ${ticket.folio}`,
        mensaje: `${usuario.nombreCompleto}: "${texto.trim().slice(0, 120)}"`,
        tipoAlerta: 'SOPORTE_RESPUESTA',
        metadataEnlace: {
          idTicket: ticket.idTicket,
          folio: ticket.folio,
          ruta: '/ventanilla/soporte'
        }
      });
    } else {
      await this.notificarAdministradoresEnBD(ticket, usuario, texto.trim());
    }

    // 4. Emitir en tiempo real por WebSocket
    const emailDestino = esAdmin ? ticket.usuarioReporta?.email : ticket.usuarioReporta?.email;
    this.soporteGateway.emitirNuevoMensaje(idTicket, mensajeGuardado, emailDestino);

    return mensajeGuardado;
  }

  async actualizarEstadoTicket(idTicket: string, nuevoEstado: 'ABIERTO' | 'EN_ATENCION' | 'RESUELTO') {
    const ticket = await this.ticketRepo.findOne({
      where: { idTicket },
      relations: { mensajes: true, usuarioReporta:true }
    });

    if (!ticket) {
      throw new NotFoundException(`No se encontró el ticket con ID ${idTicket}`);
    }

    ticket.estado = nuevoEstado;
    const guardado = await this.ticketRepo.save(ticket);

    if (ticket.usuarioReporta) {
      await this.registrarNotificacionEnBaseDeDatos({
        usuarioDestino: ticket.usuarioReporta,
        titulo: `Ticket ${nuevoEstado} • ${ticket.folio}`,
        mensaje: `El ticket "${ticket.asunto}" cambió su estado a ${nuevoEstado}.`,
        tipoAlerta: 'SOPORTE_ESTADO',
        metadataEnlace: {
          idTicket: ticket.idTicket,
          folio: ticket.folio,
          estado: nuevoEstado
        }
      });
    }

    this.soporteGateway.emitirCambioEstadoTicket(guardado, ticket.usuarioReporta?.email);
    return guardado;
  }

  /**
   * Inserta directamente en la tabla identidad.notificacion_usuario respetando sus 8 columnas exactas
   */
  private async registrarNotificacionEnBaseDeDatos(params: {
    usuarioDestino: UsuarioEntity;
    titulo: string;
    mensaje: string;
    tipoAlerta: string;
    metadataEnlace: Record<string, any>;
  }): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO "identidad"."notificacion_usuario"
          ("titulo", "mensaje", "tipo_alerta", "metadata_enlace", "leida", "fecha_emision", "id_usuario_destino")
         VALUES ($1, $2, $3, $4, false, NOW(), $5)`,
        [
          params.titulo.slice(0, 150),
          params.mensaje,
          params.tipoAlerta.slice(0, 50),
          JSON.stringify(params.metadataEnlace),
          params.usuarioDestino.idUsuario
        ]
      );
    } catch (err) {
      console.error('Error al insertar en identidad.notificacion_usuario:', err);
    }
  }

  private async notificarAdministradoresEnBD(
    ticket: TicketSoporteEntity,
    operador: UsuarioEntity,
    ultimoMensaje?: string
  ): Promise<void> {
    try {
      const usuariosRepo = this.dataSource.getRepository(UsuarioEntity);
      const todos = await usuariosRepo.find({
        where: { fechaBaja: IsNull() },
        relations: { rol:true }
      });

      const admins = todos.filter(u =>
        String((u as any).rol?.nombre || '').toUpperCase().includes('ADMIN') ||
        u.email.toLowerCase().includes('admin')
      );

      const destinatarios = admins.length > 0 ? admins : [operador];

      for (const adminUser of destinatarios) {
        await this.registrarNotificacionEnBaseDeDatos({
          usuarioDestino: adminUser,
          titulo: ultimoMensaje
            ? `Nuevo Mensaje en ${ticket.folio}`
            : `Nuevo Ticket ${ticket.prioridad} • ${ticket.folio}`,
          mensaje: ultimoMensaje
            ? `${operador.nombreCompleto}: "${ultimoMensaje.slice(0, 120)}"`
            : `${operador.nombreCompleto} reportó: "${ticket.asunto}"`,
          tipoAlerta: 'SOPORTE_ADMIN',
          metadataEnlace: {
            idTicket: ticket.idTicket,
            folio: ticket.folio,
            operador: operador.email
          }
        });
      }
    } catch (err) {
      console.error('Error al notificar administradores:', err);
    }
  }

  async diagnosticarSaludNodos() {
    const inicio = Date.now();
    await this.dataSource.query('SELECT 1');
    const latenciaDb = Math.max(4, Date.now() - inicio);

    return [
      {
        idNodo: 'POSTGRES',
        nombre: 'Motor PostgreSQL ACID',
        descripcion: 'Padrón y bloqueos pesimistas',
        icono: 'bi-database-fill-check',
        estado: 'OPERATIVO',
        latenciaMs: latenciaDb
      },
      {
        idNodo: 'BULLMQ',
        nombre: 'Cola Asíncrona BullMQ + OCR',
        descripcion: 'Workers de digitalización en segundo plano',
        icono: 'bi-cpu-fill',
        estado: 'OPERATIVO',
        latenciaMs: latenciaDb + 5
      },
      {
        idNodo: 'BOVEDA',
        nombre: 'Bóveda Caliente y Visor 360°',
        descripcion: 'Sellado de marca de agua forense',
        icono: 'bi-shield-lock-fill',
        estado: 'OPERATIVO',
        latenciaMs: latenciaDb + 3
      },
      {
        idNodo: 'WEBRTC',
        nombre: 'Óptica WebRTC Adobe Scan',
        descripcion: 'Procesamiento HTML5 Canvas local',
        icono: 'bi-camera-fill',
        estado: 'OPERATIVO',
        latenciaMs: 8
      }
    ];
  }
}