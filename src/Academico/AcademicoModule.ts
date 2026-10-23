import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpedienteEntity } from './Entities/ExpedienteEntity.js';
import { TitulacionEntity } from './Entities/TitulacionEntity.js';
import { ExpedienteController } from './ModuloExpediente/ExpedienteController.js';
import { ExpedienteService } from './ModuloExpediente/ExpedienteService.js';
import { ExpedienteAuditoriaEntity } from './Entities/ExpedienteAuditoriaEntity.js';
import { ArchivoDigitalEntity } from '../ArchivoFisico/Entities/ArchivoDigitalEntity.js';
import { TramiteTitulacionEntity } from './Entities/TramiteTitulacionEntity.js';
import { ConvenioInteroperabilidadEntity } from './Entities/ConvenioInteroperabilidadEntity.js';
import { FirmaSinodalEntity } from './Entities/FirmaSinodalEntity.js';
import { TitulacionService } from './ModuloTitulacion/TitulacionService.js';
import { TitulacionWorker } from './ModuloTitulacion/TitulacionWorker.js';
import { InteroperabilidadService } from './ModuloInteroperabilidad/InteroperabilidadService.js';
import { BullModule } from '@nestjs/bullmq';
import { InteroperabilidadController } from './ModuloInteroperabilidad/InteroperabilidadController.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpedienteEntity,
      TitulacionEntity,
      ExpedienteAuditoriaEntity,
      ArchivoDigitalEntity, // <-- Inyección formal de la entidad
      TramiteTitulacionEntity, 
      ConvenioInteroperabilidadEntity, 
      FirmaSinodalEntity
    ]),
    
    BullModule.registerQueue({ name: 'titulacion-queue' })
  ],
  controllers: 
  [
    ExpedienteController, 
    InteroperabilidadController
  ],
  providers: 
  [
    ExpedienteService, 
    TitulacionService, 
    TitulacionWorker,
    InteroperabilidadService
  ],
  exports: [TypeOrmModule, ExpedienteService], // <-- Exportamos el servicio para otros módulos
})
export class AcademicoModule {}