import { Controller, Post, Body, Req, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { PrestamoService } from './PrestamoService.js';
import { SolicitarPrestamoDTO } from './DTOs/SolicitarPrestamoDTO.js';
import { UsuarioEntity } from '../IdentidadActiva/Entities/UsuarioEntity.js';

@ApiTags('Gestión de Archivo Físico')
@ApiBearerAuth()
@Controller('api/v3/archivo-fisico/prestamos')
export class PrestamoController {
  constructor(
    private readonly prestamoService: PrestamoService,
    // Inyectamos la conexión a la tabla usuarios
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>,
  ) {}

  @Post('solicitar')
  @ApiOperation({ summary: 'Generar solicitud de préstamo con OTP Dinámico' })
  async solicitarPrestamo(@Body() dto: SolicitarPrestamoDTO, @Req() req: any) {
    
    // 1. Firebase nos entrega el email en el token validado
    const emailFirebase = req.user?.email;

    if (!emailFirebase) {
      throw new UnauthorizedException('Token inválido: No se detectó un email en la firma criptográfica.');
    }

    // 2. Buscamos el UUID real de este usuario en PostgreSQL
    const usuarioFirma = await this.usuarioRepo.findOne({
      where: { email: emailFirebase }
    });

    if (!usuarioFirma) {
      throw new UnauthorizedException('El usuario autenticado no tiene una identidad registrada en la base de datos (PostgreSQL).');
    }

    // 3. Pasamos la estafeta al Motor Transaccional con el UUID correcto
    const resultado = await this.prestamoService.solicitarPrestamo(dto, usuarioFirma.idUsuario);
    
    return {
      status: 'success',
      data: resultado
    };
  }
}