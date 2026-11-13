import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsEmail,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoTitulacion } from '../../../Academico/Constant/FSM_Titulacion.js';

export class CrearOActualizarOperadorAdminDTO 
{
  @ApiProperty({ description: 'UID de Google Firebase o identificador institucional' })
  @IsString()
  @IsNotEmpty()
  uidFirebase: string;

  @ApiProperty({ description: 'Correo electrónico institucional @itdurango.edu.mx' })
  @IsEmail({}, { message: 'El formato del correo institucional no es válido.' })
  email: string;

  @ApiProperty({ description: 'Nombre completo del operador o funcionario' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreCompleto: string;

  @ApiProperty({ description: 'Nombre del Rol: ADMIN, JEFATURA, TITULACION, VENTANILLA, SERVICIO_SOCIAL' })
  @IsString()
  @IsNotEmpty()
  rolNombre: string;

  @ApiPropertyOptional({ description: 'Departamento de adscripción' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  departamento?: string;

  @ApiPropertyOptional({ description: 'Nivel de confianza Zero-Trust (0 a 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  trustScore?: number;
}

export class CambiarEstadoOperadorDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rolNombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  trustScore?: number;

  @ApiPropertyOptional({ description: 'true para reactivar cuenta, false para aplicar baja lógica' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departamento?: string;
}

export class ForzarTransicionFsmAdminDTO {
  @ApiProperty({ enum: EstadoTitulacion, description: 'Estado destino autorizado por Jefatura' })
  @IsString()
  @IsNotEmpty()
  estadoDestino: EstadoTitulacion;

  @ApiProperty({ description: 'Motivo jurídico o administrativo obligatorio para la Caja Negra' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  justificacionLegal: string;

  @ApiPropertyOptional({ description: 'Folio de oficio de Comité Académico o Fe de Erratas' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  folioOficioAutorizacion?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales a fusionar en pagosConciliados (Libro, Foja, Sínodo, Dispensa SLA)' })
  @IsOptional()
  metadatosOverride?: Record<string, any>;
}

export class AsignarCustodiaNoRepudioAdminDTO {
  @ApiProperty({ description: 'Número de control del expediente a extraer de bóveda' })
  @IsString()
  @IsNotEmpty()
  numControl: string;

  @ApiProperty({ description: 'UUID del operador de Ventanilla o Titulación que recibirá la custodia' })
  @IsString()
  @IsNotEmpty()
  idUsuarioOperadorDestino: string;

  @ApiPropertyOptional({ description: 'ID numérico del motivo de préstamo (Default: 5 = Auditoría de Jefatura)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idMotivo?: number;

  @ApiPropertyOptional({ description: 'Instrucción oficial de Jefatura para el operador' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionesJefatura?: string;
}

export class RelevoCustodiaForzosaAdminDTO {
  @ApiProperty({ description: 'ACCIÓN: DEVOLVER_BOVEDA o TRANSFERIR_OPERADOR' })
  @IsString()
  @IsIn(['DEVOLVER_BOVEDA', 'TRANSFERIR_OPERADOR'])
  tipoAccion: 'DEVOLVER_BOVEDA' | 'TRANSFERIR_OPERADOR';

  @ApiProperty({ description: 'Motivo forense del relevo forzoso (ej. Ausencia del operador, Destrabe de Titulación)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivoForense: string;

  @ApiPropertyOptional({ description: 'Estado físico de retorno (1=BUENO, 2=REGULAR, 3=DETERIORADO, 4=INCOMPLETO)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idEstadoConservacionRetorno?: number;

  @ApiPropertyOptional({ description: 'UUID del nuevo operador si tipoAccion === TRANSFERIR_OPERADOR' })
  @IsOptional()
  @IsString()
  idNuevoUsuarioCustodio?: string;
}

export class CrearConvenioB2BAdminDTO {
  @ApiProperty({ description: 'Nombre de la institución o dependencia externa (ej. DGP-SEP, TecNM Central)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreEmpresa: string;

  @ApiProperty({ description: 'Folio del convenio u oficio jurídico' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  folioOficioLegal: string;

  @ApiProperty({ description: 'Cuota diaria de consultas permitidas' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50000)
  limiteDiarioPeticiones: number;

  @ApiProperty({ description: 'Fecha de vencimiento del convenio en formato ISO (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  fechaVencimiento: string;
}

export class ActualizarSinodalAdminDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradoAcademico?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombreCompleto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departamento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  claveEmpleado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class SaneamientoIdentidadAdminDTO {
  @ApiProperty({ description: 'Número de control del expediente cuya identidad se va a sanear' })
  @IsString()
  @IsNotEmpty()
  numControl: string;

  @ApiProperty({ description: 'CURP oficial de 18 caracteres' })
  @IsString()
  @IsNotEmpty()
  curpOficial: string;

  @ApiProperty({ description: 'Nombre(s) oficial(es)' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ description: 'Primer apellido oficial' })
  @IsString()
  @IsNotEmpty()
  primerApellido: string;

  @ApiPropertyOptional({ description: 'Segundo apellido oficial' })
  @IsOptional()
  @IsString()
  segundoApellido?: string;

  @ApiProperty({ description: 'Justificación jurídica de la rectificación registral' })
  @IsString()
  @IsNotEmpty()
  motivoRectificacion: string;
}