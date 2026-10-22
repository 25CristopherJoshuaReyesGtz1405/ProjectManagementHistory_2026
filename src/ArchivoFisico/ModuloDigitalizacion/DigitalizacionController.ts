import { Controller, Post, Body, Req, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiConsumes } from '@nestjs/swagger';

import { PrestamoService } from '../ModuloPrestamo/PrestamoService.js';
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

import * as fsPromises from 'fs/promises';
import { ConfigService } from '@nestjs/config';

@ApiTags('Digitalización del Archivo Físico')
@ApiBearerAuth()
@Controller('api/v3/archivo-fisico/digitalizacion')
export class DigitalizacionController {
  constructor(
    private readonly prestamoService: PrestamoService,

    // Inyectamos la conexión a la tabla usuarios
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>,

    @InjectQueue('digitalizacion-queue') private readonly digitalizacionQueue: Queue,

    private readonly configService: ConfigService,
  ) {}

  
  /*@Post('digitalizar')
  @ApiOperation({ summary: 'Ventanilla/Admin: Subir documento digitalizado al expediente' })
  @ApiConsumes('multipart/form-data') // Swagger sabrá que esto es para subir archivos
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        idExpediente: { type: 'string', format: 'uuid' },
        idTipoArchivo: { type: 'number' },
        observaciones: { type: 'string' },
        archivo: { type: 'string', format: 'binary' }, // El campo del PDF
      },
    },
  })
  @UseInterceptors(FileInterceptor('archivo')) // Intercepta el campo "archivo"
  async subirDocumentoDigital(
    @Body() dto: SubirArchivoDigitalDTO,
    @UploadedFile(new ValidadorFirmaArchivoPipe()) archivoForense: Express.Multer.File, // <-- Aplicamos el escudo aquí
    @Req() req: any
  ) {
    // 1. Identidad del usuario (Firebase)
    const emailFirebase = req.user?.email;
    if (!emailFirebase) throw new UnauthorizedException('Firma criptográfica inválida.');

    const usuarioSube = await this.usuarioRepo.findOne({ where: { email: emailFirebase } });
    if (!usuarioSube) throw new UnauthorizedException('Usuario no autorizado para digitalizar.');

    // 2. Aquí es donde, en la Fase 2, conectaremos Redis/BullMQ para procesar el "archivoForense" en segundo plano
    // Por ahora, simularemos un éxito para probar el escudo
    
    return {
      status: 'success',
      mensaje: 'Escudo perimetral superado. El archivo es seguro y está listo para procesamiento.',
      detalles: {
        peso: archivoForense.size,
        tipoRealDetectado: archivoForense.mimetype,
        expedienteDestino: dto.idExpediente
      }
    };
  }*/

  @Post('digitalizar')
  @HttpCode(HttpStatus.ACCEPTED) // Regla de Arquitectura: 202 significa "Recibido y encolado, pero no terminado"
  @ApiOperation({ summary: 'Ventanilla/Admin: Subir documento digitalizado al expediente (Asíncrono)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        idExpediente: { type: 'string', format: 'uuid' },
        idTipoArchivo: { type: 'number' },
        observaciones: { type: 'string' },
        archivo: { type: 'string', format: 'binary' }, // El campo del PDF
      },
    },
  })
  @UseInterceptors(FileInterceptor('archivo'))
  async subirDocumentoDigital(
    @Body() dto: SubirArchivoDigitalDTO,
    @UploadedFile(new ValidadorFirmaArchivoPipe()) archivoForense: Express.Multer.File,
    @Req() req: any
  ) {
    const emailFirebase = req.user?.email;
    if (!emailFirebase) throw new UnauthorizedException('Firma criptográfica inválida.');

    const usuarioSube = await this.usuarioRepo.findOne({ where: { email: emailFirebase } });
    if (!usuarioSube) throw new UnauthorizedException('Usuario no autorizado para digitalizar.');

    // 1. PATRÓN TEMP STORAGE: Guardamos el buffer pesado en el disco local temporalmente
    const tempFolder = this.configService.get<string>('STORAGE_TEMP_PATH', 'temp_uploads');
    const directorioTemporal = path.resolve(process.cwd(), tempFolder);
    await fsPromises.mkdir(directorioTemporal, { recursive: true });

    const nombreUnico = `${Date.now()}-${archivoForense.originalname.replace(/\s+/g, '_')}`;
    const rutaTemporal = path.join(directorioTemporal, nombreUnico);
    
    await fsPromises.writeFile(rutaTemporal, archivoForense.buffer);

    // 2. EVENT-DRIVEN: Arrojamos un mensaje ligero a Redis
    // El Worker recibirá esto y buscará el archivo en el disco
    await this.digitalizacionQueue.add('procesar-pdf', {
      idExpediente: dto.idExpediente,
      idTipoArchivo: dto.idTipoArchivo,
      idUsuarioSube: usuarioSube.idUsuario,
      rutaTemporal: rutaTemporal,
      nombreOriginal: archivoForense.originalname,
      mimetype: archivoForense.mimetype,
    });

    // 3. RESPUESTA INMEDIATA (Eficiencia Operativa)
    // El usuario no tiene que esperar a Google Drive. Se puede ir a tomar un café.
    return {
      status: 'procesando',
      mensaje: 'Escudo superado. El documento ha sido encolado exitosamente para su carga segura en segundo plano.',
      jobId: nombreUnico
    };
  }

  @Get('visor/:idExpediente/:nombreArchivo')
  @ApiOperation({ summary: 'Proxy Seguro: Renderizar PDF directamente desde la Bóveda Local' })
  async verDocumentoDigitalizado(
    @Param('idExpediente') idExpediente: string,
    @Param('nombreArchivo') nombreArchivo: string,
    @Res() res: Response
  ) {
    const idSeguro = path.basename(idExpediente);
    const nombreSeguro = path.basename(nombreArchivo);

    const hotFolder = this.configService.get<string>('STORAGE_HOT_PATH', 'boveda_local_itd');
    const rutaFisica = path.resolve(process.cwd(), hotFolder, idSeguro, nombreSeguro);

    try {
      await fsPromises.access(rutaFisica, fs.constants.F_OK);
    } catch {
      throw new NotFoundException('Falla forense: El documento no se encuentra físicamente en la bóveda.');
    }

    res.sendFile(rutaFisica);
  }

  // Agrega esto en tu Controller
  @Get('expediente/:numeroControl/documentos')
  @ApiOperation({ summary: 'Admin: Listar todos los documentos digitalizados mediante Número de Control' })
  async listarDocumentosDeExpediente(@Param('numeroControl') numeroControl: string) {
    
    // Llamamos a la resolución indirecta
    const acervoDocumental = await this.prestamoService.obtenerDocumentosPorControl_Op(numeroControl);
    
    // Si la subconsulta devolvió null, el expediente no existe
    if (!acervoDocumental) {
      throw new NotFoundException(`Validación fallida: No se localizó ningún expediente activo con el Número de Control [${numeroControl}].`);
    }

    return {
      status: 'success',
      mensaje: 'Acervo documental recuperado exitosamente.',
      data: acervoDocumental
    };
  }

}