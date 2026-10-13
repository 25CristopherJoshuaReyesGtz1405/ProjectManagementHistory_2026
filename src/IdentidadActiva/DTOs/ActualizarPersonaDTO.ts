import { PartialType } from '@nestjs/swagger';
import { CrearPersonaDTO } from './CrearPersonaDTO.js';

export class ActualizarPersonaDTO extends PartialType(CrearPersonaDTO) {}