/**
 * ============================================================================
 * MÓDULO DE RUTAS: MOTOR DE TITULACIÓN (SIGAH v3.0)
 * ============================================================================
 * @description Endpoints para la gestión del ciclo de vida del egresado.
 * Protege la Máquina de Estados Finita (FSM), Triage OCR, conciliación de pagos
 * mediante OCC, Smart Contracts (Sínodos) y Fast-Track Histórico.
 * 
 * @author Cristopher Joshua Reyes Gutiérrez
 * @version 3.0.0
 * ============================================================================
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import * as ServicioTitulacion from '../ServiciosActivos/Titulacion.js';
import authMiddleware from '../APIs/auth.middleware.js';
import { AppError } from '../UtilidadesActivas/AppError.js';

const router = Router();

// Protocolo Zero-Trust: Todas las rutas de titulación exigen autenticación.
router.use(authMiddleware);

/**
 * @route   POST /api/titulacion/iniciar
 * @desc    PASO 1: Evalúa pre-requisitos e inicializa la máquina de estados.
 * @access  Privado (Egresado o Ventanilla)
 */
router.post('/iniciar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numControl } = req.body;
    const solicitanteUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!numControl) throw new AppError('Ausencia de identificador académico (Matrícula).', 400);

    const tramiteId = await ServicioTitulacion.iniciarTramiteTitulacion(numControl, solicitanteUid, ipAddress);
    
    res.status(201).json({ 
      status: 'success', 
      message: 'Trámite de titulación inicializado. Se ha validado la liberación de créditos complementarios.',
      data: { tramiteId }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/titulacion/:id/triage
 * @desc    PASO 3: Triage Documental Cognitivo (Verificación de OCR contra Identidad Maestra).
 * @access  Privado
 */
router.post('/:id/triage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { tipoDocumento, textoOCR } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!textoOCR || !['ACTA_NACIMIENTO', 'CERTIFICADO_PREPARATORIA'].includes(tipoDocumento)) {
      throw new AppError('Parámetros de Triage inválidos. Se requiere el texto OCR y el tipo de documento.', 400);
    }

    const resultado = await ServicioTitulacion.procesarTriageDocumentalIA(id as string, tipoDocumento, textoOCR, ipAddress);
    
    res.status(200).json({ 
      status: 'success', 
      message: resultado.aprobado ? 'Validación biométrica IA aprobada.' : 'Fallo en conciliación de Identidad. Rechazo automático.',
      data: resultado 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/titulacion/:id/conciliar-pago
 * @desc    PASO 4 y 7: Conciliación de pagos bancarios con Control de Concurrencia (OCC).
 * @access  Privado (Restringido a JEFATURA y VENTANILLA)
 */
router.patch('/:id/conciliar-pago', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    if (!['JEFATURA', 'VENTANILLA'].includes(rol)) {
      throw new AppError('Privilegios insuficientes para autorizar transacciones financieras.', 403);
    }

    const { id } = req.params;
    const { tipoPago, referencia, versionEsperada } = req.body;
    const adminUid = (req as any).user.uid;

    if (!referencia || typeof versionEsperada !== 'number') {
      throw new AppError('Faltan parámetros financieros o de control de concurrencia (versionEsperada).', 400);
    }

    await ServicioTitulacion.registrarPagoConciliado(id as string, tipoPago, referencia, versionEsperada, adminUid);
    
    res.status(200).json({ status: 'success', message: `Pago de ${tipoPago} liquidado y validado en la Máquina de Estados.` });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/titulacion/:id/firma-sinodal
 * @desc    PASO 7: Inyección de firma criptográfica para el Smart Contract del Acta de Examen.
 * @access  Privado (Restringido a Sínodos Academicos)
 */
router.post('/:id/firma-sinodal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { rolSinodal, pinFirma, versionEsperada } = req.body;
    const sinodalUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!pinFirma || !['PRESIDENTE', 'SECRETARIO', 'VOCAL'].includes(rolSinodal)) {
      throw new AppError('Datos de firma electrónica inválidos o rol sinodal no reconocido.', 400);
    }

    const resultado = await ServicioTitulacion.firmarActaExamenSinodal(id as string, rolSinodal, pinFirma, sinodalUid, versionEsperada, ipAddress);
    
    res.status(200).json({ 
      status: 'success', 
      message: resultado.quorumCompletado ? 'Quórum alcanzado. Acta de Examen sellada definitivamente.' : `Firma de ${rolSinodal} inyectada exitosamente.`,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/titulacion/historico/convalidar
 * @desc    INGESTA RETROSPECTIVA: Registra un Título físico antiguo validando su Cédula vía RPA.
 * @access  Privado (Restringido a CAPTURISTA y ADMIN)
 */
router.post('/historico/convalidar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    if (!['ADMIN', 'CAPTURISTA'].includes(rol)) {
      throw new AppError('Solo el personal de archivo puede realizar ingestas retrospectivas.', 403);
    }

    const { numControl, numCedulaExtraida } = req.body;
    const capturistaUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!numControl || !numCedulaExtraida) {
      throw new AppError('Matrícula y Cédula Profesional son obligatorias para el Fast-Track Histórico.', 400);
    }

    const tramiteId = await ServicioTitulacion.convalidarTitulacionHistorica(numControl, numCedulaExtraida, capturistaUid, ipAddress);
    
    res.status(201).json({ 
      status: 'success', 
      message: 'Expediente histórico convalidado. Verificación RPA ante la SEP en progreso.',
      data: { tramiteId }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/titulacion/analitica/cuellos-botella
 * @desc    KPIs: Obtiene el Lead Time Analytics para detectar bloqueos operativos.
 * @access  Privado (Restringido a JEFATURA y ADMIN)
 */
router.get('/analitica/cuellos-botella', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    if (!['ADMIN', 'JEFATURA'].includes(rol)) throw new AppError('Acceso denegado. Exclusivo para Jefatura.', 403);

    const kpis = await ServicioTitulacion.calcularCuellosDeBotellaTitulacion();
    res.status(200).json({ status: 'success', data: kpis });
  } catch (error) {
    next(error);
  }
});

export default router;