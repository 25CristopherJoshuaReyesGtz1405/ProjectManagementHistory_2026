import { IsString, Length, IsOptional, Matches, IsIn, IsNotEmpty } from 'class-validator';

export class CrearPersonaDTO {
  @IsString({ message: 'La CURP debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La CURP es un campo obligatorio.' })
  @Length(18, 18, { message: 'La CURP debe tener exactamente 18 caracteres.' })
  @Matches(/^[A-Z]{4}[0-9]{6}[H,M][A-Z]{5}[A-Z0-9]{2}$/, { message: 'El formato de la CURP es inválido según la normatividad mexicana.' })
  curp: string;

  @IsOptional()
  @IsString({ message: 'El RFC debe ser una cadena de texto.' })
  @Length(13, 13, { message: 'El RFC (Personas Físicas) debe tener exactamente 13 caracteres.' })
  rfc?: string;

  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres.' })
  nombre: string;

  @IsString({ message: 'El primer apellido debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El primer apellido es obligatorio.' })
  @Length(2, 50, { message: 'El primer apellido debe tener entre 2 y 50 caracteres.' })
  primerApellido: string;

  @IsOptional()
  @IsString({ message: 'El segundo apellido debe ser una cadena de texto.' })
  @Length(2, 50, { message: 'El segundo apellido debe tener entre 2 y 50 caracteres.' })
  segundoApellido?: string;

  @IsOptional()
  @IsString()
  @IsIn(['M', 'F', 'O'], { message: 'El género no es válido. Opciones permitidas: M (Masculino), F (Femenino), O (Otro).' })
  genero?: string;
}