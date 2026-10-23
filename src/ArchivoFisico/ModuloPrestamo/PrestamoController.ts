import { Controller, Post, Body, Req, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiConsumes } from '@nestjs/swagger';

import { PrestamoService } from './PrestamoService.js';
import { SolicitarPrestamoDTO } from '../DTOs/SolicitarPrestamoDTO.js';
import { UsuarioEntity } from '../../IdentidadActiva/Entities/UsuarioEntity.js';
import { EntregarExpedienteDTO } from '../DTOs/EntregarExpedienteDTO.js';
import { RegenerarOtpDTO } from '../DTOs/RegenerarOtpDTO.js';
import { DevolverExpedienteDTO } from '../DTOs/DevolverExpedienteDTO.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubirArchivoDigitalDTO } from '../DTOs/SubirArchivoDigitalDTO.js';
import { ValidadorFirmaArchivoPipe } from '../Pipes/ValidadorFirmaArchivoPipe.js';

import { HttpCode, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express'; // ¡Ojo! Importar desde 'express'

import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Gestión de Archivo Físico')
@ApiBearerAuth()
@Controller('api/v3/archivo-fisico/prestamos')
export class PrestamoController {
  constructor(
    private readonly prestamoService: PrestamoService,
    // Inyectamos la conexión a la tabla usuarios
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>,

    @InjectQueue('digitalizacion-queue') private readonly digitalizacionQueue: Queue,
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

  @Post('entregar')
  @ApiOperation({ summary: 'Ventanilla: Validar OTP y entregar expediente físico (Transición a EN CUSTODIA)' })
  async entregarExpediente(@Body() dto: EntregarExpedienteDTO, @Req() req: any) {
    
    // Identidad del Archivista (Quien atiende la ventanilla)
    const emailFirebase = req.user?.email;

    if (!emailFirebase) {
      throw new UnauthorizedException('Token inválido: No se detectó la firma del archivista.');
    }

    const usuarioArchivista = await this.usuarioRepo.findOne({
      where: { email: emailFirebase }
    });

    if (!usuarioArchivista) {
      throw new UnauthorizedException('El archivista no tiene permisos registrados en PostgreSQL.');
    }

    // Ejecución de la Verificación Criptográfica
    const resultado = await this.prestamoService.entregarExpedienteFisico(dto, usuarioArchivista.idUsuario);
    
    return {
      status: 'success',
      data: resultado
    };
  }

  @Get('mis-activos')
@ApiOperation({ summary: 'Obtener los préstamos activos (Solicitados o En Custodia) del usuario actual' })
async obtenerMisPrestamos(@Req() req: any) {
  const idUsuario = req.user?.idUsuario;
  if (!idUsuario) {
    throw new UnauthorizedException('No se detectó la identidad del operador en la sesión.');
  }
  const prestamos = await this.prestamoService.obtenerMisPrestamosActivos(idUsuario);
  return {
    status: 'success',
    total: prestamos.length,
    data: prestamos,
  };
}

  @Post('regenerar-otp')
  @ApiOperation({ summary: 'Solicitante: Regenerar código de seguridad OTP para un préstamo activo' })
  async regenerarOtp(@Body() dto: RegenerarOtpDTO, @Req() req: any) {
    
    // Identidad del usuario que está pidiendo el nuevo código
    const emailFirebase = req.user?.email;
    if (!emailFirebase) throw new UnauthorizedException('Token inválido.');

    const usuarioSolicitante = await this.usuarioRepo.findOne({ where: { email: emailFirebase } });
    if (!usuarioSolicitante) throw new UnauthorizedException('Usuario no registrado.');

    const resultado = await this.prestamoService.regenerarOtp(dto.folio, usuarioSolicitante.idUsuario);
    
    return {
      status: 'success',
      data: resultado
    };
  }

  @Post('devolver')
  @ApiOperation({ summary: 'Ventanilla: Registrar el reingreso físico del expediente y auditar su estado (Transición a DEVUELTO)' })
  async devolverExpediente(@Body() dto: DevolverExpedienteDTO, @Req() req: any) {
    
    // Identidad del Archivista (Quien está recibiendo la carpeta de vuelta)
    const emailFirebase = req.user?.email;

    if (!emailFirebase) {
      throw new UnauthorizedException('Token inválido: No se detectó la firma del archivista que recibe.');
    }

    // Traducción de Identidad (Firebase -> PostgreSQL)
    const usuarioArchivista = await this.usuarioRepo.findOne({
      where: { email: emailFirebase }
    });

    if (!usuarioArchivista) {
      throw new UnauthorizedException('El archivista no tiene una identidad válida en el sistema.');
    }

    // Ejecución del Check-in Forense
    const resultado = await this.prestamoService.devolverExpedienteFisico(dto, usuarioArchivista.idUsuario);
    
    return {
      status: 'success',
      data: resultado
    };
  }
}