import { IsUUID, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class SolicitarPrestamoDTO {
  // 1. ¿Qué expediente físico quieres?
  @IsUUID('4', { message: 'El ID del expediente debe ser un formato UUID v4 válido.' })
  idExpediente: string;

  // 2. ¿Para qué lo quieres? (El ID del catálogo: Auditoría, Consulta, Trámite, etc.)
  @IsInt({ message: 'El motivo del préstamo debe ser un identificador numérico válido.' })
  idMotivo: number;

  // 3. ¿Alguna observación al momento de pedirlo? (Opcional)
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observacionesSalida?: string;
}