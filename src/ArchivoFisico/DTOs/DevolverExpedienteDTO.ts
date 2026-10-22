import { IsString, IsNotEmpty, IsInt, IsOptional, MaxLength } from 'class-validator';

export class DevolverExpedienteDTO {
  // 1. Identificador de la transacción
  @IsString({ message: 'El folio debe ser una cadena de texto válida.' })
  @IsNotEmpty({ message: 'El folio es un campo obligatorio para la devolución.' })
  folio: string;

  // 2. Auditoría Física: ¿En qué estado regresó la carpeta? (Ej. 1 = BUENO, 2 = DETERIORADO)
  @IsInt({ message: 'El estado de conservación debe ser un identificador numérico válido.' })
  @IsNotEmpty({ message: 'Debe evaluar y registrar el estado físico en el que regresa el expediente.' })
  idEstadoConservacionRetorno: number;

  // 3. Notas Forenses: Si viene deteriorado, el archivista DEBE poder justificar el porqué.
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser texto.' })
  @MaxLength(500, { message: 'Las observaciones de retorno no pueden exceder los 500 caracteres.' })
  observacionesRetorno?: string;
}