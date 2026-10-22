import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { DriveService } from './DriveService.js';
import { ArchivoDigitalEntity } from '../Entities/ArchivoDigitalEntity.js';
import { ExpedienteService } from '../../Academico/ModuloExpediente/ExpedienteService.js';

@Processor('digitalizacion-queue')
export class DigitalizacionWorker extends WorkerHost {
  private readonly logger = new Logger(DigitalizacionWorker.name);

  constructor(
    private readonly driveService: DriveService,
    private readonly expedienteService: ExpedienteService,
    private readonly configService: ConfigService,
    @InjectRepository(ArchivoDigitalEntity)
    private readonly archivoDigitalRepo: Repository<ArchivoDigitalEntity>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { idExpediente, idTipoArchivo, idUsuarioSube, rutaTemporal, nombreOriginal } = job.data;
    
    this.logger.log(`[WORKER - PILOTO] Iniciando inyección Local para Expediente: ${idExpediente}`);

    try {
      // 1. Verificación asíncrona del archivo temporal
      try {
        await fsPromises.access(rutaTemporal, fs.constants.F_OK);
      } catch {
        throw new Error(`El archivo temporal ${rutaTemporal} no existe.`);
      }

      // 2. Creación de directorio y movimiento asíncrono a Bóveda Caliente
      const hotFolder = this.configService.get<string>('STORAGE_HOT_PATH', 'boveda_local_itd');
      const bovedaLocalPath = path.resolve(process.cwd(), hotFolder, idExpediente);
      await fsPromises.mkdir(bovedaLocalPath, { recursive: true });
      
      const rutaPermanenteLocal = path.join(bovedaLocalPath, nombreOriginal);
      await fsPromises.rename(rutaTemporal, rutaPermanenteLocal);

      // Obtenemos metadatos de peso sin bloquear el hilo
      const statsArchivo = await fsPromises.stat(rutaPermanenteLocal);
      const urlLocal = `/api/v3/archivo-fisico/digitalizacion/visor/${idExpediente}/${nombreOriginal}`;

      // 3. PERSISTENCIA EN BASE DE DATOS (POSTGRESQL)
      const nuevoArchivoDigital = this.archivoDigitalRepo.create({
        nombreOriginal: nombreOriginal,
        rutaLocal: rutaPermanenteLocal,
        usuarioSubio: { idUsuario: idUsuarioSube },
        expediente: { idExpediente: idExpediente },
        tipoArchivo: { idTipoArchivo: idTipoArchivo },
        pesoBytes: statsArchivo.size.toString(),
        hashSha256: 'calculo_pendiente',
        fechaCreacion: new Date(),
      });

      const archivoGuardado = await this.archivoDigitalRepo.save(nuevoArchivoDigital);

      await this.expedienteService.extraerTextoYGuardar(
        archivoGuardado.idArchivo,
        rutaPermanenteLocal,
      );

      this.logger.log(`[WORKER] Guardado exitoso: [DB] Actualizada | [Local] ${rutaPermanenteLocal}`);
      return { status: 'completado', urlLocal };

    } catch (error) {
      this.logger.error(`[WORKER] Falla en Expediente ${idExpediente}:`, error);
      throw error; 
    }
  }
}