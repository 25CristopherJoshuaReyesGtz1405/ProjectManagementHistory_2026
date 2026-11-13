import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../AutenticacionActiva/GuardisActivos/JwtAuth.guard.js';
import { NotificacionService } from './NotificacionService.js';

@Controller('api/v3/identidad/notificaciones')
export class NotificacionController {
  constructor(private readonly notificacionService: NotificacionService) {}

  // =======================================================
  // ENDPOINT: FEED DE LA CAMPANA (POLLING)
  // =======================================================
  @UseGuards(JwtAuthGuard)
  @Get('mis-alertas')
  async obtenerMisAlertas(@Req() req: Request & { user?: any }) {
    const uidAutorizadorFirebase = req.user.uid;
    return await this.notificacionService.obtenerAlertasNoLeidas(uidAutorizadorFirebase);
  }

  // =======================================================
  // ENDPOINT: LIMPIAR ALERTA (AL HACER CLIC)
  // =======================================================
  @UseGuards(JwtAuthGuard)
  @Patch(':id/marcar-leida')
  async marcarLeida(
    @Param('id') idNotificacion: string, 
    @Req() req: Request & { user?: any }
  ) {
    const uidAutorizadorFirebase = req.user.uid;
    return await this.notificacionService.marcarComoLeida(idNotificacion, uidAutorizadorFirebase);
  }
}