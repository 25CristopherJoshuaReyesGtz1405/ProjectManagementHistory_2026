import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt } from 'class-validator';

export class BuscarExpedienteDTO {
  @ApiPropertyOptional({ description: 'Término de búsqueda: Nombre, Apellidos o Número de Control' })
  @IsOptional()
  @IsString()
  termino?: string;

  @ApiPropertyOptional({ description: 'Filtrar por el ID numérico de la carrera' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El identificador de carrera debe ser un número entero.' })
  id_carrera?: number;
}