import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpedienteEntity } from './Entities/ExpedienteEntity.js';
import { TitulacionEntity } from './Entities/TitulacionEntity.js';
import { ExpedienteController } from './ExpedienteController.js';
import { ExpedienteService } from './ExpedienteService.js';

@Module({
  imports: [TypeOrmModule.forFeature([ExpedienteEntity, TitulacionEntity])],
  controllers: [ExpedienteController], 
  providers: [ExpedienteService],   
  exports: [TypeOrmModule],
})
export class AcademicoModule {}