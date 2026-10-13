import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UbicacionTopograficaEntity } from './Entities/UbicacionTopograficaEntity.js';
import { ArchivoDigitalEntity } from './Entities/ArchivoDigitalEntity.js';
import { PrestamoEntity } from './Entities/PrestamoEntity.js';
import { PrestamoController } from './PrestamoController.js';
import { PrestamoService } from './PrestamoService.js';
import { UsuarioEntity } from '../IdentidadActiva/Entities/UsuarioEntity.js';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      UbicacionTopograficaEntity,
      ArchivoDigitalEntity,
      PrestamoEntity, 
      UsuarioEntity
    ])
  ],
  controllers: [PrestamoController],
  providers: [PrestamoService],
  exports: [TypeOrmModule],
})
export class ArchivoFisicoModule {}