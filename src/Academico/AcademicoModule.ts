import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpedienteEntity } from './Entities/ExpedienteEntity.js';
import { TitulacionEntity } from './Entities/TitulacionEntity.js';
import { ExpedienteController } from './ModuloExpediente/ExpedienteController.js';
import { ExpedienteService } from './ModuloExpediente/ExpedienteService.js';
import { ExpedienteAuditoriaEntity } from './Entities/ExpedienteAuditoriaEntity.js';
import { ArchivoDigitalEntity } from '../ArchivoFisico/Entities/ArchivoDigitalEntity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpedienteEntity,
      TitulacionEntity,
      ExpedienteAuditoriaEntity,
      ArchivoDigitalEntity, // <-- Inyección formal de la entidad
    ]),
  ],
  controllers: [ExpedienteController],
  providers: [ExpedienteService],
  exports: [TypeOrmModule, ExpedienteService], // <-- Exportamos el servicio para otros módulos
})
export class AcademicoModule {}