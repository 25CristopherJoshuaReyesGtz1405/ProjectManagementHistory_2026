import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsuarioEntity } from '../IdentidadActiva/Entities/UsuarioEntity.js';
import { SoporteController } from './SoporteController.js';
import { SoporteService } from './SoporteService.js';
import { SoporteGateway } from './SoporteGateway.js';
import { MensajeSoporteEntity } from '../IdentidadActiva/Entities/MensajeSoporteEntity.js';
import { TicketSoporteEntity } from '../IdentidadActiva/Entities/TicketSoporteEntity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketSoporteEntity,
      MensajeSoporteEntity,
      UsuarioEntity
    ])
  ],
  controllers: [SoporteController],
  providers: [SoporteService, SoporteGateway],
  exports: [SoporteService, SoporteGateway]
})
export class SoporteModule {}