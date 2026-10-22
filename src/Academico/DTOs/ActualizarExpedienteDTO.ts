import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsDateString } from 'class-validator';

export class ActualizarExpedienteDTO {
  @ApiPropertyOptional({ description: 'ID del nuevo estatus (ej. 2 = Egresado, 3 = Titulado)' })
  @IsOptional()
  @IsInt()
  idEstatus?: number;

  @ApiPropertyOptional({ description: 'Fecha en la que egresó de la institución' })
  @IsOptional()
  @IsDateString()
  fechaEgreso?: string;

  @ApiPropertyOptional({ description: 'Folio digital asignado tras la titulación' })
  @IsOptional()
  @IsString()
  folioDigital?: string;

  @ApiPropertyOptional({ description: 'ID del nivel académico (ej. Licenciatura -> Maestría)' })
  @IsOptional()
  @IsInt()
  idNivelAcademico?: number;

  // Campos específicos de titulación si se maneja directo en el expediente
}