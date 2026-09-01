/**
 * ============================================================================
 * MÓDULO DE RUTAS: INTEROPERABILIDAD B2B (SIGAH v3.0)
 * ============================================================================
 * @description API Pública B2B. Expone endpoints de aserción criptográfica 
 * y gestión de convenios. Orquesta Middlewares híbridos (JWT para Jefatura, 
 * API Keys para empresas).
 * ============================================================================
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import * as ServicioInteroperabilidad from '../ServiciosActivos/Interoperabilidad.js';
import authMiddleware from '../APIs/auth.middleware.js';
import { AppError } from '../UtilidadesActivas/AppError.js';
import crypto from 'crypto';

const router = Router();

/**
 * ============================================================================
 * RUTAS INTERNAS (Protegidas por JWT - Uso exclusivo de Servicios Escolares)
 * ============================================================================
 */

/**
 * @route   POST /api/b2b/convenios
 * @desc    Registra una nueva empresa en el ecosistema (Exige Oficio Legal).
 * @access  Privado (Restringido a JEFATURA)
 */
router.post('/convenios', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    if (rol !== 'JEFATURA') {
      throw new AppError('Exclusividad directiva: Solo Jefatura puede suscribir convenios legales de interoperabilidad.', 403);
    }

    const { nombreEmpresa, folioOficioLegal, limiteDiario, diasVigencia } = req.body;
    const jefeEscolaresUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    if (!nombreEmpresa || !folioOficioLegal || !limiteDiario || !diasVigencia) {
      throw new AppError('Ausencia de parámetros legales o cuotas operativas.', 400);
    }

    const credenciales = await ServicioInteroperabilidad.registrarConvenioInstitucional(
      nombreEmpresa, folioOficioLegal, limiteDiario, diasVigencia, jefeEscolaresUid, ipAddress
    );
    
    res.status(201).json({ 
      status: 'success', 
      message: 'Convenio registrado. ENTREGUE ESTA API KEY AHORA. No podrá visualizarse nuevamente.',
      data: credenciales 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ============================================================================
 * RUTAS EXTERNAS M2M (Protegidas por API Keys - Uso de Empresas Externas)
 * ============================================================================
 */

/**
 * @description Middleware Interno de Autenticación B2B.
 */
const validarConvenioB2B = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKeyPlana = req.headers['x-api-key'];
    if (!apiKeyPlana || typeof apiKeyPlana !== 'string') {
      throw new AppError('Acceso denegado. Se requiere una cabecera x-api-key válida.', 401);
    }

    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';
    const apiKeyHash = crypto.createHash('sha256').update(apiKeyPlana).digest('hex');

    const empresaSolicitante = await ServicioInteroperabilidad.auditarCuotaConsumoExterna(apiKeyHash, ipAddress);
    (req as any).empresaExterna = empresaSolicitante; 
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/b2b/verificar
 * @desc    Emite la aserción criptográfica sobre el estatus de egreso (PKI/RSA).
 * @access  Público B2B (Requiere x-api-key)
 */
router.get('/verificar', validarConvenioB2B, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identificador, tipo } = req.query;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';
    const empresaSolicitante = (req as any).empresaExterna;

    if (!identificador || !tipo || !['MATRICULA', 'CURP'].includes(tipo as string)) {
      throw new AppError('Parámetros inválidos. Especifique ?identificador=X & tipo=MATRICULA|CURP', 400);
    }

    const asercion = await ServicioInteroperabilidad.verificarEstatusEgresado(
      identificador as string, 
      tipo as 'MATRICULA' | 'CURP', 
      empresaSolicitante, 
      ipAddress
    );
    
    res.status(200).json({ 
      status: 'success', 
      message: 'Aserción institucional generada y firmada criptográficamente (RSA).',
      data: asercion 
    });
  } catch (error) {
    next(error);
  }
});

export default router;