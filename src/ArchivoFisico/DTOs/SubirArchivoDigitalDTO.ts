import { IsString, IsNotEmpty, IsInt, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class SubirArchivoDigitalDTO {
  @IsUUID('all', { message: 'El identificador del expediente debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El id del expediente es obligatorio.' })
  idExpediente: string;

  // Como los datos viajan en FormData (texto plano), usamos @Type para castearlo a número
  @Type(() => Number)
  @IsInt({ message: 'El tipo de archivo debe ser un identificador numérico (Catálogo).' })
  @IsNotEmpty({ message: 'Debes especificar qué tipo de documento estás subiendo (Ej. Acta, Certificado).' })
  idTipoArchivo: number;

  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  observaciones?: string;
}