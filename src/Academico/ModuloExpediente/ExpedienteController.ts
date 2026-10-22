import { Controller, Post, Body, Get, Param, Patch, Query, Req, UnauthorizedException, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CrearExpedienteDTO } from '../DTOs/CrearExpedienteDTO.js';
import { ExpedienteService } from './ExpedienteService.js';
import { ActualizarExpedienteDTO } from '../DTOs/ActualizarExpedienteDTO.js';
import { BuscarExpedienteDTO } from '../DTOs/BuscarExpedienteDTO.js';

import { StreamableFile, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

@ApiTags('Acervo Académico')
@ApiBearerAuth()
@Controller('api/v3/academico/expedientes')
export class ExpedienteController {
  constructor(private readonly expedienteService: ExpedienteService) {}

  // ------------------------------------------------------------------
  // 1. EL BUSCADOR OMNISCIENTE (Por texto libre o carrera)
  // ------------------------------------------------------------------

  @Get('buscar/ocr') 
  @ApiOperation({ summary: 'Inteligencia: Buscar palabras clave DENTRO de los PDFs físicos' })
  async buscarEnContenidoPDF(@Query('q') palabraClave: string) {
    const resultados = await this.expedienteService.buscarPorContenidoOCR(palabraClave);
    return { status: 'success', data: resultados };
  }


  @Get('buscar') 
  @ApiOperation({ summary: 'Búsqueda Global: Localizar expedientes por No. Control, Nombre o Carrera' })
  async buscarExpedientesMultiples(@Query() filtros: BuscarExpedienteDTO) {
    const resultados = await this.expedienteService.buscarExpedientes(filtros);
    
    return {
      status: 'success',
      totalEncontrados: resultados.length,
      data: resultados
    };
  }

  @Post()
  async crearExpediente(@Body() dto: CrearExpedienteDTO) {
    const resultado = await this.expedienteService.crearExpediente(dto);
    return { status: 'success', data: resultado };
  }

  // ------------------------------------------------------------------
  // 2. EL MUTADOR EVOLUTIVO (Usa numControl en la URL)
  // ------------------------------------------------------------------
  @Patch(':numControl/evolucion')
  @ApiOperation({ summary: 'Actualización Parcial: Evolucionar expediente (Titulación, Egreso)' })
  // OJO: Asegúrate de tener tu decorador de Guardia aquí arriba, ej: @UseGuards(FirebaseAuthGuard)
  async actualizarExpediente(
    @Param('numControl') numControl: string,
    @Body() dto: ActualizarExpedienteDTO,
    @Req() req: Request // <-- 1. INYECTAMOS LA PETICIÓN CRUDA
  ) {
    
    // 2. EXTRAER LA IP ORIGEN
    // Buscamos primero en los headers (por si estás usando Nginx o balanceadores) 
    // y si no, usamos la IP directa del socket.
    const ipOrigen = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP_DESCONOCIDA') as string;

    // 3. EXTRAER EL ID DEL ADMINISTRADOR
    // Cuando el Guardia valida el JWT, suele incrustar el payload en 'req.user'.
    const usuarioAuth = req.user?.idUsuario || req.user?.uid;
    const idUsuarioAdmin = usuarioAuth;

    if (!idUsuarioAdmin) {
      // Un fail-fast por si la ruta no está protegida correctamente
      throw new UnauthorizedException('No se pudo identificar al administrador en la petición.');
    }

    // 4. DELEGAR AL SERVICIO CON EL RASTRO FORENSE COMPLETO
    const expedienteEvolucionado = await this.expedienteService.actualizarExpedienteEvolutivo(
      numControl, 
      dto,
      idUsuarioAdmin, // <-- Pasamos el ID automático
      ipOrigen        // <-- Pasamos la IP automática
    );
    
    return {
      status: 'success',
      mensaje: 'El expediente ha evolucionado correctamente.',
      data: {
        numeroControl: expedienteEvolucionado.numControl,
        folioDigitalAsignado: expedienteEvolucionado.folioDigital,
        fechaEvolucion: expedienteEvolucionado.fechaActualizacion
      }
    };
  }

  // ------------------------------------------------------------------
  // 3. INTELIGENCIA DE NEGOCIOS: ESTADÍSTICAS GLOBALES
  // ------------------------------------------------------------------
  @Get('estadisticas/demografia')
  @ApiOperation({ summary: 'BI: Obtener estadísticas demográficas globales de los expedientes' })
  async obtenerEstadisticas() {
    const dataEstadisticas = await this.expedienteService.obtenerEstadisticasDemograficas();
    
    return {
      status: 'success',
      mensaje: 'Análisis demográfico calculado correctamente',
      data: dataEstadisticas
    };
  }

  // ------------------------------------------------------------------
  // 4. SEGURIDAD ZERO-TRUST: AUDITORÍA DE INTEGRIDAD CRIPTOGRÁFICA
  // ------------------------------------------------------------------
  @Get(':numControl/auditoria-integridad')
  @ApiOperation({ summary: 'Seguridad: Auditar hashes criptográficos SHA-256 de los documentos del expediente' })
  async auditarExpediente(@Param('numControl') numControl: string) {
    
    const resultadoAuditoria = await this.expedienteService.auditarIntegridadExpediente(numControl);
    
    return {
      status: 'success',
      mensaje: 'Auditoría forense ejecutada correctamente.',
      data: resultadoAuditoria
    };
  }

  // ------------------------------------------------------------------
  // 5. INTELIGENCIA DE NEGOCIOS: ANALÍTICA DE TRAYECTORIA INDIVIDUAL
  // ------------------------------------------------------------------
  @Get(':numControl/analitica')
  @ApiOperation({ summary: 'BI: Radiografía académica, documental y de salud del expediente' })
  async obtenerAnaliticaAlumno(@Param('numControl') numControl: string) {
    
    const radiografia = await this.expedienteService.obtenerAnaliticaTrayectoria(numControl);
    
    return {
      status: 'success',
      mensaje: 'Analítica de trayectoria calculada con éxito.',
      data: radiografia
    };
  }

  // ------------------------------------------------------------------
  // 6. INTEROPERABILIDAD: EXPORTACIÓN SEP / TECNM
  // ------------------------------------------------------------------
  @Get('interoperabilidad/:numControl/exportar')
  @ApiOperation({ summary: 'Integración: Exportar paquete de validación institucional (JSON)' })
  async exportarExpedienteInstitucional(@Param('numControl') numControl: string) {
    
    const paquete = await this.expedienteService.exportarPaqueteInstitucional(numControl);
    
    return {
      status: 'success',
      mensaje: 'Paquete de exportación generado. Enlaces de descarga válidos por 5 minutos.',
      data: paquete
    };
  }

  // ------------------------------------------------------------------
  // 7. EL VISOR EFÍMERO: Descarga Temporal SEP / TecNM
  // ------------------------------------------------------------------
  @Get('interoperabilidad/descarga/:idExpediente/:idArchivo')
  @ApiOperation({ summary: 'Descarga efímera de archivos oficiales para dependencias externas' })
  async descargarArchivoInteroperabilidad(
    @Param('idExpediente') idExpediente: string,
    @Param('idArchivo') idArchivo: string,
    @Query('expires') expires: string,
    @Res({ passthrough: true }) res: Response // <- Esto nos permite tocar las cabeceras HTTP
  ) {
    
    // El servicio valida el tiempo y nos da el archivo
    const archivoInfo = await this.expedienteService.descargarArchivoTemporal(idExpediente, idArchivo, expires);

    // Configuramos los headers para que el navegador lo renderice como un PDF en pantalla
    // Cambia 'inline' por 'attachment' si prefieres que se descargue a la carpeta de descargas automáticamente
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${archivoInfo.nombreArchivo}"`,
    });

    // Retornamos el flujo de datos directamente
    return new StreamableFile(archivoInfo.stream);
  }


  // ------------------------------------------------------------------
  // 8. SEGURIDAD ZERO-TRUST: HISTORIAL FORENSE (EVENT SOURCING)
  // ------------------------------------------------------------------
  @Get(':numControl/historial-eventos')
  @ApiOperation({ summary: 'Seguridad: Consultar la bitácora inmutable de eventos del expediente' })
  async consultarHistorialForense(@Param('numControl') numControl: string) {
    
    const historial = await this.expedienteService.obtenerHistorialEventos(numControl);
    
    return {
      status: 'success',
      mensaje: 'Línea de tiempo forense recuperada exitosamente.',
      data: historial
    };
  }

  // ------------------------------------------------------------------
  // 9. ESCALABILIDAD: TRANSICIÓN A BÓVEDA FRÍA (COLD STORAGE)
  // ------------------------------------------------------------------
  @Post(':numControl/congelar')
  @ApiOperation({ summary: 'Almacenamiento: Comprimir PDFs y transferir a Bóveda Fría' })
  // @UseGuards(FirebaseAuthGuard) <-- Recuerda mantener tu guardia activo
  async congelarExpediente(
    @Param('numControl') numControl: string,
    @Req() req: Request
  ) {
    
    // 1. Extraemos credenciales silenciosamente (Zero-Trust)
    const ipOrigen = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP_DESCONOCIDA') as string;
    const usuarioAuth = req.user?.idUsuario || req.user?.uid;
    const idUsuarioAdmin = usuarioAuth;

    if (!idUsuarioAdmin) {
      throw new UnauthorizedException('No se pudo identificar al administrador para el registro forense.');
    }

    // 2. Detonamos la maquinaria pesada de compresión
    const resultado = await this.expedienteService.congelarExpedienteEnBovedaFria(
      numControl,
      idUsuarioAdmin,
      ipOrigen
    );
    
    return {
      status: 'success',
      mensaje: 'El expediente ha sido comprimido y transferido a la Bóveda Fría exitosamente.',
      data: resultado
    };
  }

  // ------------------------------------------------------------------
  // 10. VISOR ZERO-TRUST CON MARCA DE AGUA ANTI-FUGAS
  // ------------------------------------------------------------------
  @Get(':numControl/documentos/:idArchivo/visor-seguro')
  @ApiOperation({ summary: 'Seguridad: Ver documento con marca de agua dinámica inyectada' })
  async verDocumentoProtegido(
    @Param('numControl') numControl: string,
    @Param('idArchivo') idArchivo: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    
    // 1. Extraemos los datos para el sello
    const ipOrigen = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP_DESCONOCIDA') as string;
    
    const usuarioAuth = req.user?.idUsuario || req.user?.uid;
    
    const identidadForense = usuarioAuth as string;

    // 2. Buscamos el archivo en la base de datos (reutilizando lógica o haciendo una consulta rápida)
    // *Nota: Aquí deberías validar que el archivo exista en la BD y sacar su rutaLocal.*
    // Para simplificar, asumiremos que tu Service tiene un método para sacar la ruta:
    const archivoDigital = await this.expedienteService.obtenerDetalleArchivo(idArchivo); 
    
    // 3. Inyectamos la marca de agua al vuelo
    const bufferSellado = await this.expedienteService.sellarDocumentoConMarcaDeAgua(
      archivoDigital.rutaLocal, 
      identidadForense, 
      ipOrigen
    );

    // 4. Configuramos los headers y enviamos
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': bufferSellado.length,
      'Content-Disposition': `inline; filename="PROTEGIDO_${archivoDigital.nombreOriginal}"`,
    });

    return new StreamableFile(bufferSellado);
  }

  // ------------------------------------------------------------------
  // 12. GESTIÓN DOCUMENTAL: BAJA LÓGICA DE ARCHIVOS (SOFT DELETE)
  // ------------------------------------------------------------------
  @Delete(':numControl/documentos/:idArchivo')
  @ApiOperation({ summary: 'Admin/Ventanilla: Eliminación lógica y forense de un documento del expediente' })
  async desvincularDocumento(
    @Param('numControl') numControl: string, // Se pide por semántica REST y trazabilidad
    @Param('idArchivo') idArchivo: string,
    @Req() req: Request
  ) {
    const ipOrigen = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP_DESCONOCIDA') as string;
    const idUsuarioAdmin = req.user?.idUsuario;

    if (!idUsuarioAdmin) {
      throw new UnauthorizedException('No se identificó la firma criptográfica del administrador.');
    }

    await this.expedienteService.eliminarDocumentoLogicamente(idArchivo, idUsuarioAdmin, ipOrigen);

    return { 
      status: 'success', 
      mensaje: 'El documento ha sido desvinculado exitosamente. El evento ha quedado registrado en la bitácora inmutable.' 
    };
  }
}