import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SoporteService } from './SoporteService.js';
import { UsuarioEntity } from '../IdentidadActiva/Entities/UsuarioEntity.js';

@ApiTags('Soporte Técnico y Telemetría en Tiempo Real')
@ApiBearerAuth()
@Controller('api/v3/soporte')
export class SoporteController {
  constructor(
    private readonly soporteService: SoporteService,
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>
  ) {}

  private async obtenerUsuarioAutenticado(req: any): Promise<UsuarioEntity> {
    const idUsuario = req.user?.idUsuario;
    const emailFirebase = req.user?.email;

    if (!idUsuario && !emailFirebase) {
      throw new UnauthorizedException('Firma criptográfica inválida.');
    }

    const usuario = await this.usuarioRepo.findOne({
      where: idUsuario ? { idUsuario } : { email: emailFirebase },
      relations: { rol:true }
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no registrado en el padrón de operadores.');
    }
    return usuario;
  }

  @Get('mis-tickets')
  @ApiOperation({ summary: 'Ventanilla: Obtener todos los tickets del operador actual' })
  async listarMisTickets(@Req() req: any) {
    const usuario = await this.obtenerUsuarioAutenticado(req);
    const data = await this.soporteService.obtenerTicketsPorUsuario(usuario.idUsuario);
    return {
      status: 'success',
      mensaje: 'Tickets recuperados exitosamente.',
      data
    };
  }

  @Get('admin/tickets')
  @ApiOperation({ summary: 'Admin: Obtener todos los tickets de soporte de todas las ventanillas' })
  async listarTodosAdmin(@Req() req: any) {
    await this.obtenerUsuarioAutenticado(req);
    const data = await this.soporteService.obtenerTodosLosTicketsAdmin();
    return {
      status: 'success',
      mensaje: 'Bandeja global de soporte recuperada.',
      data
    };
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Ventanilla: Crear un nuevo ticket de soporte con telemetría adjunta' })
  async crearTicket(@Body() dto: any, @Req() req: any) {
    const usuario = await this.obtenerUsuarioAutenticado(req);
    const data = await this.soporteService.crearTicket(dto, usuario);
    return {
      status: 'success',
      mensaje: 'Ticket registrado y notificado al Administrador en tiempo real.',
      data
    };
  }

  @Post('tickets/:idTicket/mensajes')
  @ApiOperation({ summary: 'Ventanilla/Admin: Enviar un mensaje en tiempo real dentro de un ticket' })
  async enviarMensaje(
    @Param('idTicket') idTicket: string,
    @Body() body: { texto: string; esAdmin?: boolean },
    @Req() req: any
  ) {
    const usuario = await this.obtenerUsuarioAutenticado(req);
    const rolNombre = String((usuario as any).rol?.nombre || '').toUpperCase();
    const esAdmin = Boolean(body.esAdmin || rolNombre.includes('ADMIN'));

    const data = await this.soporteService.agregarMensajeAlTicket(
      idTicket,
      body.texto,
      usuario,
      esAdmin
    );

    return {
      status: 'success',
      mensaje: 'Mensaje enviado por WebSocket.',
      data
    };
  }

  @Patch('tickets/:idTicket/estado')
  @ApiOperation({ summary: 'Ventanilla/Admin: Cambiar el estado de un ticket (RESUELTO / EN_ATENCION)' })
  async cambiarEstado(
    @Param('idTicket') idTicket: string,
    @Body() body: { estado: 'ABIERTO' | 'EN_ATENCION' | 'RESUELTO' },
    @Req() req: any
  ) {
    await this.obtenerUsuarioAutenticado(req);
    const data = await this.soporteService.actualizarEstadoTicket(idTicket, body.estado);
    return {
      status: 'success',
      mensaje: 'Estado del ticket actualizado.',
      data
    };
  }

  @Get('salud-nodos')
  @ApiOperation({ summary: 'Autodiagnóstico en tiempo real de PostgreSQL, BullMQ y Bóveda' })
  async verificarSalud() {
    const data = await this.soporteService.diagnosticarSaludNodos();
    return {
      status: 'success',
      mensaje: 'Diagnóstico completado.',
      data
    };
  }
}