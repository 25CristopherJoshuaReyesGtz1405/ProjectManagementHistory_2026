import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'; // <-- 1. IMPORTACIONES NUEVAS
import { ActualizarPersonaDTO } from '../DTOs/ActualizarPersonaDTO.js';
import { CrearPersonaDTO } from '../DTOs/CrearPersonaDTO.js';
import { IdentidadService } from './IdentidadService.js';

@ApiTags('Identidad Biométrica')
@ApiBearerAuth()
@Controller('api/identidad')
export class IdentidadController {
  constructor(private readonly identidadService: IdentidadService) {}

  @Post('personas')
  async crearPersona(@Body() datos: CrearPersonaDTO) {
    const resultado = await this.identidadService.crearPersona(datos);
    return { status: 'success', data: resultado };
  }

  @Get('personas')
  async obtenerTodas() {
    const resultado = await this.identidadService.obtenerTodas();
    return { status: 'success', data: resultado };
  }

  @Get('usuarios/perfil')
  async obtenerMiPerfil(@Req() req: any) {
    const resultado = await this.identidadService.obtenerUsuarioPorUid(
      req.user?.uid,
    );
    return { status: 'success', data: resultado };
  }

  @Get('personas/:curp')
  async obtenerPorCurp(@Param('curp') curp: string) {
    const resultado = await this.identidadService.obtenerPorCurp(curp);
    return { status: 'success', data: resultado };
  }

  @Patch('personas/:curp')
  async actualizarPersona(
    @Param('curp') curp: string,
    @Body() cambios: ActualizarPersonaDTO,
  ) {
    const resultado = await this.identidadService.actualizarPersona(
      curp,
      cambios,
    );
    return {
      status: 'success',
      message: 'Identidad recalibrada correctamente.',
      data: resultado,
    };
  }

  @Delete('personas/:curp')
  async bajaLogica(@Param('curp') curp: string) {
    await this.identidadService.bajaLogica(curp);
    return {
      status: 'success',
      message: 'Baja lógica ejecutada bajo protocolo Zero-Trust.',
    };
  }
}
