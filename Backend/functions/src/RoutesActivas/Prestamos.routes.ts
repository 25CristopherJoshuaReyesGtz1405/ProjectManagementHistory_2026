/**
 * ============================================================================
 * MÓDULO DE RUTAS: LOGÍSTICA DE PRÉSTAMOS FÍSICOS (SIGAH v3.0)
 * ============================================================================
 * @description Orquesta la capa de red para el tránsito del acervo físico.
 * Expone endpoints para el ruteo logístico (Pick-Path), Webhooks IoT M2M,
 * Protocolos Zero-Trust efímeros (OTP), Colas Reactivas y Topografía Analítica.
 * 
 * @author Cristopher Joshua Reyes Gutiérrez
 * @version 3.0.0
 * ============================================================================
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import * as ServicioPrestamos from "../ServiciosActivos/Prestamos.js";
import authMiddleware from "../APIs/auth.middleware.js";
import { validarApiKey } from '../APIs/apiKey.middleware.js';
import { AppError } from "../UtilidadesActivas/AppError.js";
import { string } from "zod";

const router = Router();

// ============================================================================
// 1. WEBHOOKS DE HARDWARE E INTEGRACIÓN IoT (Machine-to-Machine)
// Se declaran antes del middleware JWT porque el hardware usa API Keys
// ============================================================================

/**
 * @route   POST /api/prestamos/iot/retorno-masivo
 * @desc    Webhook para Escáneres (RFID/Barcode). Ejecuta retornos en ráfaga.
 * @access  Privado (M2M) - Requiere x-api-key en Headers.
 */
router.post('/iot/retorno-masivo', validarApiKey('iot:escaneo_fisico'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payloadHardware = req.body;
    
    if (!payloadHardware || !Array.isArray(payloadHardware.lecturas) || !payloadHardware.scannerId) {
      throw new AppError('Payload de hardware inválido. Se espera: { scannerId, lecturas: [], timestamp }', 400);
    }
    
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Hardware_Desconocida';
    
    const resultado = await ServicioPrestamos.procesarRetornoMasivoIoT(payloadHardware, ipAddress);
    
    // Status 207 Multi-Status es el estándar para lotes donde algunos pueden fallar
    res.status(207).json({
      status: 'partial_success',
      message: `Ráfaga IoT procesada. Exitosos: ${resultado.exitosos}, Fallidos: ${resultado.fallidos.length}`,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
});

// A partir de este punto, todas las rutas requieren validación humana vía Token JWT
router.use(authMiddleware);

// ============================================================================
// 2. LOGÍSTICA DE PRÉSTAMOS, COLAS Y TOPOGRAFÍA
// ============================================================================

/**
 * @route   POST /api/prestamos/salida-individual
 * @desc    Registro directo (Ventanilla) evaluando Trust Score y bloqueos.
 * @access  Privado
 */
router.post("/salida-individual", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numControl, solicitanteUid, observaciones } = req.body;
    const adminUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!numControl || !solicitanteUid) throw new AppError("Ausencia de identificadores logísticos.", 400);

    const resultado = await ServicioPrestamos.registrarSalidaIndividual(numControl, solicitanteUid, observaciones, adminUid, ipAddress);
    res.status(201).json({ status: 'success', data: resultado });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/prestamos/encolar
 * @desc    Agrega un ticket a la lista de espera reactiva de un documento en tránsito.
 * @access  Privado
 */
router.post("/encolar", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numControl } = req.body;
    const solicitanteUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!numControl) throw new AppError("Debe indicar la matrícula del expediente objetivo.", 400);

    await ServicioPrestamos.encolarPeticionExpediente(numControl, solicitanteUid, ipAddress);
    
    res.status(200).json({ 
      status: 'success', 
      message: "Ticket asignado. Se le notificará asíncronamente cuando el documento sea liberado." 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/prestamos/auditoria-masiva
 * @desc    Reserva lote de expedientes aplicando Pick-Path Optimization y generación OTP.
 * @access  Privado
 */
router.post("/auditoria-masiva", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numControles, solicitanteUid, observaciones } = req.body;
    const adminUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!Array.isArray(numControles) || numControles.length === 0) {
      throw new AppError("Debe inyectar un arreglo válido de matrículas.", 400);
    }

    const resultado = await ServicioPrestamos.generarReservaConOtp(numControles, solicitanteUid, observaciones, adminUid, ipAddress);
    
    res.status(201).json({
      status: 'success',
      message: "Ruta logística generada. Los tokens criptográficos OTP expiran en 15 minutos.",
      data: resultado
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/prestamos/:id/confirmar-otp
 * @desc    Verifica la firma biométrica/OTP en ventanilla para certificar la entrega.
 * @access  Privado
 */
router.post("/:id/confirmar-otp", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const adminUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!otp || otp.toString().length !== 6) {
      throw new AppError("Formato de token inválido. El OTP es estrictamente un número de 6 dígitos.", 400);
    }

    await ServicioPrestamos.confirmarEntregaFisica(id as string, otp.toString(), adminUid, ipAddress);
    
    res.status(200).json({ 
      status: 'success',
      message: "Firma criptográfica verificada. Documento entregado exitosamente." 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/prestamos/:id/retorno
 * @desc    Registra la devolución en ventanilla, evaluando delta físico (desgaste) y colas de espera.
 * @access  Privado
 */
router.patch("/:id/retorno", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { estadoRetorno, observacionesRetorno } = req.body;
    const adminUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!estadoRetorno) throw new AppError("Auditoría: Es obligatorio evaluar la integridad física de la carpeta.", 400);

    const resultado = await ServicioPrestamos.registrarRetornoConDelta(id as string, estadoRetorno, observacionesRetorno, adminUid, ipAddress);
    
    let mensaje = "Recepción de documento confirmada.";
    if (resultado.siniestroReportado) mensaje += " [ALERTA: Se ha documentado degradación física].";
    if (resultado.reAsignadoA) mensaje += ` [EVENTO: Documento enrutado automáticamente al siguiente en lista de espera].`;

    res.status(200).json({ 
      status: 'success', 
      message: mensaje,
      reAsignado: !!resultado.reAsignadoA
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. ANALÍTICA Y CADENA DE CUSTODIA
// ============================================================================

/**
 * @route   GET /api/prestamos/analitica/topografia
 * @desc    Machine Learning Base: Genera insights de reubicación física de cajas (Hot Storage).
 * @access  Privado (Restringido a JEFATURA)
 */
router.get('/analitica/topografia', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    if (rol !== 'JEFATURA') {
      throw new AppError('Exclusividad de Jefatura. Operación analítica denegada.', 403);
    }

    const insights = await ServicioPrestamos.generarInsightsTopograficos();
    
    res.status(200).json({
      status: 'success',
      data: insights
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/prestamos/:id/punto-control
 * @desc    Firma un salto logístico para la Cadena de Custodia forense.
 * @access  Privado
 */
router.post('/:id/punto-control', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { ubicacionActual } = req.body;
    const adminUid = (req as any).user.uid;

    if (!ubicacionActual) throw new AppError('Debe especificar la coordenada o área de recepción actual.', 400);

    await ServicioPrestamos.registrarPuntoDeControl(id as string, ubicacionActual, adminUid);
    
    res.status(200).json({
      status: 'success',
      message: 'Firma de micro-salto logístico (Cadena de Custodia) sellada exitosamente.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;