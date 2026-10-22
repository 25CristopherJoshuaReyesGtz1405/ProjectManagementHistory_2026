import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UbicacionTopograficaEntity } from './Entities/UbicacionTopograficaEntity.js';
import { ArchivoDigitalEntity } from './Entities/ArchivoDigitalEntity.js';
import { PrestamoEntity } from './Entities/PrestamoEntity.js';
import { PrestamoController } from './ModuloPrestamo/PrestamoController.js';
import { PrestamoService } from './ModuloPrestamo/PrestamoService.js';
import { UsuarioEntity } from '../IdentidadActiva/Entities/UsuarioEntity.js';
import { DriveService } from './ModuloDigitalizacion/DriveService.js';
import { BullModule } from '@nestjs/bullmq';
import { DigitalizacionWorker } from './ModuloDigitalizacion/DigitalizacionWorker.js';
import { DigitalizacionController } from './ModuloDigitalizacion/DigitalizacionController.js';
import { AcademicoModule } from '../Academico/AcademicoModule.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UbicacionTopograficaEntity,
      ArchivoDigitalEntity,
      PrestamoEntity,
      UsuarioEntity,
    ]),
    BullModule.registerQueue({
      name: 'digitalizacion-queue',
    }),
    AcademicoModule, // <-- Permite a DigitalizacionWorker inyectar ExpedienteService
  ],
  controllers: [PrestamoController, DigitalizacionController],
  providers: [PrestamoService, DriveService, DigitalizacionWorker],
  exports: [TypeOrmModule],
})
export class ArchivoFisicoModule {}