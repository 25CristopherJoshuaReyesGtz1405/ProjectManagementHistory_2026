import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Importaciones de los 10 Catálogos y la entidad RolPermisoEntity
import { CatalogoCarreraEntity } from './Entities/CatalogoCarreraEntity.js';
import { CatalogoEstadoConservacionEntity } from './Entities/CatalogoEstadoConservacionEntity.js';
import { CatalogoEstatusExpedienteEntity } from './Entities/CatalogoEstatusExpedienteEntity.js';
import { CatalogoEstatusPrestamoEntity } from './Entities/CatalogoEstatusPrestamoEntity.js';
import { CatalogoMotivoPrestamoEntity } from './Entities/CatalogoMotivoPrestamoEntity.js';
import { CatalogoNivelAcademicoEntity } from './Entities/CatalogoNivelAcademicoEntity.js';
import { CatalogoPermisoEntity } from './Entities/CatalogoPermisoEntity.js';
import { CatalogoRolUsuarioEntity } from './Entities/CatalogoRolUsuarioEntity.js';
import { CatalogoTipoArchivoEntity } from './Entities/CatalogoTipoArchivoEntity.js';
import { RolPermisoEntity } from './Entities/RolPermisoEntity.js';
import { ConfiguracionSeederService } from './ConfiguracionSeeder.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogoCarreraEntity, 
      CatalogoEstadoConservacionEntity,
      CatalogoEstatusExpedienteEntity,
      CatalogoEstatusPrestamoEntity,
      CatalogoMotivoPrestamoEntity,
      CatalogoNivelAcademicoEntity,
      CatalogoPermisoEntity,
      CatalogoRolUsuarioEntity,
      CatalogoTipoArchivoEntity,
      RolPermisoEntity, 
    ])
  ],
  exports: [TypeOrmModule], 
  providers: [ConfiguracionSeederService], 
})
export class ConfiguracionModule {}