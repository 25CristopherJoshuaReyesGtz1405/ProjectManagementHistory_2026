import { Controller, Get, Param, Headers, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { InteroperabilidadService } from './InteroperabilidadService.js';

// Usaremos rutas sin protección JWT porque las APIs B2B usan API Keys planas en los headers
@Controller('api/v3/interoperabilidad')
export class InteroperabilidadController {
  constructor(private readonly interoperabilidadService: InteroperabilidadService) {}

  // =======================================================
  // ENDPOINT EXTERNO: VERIFICACIÓN ZERO-KNOWLEDGE
  // =======================================================
  @Get('verificar/:numControl')
  async verificarEgresado(
    @Param('numControl') numControl: string,
    @Headers('x-api-key') apiKeyPlana: string,
    @Req() req: Request
  ) {
    const ipOrigen = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP_DESCONOCIDA') as string;

    // 1. Filtro estricto de Cabecera (Evita que el servicio explote si envían la petición vacía)
    if (!apiKeyPlana) {
      throw new UnauthorizedException('Fallo de Seguridad: No se detectó la cabecera x-api-key en la petición B2B.');
    }

    // 2. Delegamos la verificación al motor criptográfico y de cuotas FinOps
    return await this.interoperabilidadService.verificarEstatusEgresado(apiKeyPlana, numControl, ipOrigen);
  }
}