import { IsString, IsNotEmpty, Length } from 'class-validator';

export class EntregarExpedienteDTO {
  @IsString({ message: 'El folio debe ser una cadena de texto válida.' })
  @IsNotEmpty({ message: 'El folio es un campo obligatorio.' })
  folio: string;

  @IsString({ message: 'El código OTP debe ser numérico/texto.' })
  @Length(6, 6, { message: 'El código de seguridad OTP debe tener exactamente 6 caracteres.' })
  otp: string;
}