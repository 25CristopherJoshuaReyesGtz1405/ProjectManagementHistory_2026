import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonaEntity } from './Entities/PersonaEntity.js';
import { IdentidadController } from './IdentidadController.js';
import { IdentidadService } from './IdentidadService.js';
import { UsuarioEntity } from './Entities/UsuarioEntity.js';


@Module({
  imports: [TypeOrmModule.forFeature([PersonaEntity, UsuarioEntity])],
  controllers: [IdentidadController],
  providers: [IdentidadService],
  exports: [TypeOrmModule, IdentidadService], // Lo exportamos por si expedientes necesita buscar personas
})
export class IdentidadModule {}