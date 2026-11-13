import { Controller, Get, Post, Patch, Param, Body, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';

import { AdminGobernanzaService } from './AdminGobernanzaService.js';
import { UsuarioEntity } from '../Entities/UsuarioEntity.js';
import { LruCacheService } from '../../NucleoActivo/CacheActivo/LruCache.service.js';
import 
{
  CrearOActualizarOperadorAdminDTO,
  CambiarEstadoOperadorDTO,
  ForzarTransicionFsmAdminDTO,
  AsignarCustodiaNoRepudioAdminDTO,
  RelevoCustodiaForzosaAdminDTO,
  CrearConvenioB2BAdminDTO,
  ActualizarSinodalAdminDTO,
  SaneamientoIdentidadAdminDTO,
} from './DTOs/AdminGobernanzaDTOs.js';

@ApiTags('Consola Maestra del Administrador y Gobernanza Institucional')
@ApiBearerAuth()
@Controller('api/v3/admin/gobernanza')
export class AdminGobernanzaController 
{
  constructor
  (
    private readonly adminService: AdminGobernanzaService,
    private readonly cacheService: LruCacheService,
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>,
  ) {}

  private async resolverAdminAutenticado(req: Request): Promise<UsuarioEntity> 
  {
    const idUsuario = req.user?.idUsuario;
    const email = req.user?.email;

    if (!idUsuario && !email) 
    {
      throw new UnauthorizedException('Firma criptográfica de administrador no detectada.');
    }

    const admin = await this.usuarioRepo.findOne
    ({
      where: idUsuario ? { idUsuario } : { email },
      relations: { rol: true },
    });

    if (!admin) {
      throw new UnauthorizedException('El administrador no está registrado en PostgreSQL.');
    }

    return admin;
  }

  private extraerIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    );
  }

  // 1. TELEMETRÍA EJECUTIVA 360°
  @Get('radiografia-ejecutiva')
  @ApiOperation({ summary: 'Admin: Obtener radiografía ejecutiva 360° (Meta 60K, SLA, FSM y Bóveda)' })
  async obtenerRadiografiaGlobal() {
    const data = await this.adminService.obtenerRadiografiaEjecutivaGlobal();
    return { status: 'success', data };
  }

  // 2. BARRIDO MASIVO SHA-256
  @Post('boveda/barrido-sha256')
  @ApiOperation({ summary: 'Admin: Ejecutar sellado y auditoría criptográfica SHA-256 en lote' })
  async ejecutarBarridoSha256(@Req() req: Request) {
    const admin = await this.resolverAdminAutenticado(req);
    const data = await this.adminService.ejecutarBarridoSelladoSha256Masivo(
      admin.idUsuario,
      this.extraerIp(req),
    );
    return {
      status: 'success',
      mensaje: `Barrido completado: ${data.selladosNuevos} sellado(s) nuevo(s) y ${data.verificadosIntactos} íntegro(s).`,
      data,
    };
  }

  // 3. GESTIÓN ZERO-TRUST DE OPERADORES Y CACHÉ LRU
  @Get('operadores')
  @ApiOperation({ summary: 'Admin: Listar todo el padrón de operadores, roles, trustScore y carga activa' })
  async listarOperadores() {
    const data = await this.adminService.listarOperadoresInstitucionales();
    return { status: 'success', total: data.length, data };
  }

  @Post('operadores')
  @ApiOperation({ summary: 'Admin: Dar de alta o sincronizar un operador institucional' })
  async crearOperador(@Body() dto: CrearOActualizarOperadorAdminDTO) {
    const data = await this.adminService.crearOActualizarOperadorAdmin(dto);
    return {
      status: 'success',
      mensaje: 'Operador registrado y sincronizado con la caché Zero-Trust.',
      data,
    };
  }

  @Patch('operadores/:idUsuario')
  @ApiOperation({ summary: 'Admin: Modificar rol, trustScore o estado activo de un operador con purga LRU' })
  async actualizarOperador(
    @Param('idUsuario') idUsuario: string,
    @Body() dto: CambiarEstadoOperadorDTO,
  ) {
    const data = await this.adminService.cambiarEstadoORolOperador(idUsuario, dto);
    return {
      status: 'success',
      mensaje: 'Privilegios del operador actualizados en PostgreSQL y memoria RAM.',
      data,
    };
  }

  @Post('cache-lru/purgar')
  @ApiOperation({ summary: 'Admin: Purgar todas las sesiones cacheadas en memoria RAM (LruCacheService)' })
  async purgarCacheRam() {
    const eliminados = this.cacheService.clearAll();
    return {
      status: 'success',
      mensaje: `Se purgaron ${eliminados} identidad(es) de la memoria RAM. Todas las sesiones recargarán permisos desde PostgreSQL.`,
    };
  }

  // 4. ADUANA FÍSICA GLOBAL, NO REPUDIO OTP Y RELEVO FORZOSO
  @Get('prestamos/activos-global')
  @ApiOperation({ summary: 'Admin: Listar todos los préstamos físicos activos de todas las ventanillas' })
  async listarPrestamosGlobal() {
    const data = await this.adminService.listarTodosLosPrestamosActivosGlobal();
    return { status: 'success', total: data.length, data };
  }

  @Post('prestamos/asignar-no-repudio')
  @ApiOperation({ summary: 'Admin: Asignar expediente físico a un operador enviando OTP de No Repudio a su campana' })
  async asignarCustodiaNoRepudio(
    @Body() dto: AsignarCustodiaNoRepudioAdminDTO,
    @Req() req: Request,
  ) {
    const admin = await this.resolverAdminAutenticado(req);
    const data = await this.adminService.asignarCustodiaDirectaConNoRepudio(
      dto,
      admin,
      this.extraerIp(req),
    );
    return {
      status: 'success',
      mensaje: `Custodia asignada con folio ${data.folio}. Se envió alerta de No Repudio OTP a ${data.operadorAsignado}.`,
      data,
    };
  }

  @Post('prestamos/:folio/relevo-forzoso')
  @ApiOperation({ summary: 'Admin: Ejecutar devolución de oficio o transferencia forzosa de carpeta física' })
  async ejecutarRelevoForzoso(
    @Param('folio') folio: string,
    @Body() dto: RelevoCustodiaForzosaAdminDTO,
    @Req() req: Request,
  ) {
    const admin = await this.resolverAdminAutenticado(req);
    const data = await this.adminService.ejecutarRelevoCustodiaForzosaAdmin(
      folio,
      dto,
      admin,
      this.extraerIp(req),
    );
    return { status: 'success', mensaje: data.mensaje, data };
  }

  // 5. ARBITRAJE SUPREMO DE TITULACIÓN (OVERRIDE FSM Y CANDADO RENAPO)
  @Patch('titulacion/:idTramite/forzar-fsm')
  @ApiOperation({ summary: 'Admin: Forzar avance, retroceso (Rollback) o Nota Marginal en el Grafo FSM de Titulación' })
  async forzarEstadoFsm(
    @Param('idTramite') idTramite: string,
    @Body() dto: ForzarTransicionFsmAdminDTO,
    @Req() req: Request,
  ) {
    const admin = await this.resolverAdminAutenticado(req);
    const data = await this.adminService.forzarTransicionFsmAdmin(
      idTramite,
      dto,
      admin,
      this.extraerIp(req),
    );
    return {
      status: 'success',
      mensaje: `Arbitraje aplicado: El trámite ${data.folio} se posicionó en ${data.estatusActual} (${data.progresoPorcentaje}%).`,
      data,
    };
  }

  @Post('titulacion/:numControl/liberar-candado-renapo')
  @ApiOperation({ summary: 'Admin: Desbloquear candado FinOps diario de Verificamex RENAPO para una matrícula' })
  async liberarCandadoRenapo(
    @Param('numControl') numControl: string,
    @Req() req: Request,
  ) {
    const admin = await this.resolverAdminAutenticado(req);
    const data = await this.adminService.liberarCandadoDiarioRenapoAdmin(
      numControl,
      admin,
      this.extraerIp(req),
    );
    return { status: 'success', mensaje: data.mensaje, data };
  }

  // 6. CATÁLOGO MAESTRO DE SINODALES Y SANEAMIENTO DE IDENTIDAD
  @Get('sinodales')
  @ApiOperation({ summary: 'Admin: Listar padrón completo de sinodales (activos e inactivos)' })
  async listarSinodales() {
    const data = await this.adminService.listarTodosLosSinodalesAdmin();
    return { status: 'success', total: data.length, data };
  }

  @Patch('sinodales/:idSinodal')
  @ApiOperation({ summary: 'Admin: Editar grado, adscripción o estado activo de un docente sinodal' })
  async actualizarSinodal(
    @Param('idSinodal') idSinodal: string,
    @Body() dto: ActualizarSinodalAdminDTO,
  ) {
    const data = await this.adminService.actualizarSinodalAdmin(idSinodal, dto);
    return { status: 'success', mensaje: 'Registro del sinodal actualizado.', data };
  }

  @Patch('identidad/rectificar')
  @ApiOperation({ summary: 'Admin: Rectificar jurídicamente nombres, apellidos N/A y CURP de un expediente' })
  async rectificarIdentidad(
    @Body() dto: SaneamientoIdentidadAdminDTO,
    @Req() req: Request,
  ) {
    const admin = await this.resolverAdminAutenticado(req);
    const data = await this.adminService.rectificarIdentidadPersonaAdmin(
      dto,
      admin,
      this.extraerIp(req),
    );
    return {
      status: 'success',
      mensaje: 'Identidad rectificada y asentada en la bitácora forense.',
      data,
    };
  }

  // 7. CONVENIOS DE INTEROPERABILIDAD B2B
  @Get('convenios-b2b')
  @ApiOperation({ summary: 'Admin: Listar todos los convenios de interoperabilidad B2B y sus cuotas FinOps' })
  async listarConvenios() {
    const data = await this.adminService.listarConveniosInteroperabilidad();
    return { status: 'success', total: data.length, data };
  }

  @Post('convenios-b2b')
  @ApiOperation({ summary: 'Admin: Crear nuevo convenio B2B generando su x-api-key plana por única vez' })
  async crearConvenio(@Body() dto: CrearConvenioB2BAdminDTO) {
    const data = await this.adminService.crearConvenioInteroperabilidadAdmin(dto);
    return {
      status: 'success',
      mensaje: 'Convenio B2B registrado con hash SHA-256.',
      data,
    };
  }

  @Patch('convenios-b2b/:idConvenio')
  @ApiOperation({ summary: 'Admin: Recargar cuota diaria o reactivar un convenio B2B bloqueado' })
  async actualizarConvenio(
    @Param('idConvenio') idConvenio: string,
    @Body() body: { nuevaCuotaDiaria?: number; activo?: boolean },
  ) {
    const data = await this.adminService.recargarOReactivarConvenioB2B(
      idConvenio,
      body,
    );
    return { status: 'success', mensaje: 'Convenio B2B actualizado.', data };
  }

  // 8. MONITOR DE COLAS BULLMQ, GOOGLE DRIVE Y CAJA NEGRA
  @Get('infraestructura/salud')
  @ApiOperation({ summary: 'Admin: Consultar métricas en vivo de BullMQ, Google Drive y Caché LRU' })
  async obtenerSaludInfraestructura() {
    const data =
      await this.adminService.obtenerEstadoColasYAlmacenamientoHibrido();
    return { status: 'success', data };
  }

  @Post('infraestructura/bullmq-reintentar')
  @ApiOperation({ summary: 'Admin: Reencolar todos los jobs fallidos en los workers de BullMQ' })
  async reintentarBullMq() {
    const data = await this.adminService.reintentarTrabajosFallidosBullMq();
    return { status: 'success', mensaje: data.mensaje, data };
  }

  @Post('boveda/:numControl/respaldar-drive')
  @ApiOperation({ summary: 'Admin: Sincronizar PDFs locales de un expediente hacia Google Drive' })
  async respaldarEnDrive(@Param('numControl') numControl: string) {
    const data =
      await this.adminService.respaldarExpedienteEnGoogleDriveAdmin(numControl);
    return {
      status: 'success',
      mensaje: `Se respaldaron ${data.totalRespaldados} documento(s) en Google Drive.`,
      data,
    };
  }

  @Get('auditoria/bitacora-global')
  @ApiOperation({ summary: 'Admin: Obtener los últimos eventos forenses globales y alertas de ciberseguridad' })
  async obtenerBitacoraGlobal() {
    const data = await this.adminService.listarBitacoraGlobalYAlertasSeguridad();
    return { status: 'success', data };
  }
}