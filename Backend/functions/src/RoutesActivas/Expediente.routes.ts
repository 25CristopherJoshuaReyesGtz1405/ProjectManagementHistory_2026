/**
 * ============================================================================
 * MÓDULO DE RUTAS: GESTIÓN DE EXPEDIENTES (SIGAH v3.0)
 * ============================================================================
 * @description API securizada para la administración del acervo histórico.
 * Orquesta la capa de red conectando con OCC, DLQ, FinOps y Data Masking.
 * 
 * @author Cristopher Joshua Reyes Gutiérrez
 * @version 3.0.0
 * ============================================================================
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import * as ServicioExpediente from '../ServiciosActivos/Expediente.js';
import authMiddleware from '../APIs/auth.middleware.js';
import { AppError } from '../UtilidadesActivas/AppError.js';
import multer from 'multer';
import os from 'os';
import { validarApiKey } from '../APIs/apiKey.middleware.js';
import { analizarDocumentoHistorico } from '../UtilidadesActivas/TriageIA.js';

const router = Router();

// ============================================================================
// CONFIGURACIÓN DE SEGURIDAD Y MEMORIA
// ============================================================================

// Protección de Heap (RAM): Multer guarda los binarios en el almacenamiento 
// temporal del SO, previniendo caídas del servidor ante CSVs de gran volumen.
const uploadSeguro = multer({ dest: os.tmpdir() });

// Protocolo Zero-Trust: Inyección global de validación JWT.
router.use(authMiddleware);

/**
 * @route   POST /api/expedientes/upload-csv
 * @desc    Inicia el Bulk Import asíncrono con Dead Letter Queue (DLQ).
 * @access  Privado (Restringido a ADMIN y CAPTURISTA)
 */
router.post('/upload-csv', uploadSeguro.single('archivo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rolUsuario = (req as any).user.rol;
    if (!['ADMIN', 'CAPTURISTA'].includes(rolUsuario)) {
      throw new AppError('Privilegios insuficientes para iniciar ingestas masivas en el acervo.', 403);
    }

    if (!req.file) {
      throw new AppError('Ausencia de archivo estructurado (CSV) en el payload.', 400);
    }
    
    const usuarioUid = (req as any).user.uid;
    
    // Ejecución "Fire and Forget": Retorna un jobId para monitoreo asíncrono.
    const jobId = await ServicioExpediente.iniciarImportacionAsincrona(req.file.path, usuarioUid);
    
    res.status(202).json({
      status: 'success',
      message: 'Lote de expedientes derivado a la cola de procesamiento (DLQ activa).',
      jobId: jobId 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/expedientes/search
 * @desc    Buscador Omnibox O(1). Resuelve coincidencias mediante N-gramas (Fuzzy Matching).
 * @access  Privado
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(200).json({ status: 'success', data: [] });
    
    const resultados = await ServicioExpediente.buscarExpedientesGlobal(q as string);
    
    res.status(200).json({ 
      status: 'success', 
      data: resultados 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/expedientes/
 * @desc    Obtiene el listado general paginado para la carga inicial de vistas.
 * @access  Privado
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resultados = await ServicioExpediente.consultarExpedientes();
    res.status(200).json({ 
      status: 'success', 
      data: resultados 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/expedientes/
 * @desc    Inicializa un expediente. La sanitización con Zod y la "Purga Inmunológica" 
 *          (eliminación de undefined) se delegan al servicio central.
 * @access  Privado
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usuarioUid = (req as any).user.uid;
    
    // La validación Zod ahora vive dentro de crearExpediente para asegurar la integridad de la purga.
    await ServicioExpediente.crearExpediente(req.body, usuarioUid);
    
    res.status(201).json({ 
      status: 'success',
      message: 'Expediente inicializado, sellado criptográficamente y resguardado.' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/expedientes/:numControl
 * @desc    Recupera un expediente aplicando Data Masking (Ocultamiento de PII) dinámico.
 * @access  Privado
 */
router.get('/:numControl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numControl } = req.params;
    const rolUsuario = (req as any).user.rol;

    const expediente = await ServicioExpediente.consultarExpedientePorNumControl(numControl as string, rolUsuario);
    
    if (!expediente) {
      throw new AppError('Expediente no localizado en la topografía del acervo histórico.', 404);
    }
    
    res.status(200).json({ 
      status: 'success', 
      data: expediente 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/expedientes/:numControl
 * @desc    Mutación integral protegida por Control de Concurrencia Optimista (OCC).
 * @access  Privado
 */
router.put('/:numControl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numControl } = req.params;
    const { cambios, motivo, versionEsperada } = req.body;
    const usuarioUid = (req as any).user.uid;

    if (!motivo || motivo.trim().length < 10) {
      throw new AppError('Protocolo forense: Se exige justificación detallada (>10 chars) para autorizar la mutación.', 400);
    }

    if (typeof versionEsperada !== 'number') {
      throw new AppError('Ausencia de metadata.version. Se requiere para prevenir colisiones concurrentes (OCC).', 400);
    }

    await ServicioExpediente.actualizarExpedienteOCC(numControl as string, cambios, usuarioUid, motivo, versionEsperada);
    
    res.status(200).json({ 
      status: 'success',
      message: 'Expediente actualizado y nueva versión forense inyectada en la bitácora.' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/expedientes/:numControl/topografia
 * @desc    Actualiza exclusivamente coordenadas físicas. Evalúa heurísticas de capacidad en cajas.
 * @access  Privado
 */
router.patch('/:numControl/topografia', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numControl } = req.params;
    const { ubicacion, versionEsperada } = req.body;
    const usuarioUid = (req as any).user.uid;

    if (!ubicacion || typeof versionEsperada !== 'number') {
      throw new AppError('Estructura topográfica o versión de documento (OCC) ausente.', 400);
    }

    await ServicioExpediente.actualizarUbicacionFisica(numControl as string, ubicacion, usuarioUid, versionEsperada);
    
    res.status(200).json({ 
      status: 'success',
      message: 'Coordenadas topográficas del archivo físico recalibradas exitosamente.' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/expedientes/:numControl/exportar
 * @desc    Data Portability. Empaqueta el expediente con firma criptográfica.
 * @access  Privado (Restringido a ADMIN y JEFATURA)
 */
router.get('/:numControl/exportar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rolUsuario = (req as any).user.rol;
    if (!['ADMIN', 'JEFATURA'].includes(rolUsuario)) {
      throw new AppError('Exclusividad de Jefatura. Operación de extracción de datos certificada denegada.', 403);
    }

    const { numControl } = req.params;
    const adminUid = (req as any).user.uid;

    const paquete = await ServicioExpediente.exportarExpedienteCertificado(numControl as string, adminUid, rolUsuario);
    
    res.status(200).json({ 
      status: 'success', 
      data: paquete 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/expedientes/:numControl/descongelar
 * @desc    Invierte el ciclo FinOps: Restaura un expediente desde el Cold Storage a la memoria caliente (Firestore).
 * @access  Privado (Restringido a ADMIN)
 */
router.post('/:numControl/descongelar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rolUsuario = (req as any).user.rol;
    if (rolUsuario !== 'ADMIN') {
      throw new AppError('Acceso denegado. Solo infraestructura de TI puede ejecutar protocolos de descongelamiento (FinOps).', 403);
    }

    const { numControl } = req.params;
    const adminUid = (req as any).user.uid;
    
    await ServicioExpediente.restaurarDesdeBovedaFria(numControl as string, adminUid);
    
    res.status(200).json({
      status: 'success',
      message: 'El expediente ha sido restaurado a la memoria operativa (Firestore) desde la Bóveda Fría.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/expedientes/triage-ia
 * @desc    Triage Cognitivo: Analiza texto extraído vía OCR mediante Inteligencia Artificial.
 * @access  Privado
 */
router.post('/triage-ia', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { textoOCR } = req.body;
    
    if (!textoOCR || textoOCR.trim().length < 10) {
      throw new AppError('El flujo de texto OCR es insuficiente para ejecutar un análisis cognitivo confiable.', 400);
    }
    
    const analisis = await analizarDocumentoHistorico(textoOCR);
    
    res.status(200).json({
      status: 'success',
      data: analisis
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// RUTAS EXTERNAS (Interoperabilidad Institucional)
// ============================================================================

/**
 * @route   GET /api/expedientes/externo/expediente/:numControl
 * @desc    Interoperabilidad (ej. Bolsa de Trabajo). Protegida por API Key y Data Masking.
 * @access  Público-Privado (Requiere x-api-key en Headers)
 */
router.get('/externo/expediente/:numControl', validarApiKey('leer:estatus_expediente'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numControl } = req.params;
    
    // Forzamos el rol "EXTERNO" para que el servicio aplique Data Masking estricto
    const expediente = await ServicioExpediente.consultarExpedientePorNumControl(numControl as string, 'EXTERNO');
    
    if (!expediente) {
      throw new AppError('Matrícula no localizada en el padrón.', 404);
    }

    // DTO Ultraligero para consumo externo
    res.status(200).json({
      status: 'success',
      data: {
        numControl: expediente.numControl,
        estatus: expediente.estatus,
        carrera: expediente.carrera
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;