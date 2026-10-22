import { IsString, IsNotEmpty } from 'class-validator';

export class RegenerarOtpDTO {
  @IsNotEmpty({ message: 'El folio es un campo obligatorio.' })
  @IsString({ message: 'El folio debe ser una cadena de texto válida.' })
  folio: string;
}