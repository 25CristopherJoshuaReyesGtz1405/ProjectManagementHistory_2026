import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { AdminGobernanzaController } from './AdminGobernanzaController.js';
import { AdminGobernanzaService } from './AdminGobernanzaService.js';

import { AcademicoModule } from '../../Academico/AcademicoModule.js';
import { CatalogoSinodalEntity } from '../../Academico/Entities/CatalogoSinodalEntity.js';
import { ConvenioInteroperabilidadEntity } from '../../Academico/Entities/ConvenioInteroperabilidadEntity.js';
import { ExpedienteAuditoriaEntity } from '../../Academico/Entities/ExpedienteAuditoriaEntity.js';
import { ExpedienteEntity } from '../../Academico/Entities/ExpedienteEntity.js';
import { TramiteTitulacionEntity } from '../../Academico/Entities/TramiteTitulacionEntity.js';

import { ArchivoDigitalEntity } from '../../ArchivoFisico/Entities/ArchivoDigitalEntity.js';
import { PrestamoEntity } from '../../ArchivoFisico/Entities/PrestamoEntity.js';
import { DriveService } from '../../ArchivoFisico/ModuloDigitalizacion/DriveService.js';

import { CatalogoCarreraEntity } from '../../ConfiguracionActiva/Entities/CatalogoCarreraEntity.js';
import { CatalogoRolUsuarioEntity } from '../../ConfiguracionActiva/Entities/CatalogoRolUsuarioEntity.js';

import { AlertaSeguridadEntity } from '../Entities/AlertaSeguridadEntity.js';
import { NotificacionEntity } from '../Entities/NotificacionEntity.js';
import { PersonaEntity } from '../Entities/PersonaEntity.js';
import { TicketSoporteEntity } from '../Entities/TicketSoporteEntity.js';
import { UsuarioEntity } from '../Entities/UsuarioEntity.js';

import { NotificacionService } from '../ModuloNotificacion/NotificacionService.js';



@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsuarioEntity,
      PersonaEntity,
      AlertaSeguridadEntity,
      TicketSoporteEntity,
      NotificacionEntity,
      CatalogoRolUsuarioEntity,
      CatalogoCarreraEntity,
      ExpedienteEntity,
      TramiteTitulacionEntity,
      ConvenioInteroperabilidadEntity,
      ExpedienteAuditoriaEntity,
      PrestamoEntity,
      ArchivoDigitalEntity,
      CatalogoSinodalEntity
    ]),
    BullModule.registerQueue(
      { name: 'digitalizacion-queue' },
      { name: 'titulacion-queue' },
    ),
    AcademicoModule,
  ],
  controllers: [AdminGobernanzaController],
  providers: [AdminGobernanzaService, NotificacionService, DriveService],
  exports: [AdminGobernanzaService],
})
export class AdminGobernanzaModule {}