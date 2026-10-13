import { IsString, IsUUID, IsInt, IsOptional, Length } from 'class-validator';

export class CrearExpedienteDTO {
  @IsString({ message: 'El número de control debe ser texto.' })
  @Length(2, 20, { message: 'Longitud inválida para el número de control.' })
  numControl: string;

  // Enlazamos con la identidad (Persona)
  @IsUUID('4', { message: 'El ID de la persona debe ser un UUID v4 válido.' })
  idPersona: string;

  // Enlazamos con los catálogos
  @IsInt({ message: 'El ID de la carrera debe ser un número entero.' })
  idCarrera: number;

  @IsInt({ message: 'El ID del nivel académico debe ser un número entero.' })
  idNivel: number;

  @IsInt({ message: 'El ID del estatus debe ser un número entero.' })
  idEstatus: number;

  // Metadatos Opcionales
  @IsOptional()
  @IsString()
  @Length(2, 50)
  folioDigital?: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  generacion?: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  modalidad?: string;
}