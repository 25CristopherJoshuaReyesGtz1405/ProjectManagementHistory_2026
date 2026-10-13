import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CrearExpedienteDTO } from './DTOs/CrearExpedienteDTO.js';
import { ExpedienteService } from './ExpedienteService.js';

@ApiTags('Acervo Académico')
@ApiBearerAuth()
@Controller('api/v3/academico/expedientes')
export class ExpedienteController {
  constructor(private readonly expedienteService: ExpedienteService) {}

  @Post()
  async crearExpediente(@Body() dto: CrearExpedienteDTO) {
    const resultado = await this.expedienteService.crearExpediente(dto);
    return { status: 'success', data: resultado };
  }
}