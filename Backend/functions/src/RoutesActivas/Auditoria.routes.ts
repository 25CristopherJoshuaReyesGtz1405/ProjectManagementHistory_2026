/**
 * ====================================================================
 * RUTAS DE AUDITORÍA FORENSE Y EXCELENCIA OPERATIVA (SIGAH v3.0)
 * ====================================================================
 * Este módulo centraliza los endpoints para la supervisión forense,
 * la reversión de transacciones (Time Machine), el aislamiento de datos
 * y la minería de métricas operativas.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from '../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js';
import * as ServicioAuditoria from '../ServiciosActivos/Auditoria.js';
import authMiddleware from '../APIs/auth.middleware.js';
import { AppError } from '../UtilidadesActivas/AppError.js';

const router = Router();

// Middleware de seguridad global para el módulo: Ninguna ruta es pública
router.use(authMiddleware);

/**
 * @route   GET /api/auditoria/recientes
 * @desc    Consulta el historial de acciones recientes (Log Forense).
 * @access  Privado (Restringido para rol CAPTURISTA)
 */
router.get('/recientes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    
    // Bloqueo estricto de visibilidad para personal operativo
    if (rol === 'CAPTURISTA') {
      throw new AppError('Privilegios insuficientes para consultar la trazabilidad forense del sistema.', 403);
    }

    // Consulta optimizada para la carga inicial del Dashboard
    const snapshot = await db.collection('logActividad')
      .orderBy('fecha', 'desc')
      .limit(50)
      .get();
      
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.status(200).json({
      status: 'success',
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auditoria/revertir
 * @desc    Ejecuta un rollback quirúrgico de un documento a su estado anterior utilizando la captura Diffing.
 * @access  Privado (Exclusivo rol ADMIN)
 */
router.post('/revertir', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    
    // El rollback modifica datos históricos, solo TI puede ejecutarlo
    if (rol !== 'ADMIN') {
      throw new AppError('Acceso denegado. Solo infraestructura de TI puede ejecutar reversiones (Time Machine) en la base de datos.', 403);
    }

    const { logId } = req.body;
    if (!logId) {
      throw new AppError('Se requiere el identificador del log (logId) para proceder con la reversión.', 400);
    }

    const adminUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    await ServicioAuditoria.revertirCambioQuirurgico(logId, adminUid, ipAddress);

    res.status(200).json({
      status: 'success',
      message: 'El estado del documento ha sido restaurado exitosamente a su versión previa.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auditoria/cuarentena
 * @desc    Aísla un registro en cuarentena institucional para evitar su eliminación directa (Soft-Delete blindado).
 * @access  Privado (Requiere rol ADMIN o JEFATURA)
 */
router.post('/cuarentena', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    
    // Solo líderes de área pueden desaparecer un documento de las consultas públicas
    if (!['ADMIN', 'JEFATURA'].includes(rol)) {
      throw new AppError('Autorización denegada. Solo la Jefatura puede aislar registros del acervo.', 403);
    }

    const { coleccion, documentoId, motivo } = req.body;
    if (!coleccion || !documentoId || !motivo) {
      throw new AppError('Parámetros de cuarentena incompletos. Especifique colección, documentoId y la justificación legal.', 400);
    }

    const jefeUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    await ServicioAuditoria.enviarACuarentena(coleccion, documentoId, jefeUid, ipAddress, motivo);

    res.status(200).json({
      status: 'success',
      message: `El registro ${documentoId} ha sido extraído y aislado en la cuarentena institucional.`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auditoria/productividad
 * @desc    Calcula y obtiene los KPIs de productividad (Lead Time) de los capturistas en un rango de fechas.
 * @access  Privado (Exclusivo rol JEFATURA)
 */
router.get('/productividad', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    
    if (rol !== 'JEFATURA') {
      throw new AppError('Métricas confidenciales. Acceso restringido a la Jefatura de Servicios Escolares.', 403);
    }

    const { inicio, fin } = req.query;
    if (!inicio || !fin) {
      throw new AppError('Debe definir el periodo de evaluación (inicio, fin) en formato YYYY-MM-DD.', 400);
    }

    const fechaInicio = new Date(inicio as string);
    const fechaFin = new Date(fin as string);

    const metricasOperativas = await ServicioAuditoria.analizarProductividadOperativa(fechaInicio, fechaFin);

    res.status(200).json({
      status: 'success',
      data: metricasOperativas
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auditoria/dictamen-lga
 * @desc    Genera la metadata estructurada requerida por la Ley General de Archivos (LGA) para transferencias.
 * @access  Privado (Requiere rol JEFATURA o AUDITOR)
 */
router.get('/dictamen-lga', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    
    if (!['JEFATURA', 'AUDITOR'].includes(rol)) {
      throw new AppError('Acceso denegado. Perfil no autorizado para emitir reportes de cumplimiento normativo.', 403);
    }

    const anioFiscal = parseInt(req.query.anio as string, 10);
    if (isNaN(anioFiscal)) {
      throw new AppError('Proporcione un año fiscal numérico válido para el dictamen (Ej. ?anio=2025).', 400);
    }

    const dictamen = await ServicioAuditoria.generarMetadataParaDictamenLGA(anioFiscal);

    res.status(200).json({
      status: 'success',
      data: dictamen
    });
  } catch (error) {
    next(error);
  }
});

export default router;