import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Request } from 'express';
import { TitulacionService } from './TitulacionService.js';
import { EstadoTitulacion } from '../Constant/FSM_Titulacion.js';

@ApiTags('Módulo de Titulación Integral y Acto Protocolario')
@ApiBearerAuth()
@Controller('api/v3/academico/titulacion')
export class TitulacionController {
  constructor(
    private readonly titulacionService: TitulacionService,
    @InjectQueue('titulacion-queue') private readonly titulacionQueue: Queue
  ) {}

  @Get('tramites')
  @ApiOperation({ summary: 'Titulación: Listar todos los trámites activos en la Máquina de Estados (FSM)' })
  async listarTramites() {
    const data = await this.titulacionService.listarTramitesTitulacion();
    return {
      status: 'success',
      total: data.length,
      data
    };
  }

  @Post('iniciar/:numControl')
  @ApiOperation({ summary: 'Fase 1 (Gatekeeper ACID): Iniciar instancia de titulación verificando créditos' })
  async iniciarTramite(
    @Param('numControl') numControl: string,
    @Req() req: Request & { user?: any }
  ) {
    const idUsuario = req.user?.idUsuario || req.user?.uid;
    if (!idUsuario) {
      throw new UnauthorizedException('Firma criptográfica de sesión no identificada.');
    }
    const ipOrigen = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') as string;

    const data = await this.titulacionService.iniciarTramiteTitulacion(numControl, idUsuario, ipOrigen);
    return {
      status: 'success',
      mensaje: `Instancia de titulación ${data.folio} inicializada en PASO_1_REGISTRO (12.5%).`,
      data
    };
  }

  @Patch('expediente/:numControl/requisitos')
  @ApiOperation({ summary: 'Fase 1: Actualizar checklist de requisitos, no adeudo y validar no invasión de ciclos' })
  async actualizarRequisitos(
    @Param('numControl') numControl: string,
    @Body() body: any
  ) {
    const data = await this.titulacionService.actualizarChecklistRequisitos(numControl, body);
    return {
      status: 'success',
      mensaje: 'Checklist normativo de egreso y titulación actualizado.',
      data
    };
  }

  @Patch('tramite/:idTramite/avanzar-fsm')
  @ApiOperation({ summary: 'Fases 1, 2 y 3: Avanzar estado del trámite en el Grafo Dirigido Acíclico (FSM)' })
  async avanzarEstadoFSM(
    @Param('idTramite') idTramite: string,
    @Body() body: { estadoDestino: EstadoTitulacion; metadatosFase?: Record<string, any> }
  ) {
    const data = await this.titulacionService.avanzarEstadoTramiteFSM(
      idTramite,
      body.estadoDestino,
      body.metadatosFase
    );
    return {
      status: 'success',
      mensaje: `Trámite promovido exitosamente al estado ${data.estatusActual} (${data.progresoPorcentaje}%).`,
      data
    };
  }

  @Post('tramite/:idTramite/firmar-acta')
  @ApiOperation({ summary: 'Fase 3 (Smart Contract): Estampar firma criptográfica SHA-256 de Sinodal' })
  async firmarActaSinodal(
    @Param('idTramite') idTramite: string,
    @Body()
    body: {
      rolSinodal: 'PRESIDENTE' | 'SECRETARIO' | 'VOCAL';
      pinFirmaPlano: string;
      idUsuarioSinodal?: string;
      identificadorSinodal: string; // <-- Acepta Nombre Completo o UUID
    },
    @Req() req: Request & { user?: any }
  ) {
    const idUsuarioSinodal = body.idUsuarioSinodal || req.user?.idUsuario;
    if (!idUsuarioSinodal) {
      throw new UnauthorizedException('No se identificó al sinodal firmante.');
    }
    const ipOrigen = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') as string;

    const data = await this.titulacionService.firmarActaExamenSinodal(
      idTramite,
      body.rolSinodal,
      body.pinFirmaPlano,
      idUsuarioSinodal,
      body.identificadorSinodal,
      ipOrigen
    );

    return {
      status: 'success',
      mensaje: data.quorumCompletado
        ? '¡Quórum de 3 firmas completado! El trámite avanzó automáticamente a PASO_8_TRAMITE_SEP (87.5%).'
        : `Firma de ${body.rolSinodal} sellada criptográficamente en el Libro de Actas.`,
      data
    };
  }

  @Post('tramite/:idTramite/validar-cedula-sep')
  @ApiOperation({ summary: 'Fase 3 (RPA BullMQ): Encolar validación de Cédula Profesional ante el RNP de la SEP' })
  async encolarValidacionSep(
    @Param('idTramite') idTramite: string,
    @Body() body: { cedula: string }
  ) {
    await this.titulacionQueue.add('validar-cedula-rnp', {
      tipoEvento: 'NUEVA_CEDULA_HISTORICA_DIGITALIZADA',
      data: {
        idTramite,
        cedula: body.cedula
      }
    });

    return {
      status: 'procesando',
      mensaje: `Validación gubernamental de la cédula ${body.cedula} encolada en BullMQ (titulacion-queue).`
    };
  }

  @Post('validar-curp-renapo')
  async validarCurpRenapoVerificamex(
    @Body() dto: {
      numControl: string;
      curp: string;
      usarApiReal?: boolean;
      apiKeyTemporal?: string;
    }
  ) {
    return await this.titulacionService.validarCurpConVerificamexProxy(dto);
  }

  @Get('catalogo-sinodales')
  async listarCatalogoSinodales() {
    return await this.titulacionService.listarCatalogoSinodales();
  }

  @Post('catalogo-sinodales')
  async registrarNuevoSinodal(
    @Body() dto: { gradoAcademico: string; nombreCompleto: string; departamento?: string }
  ) {
    return await this.titulacionService.registrarNuevoSinodal(dto);
  }
} 