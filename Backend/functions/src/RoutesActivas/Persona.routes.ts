/**
 * ============================================================================
 * MÓDULO DE RUTAS: IDENTIDAD MAESTRA (SIGAH v3.0)
 * ============================================================================
 * @description Orquesta la capa de red del Padrón Maestro de Identidades.
 * Expone endpoints para el patrón Upsert, la deduplicación predictiva (IA),
 * la fusión forense, el Olvido Criptográfico (ARCO) y el SSO Federado.
 * 
 * @author Cristopher Joshua Reyes Gutiérrez
 * @version 3.0.0
 * ============================================================================
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import * as ServicioPersona from '../ServiciosActivos/Persona.js';
import authMiddleware from '../APIs/auth.middleware.js';
import { AppError } from '../UtilidadesActivas/AppError.js';

const router = Router();

// Protocolo de seguridad global: Ninguna identidad puede ser expuesta sin un JWT válido.
router.use(authMiddleware);

/**
 * ============================================================================
 * 1. RUTAS DE CONSULTA Y BÚSQUEDA (CON DATA MASKING)
 * ============================================================================
 */

/**
 * @route   GET /api/personas/search
 * @desc    Buscador Omnibox de identidades. Utiliza N-gramas (Fuzzy Matching).
 * @access  Privado (Aplica Data Masking para roles operativos)
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    const rolUsuario = (req as any).user.rol;
    
    if (!q) return res.status(200).json({ status: 'success', data: [] });
    
    // Pasamos el rol para que el servicio censure el RFC/CURP si es necesario
    const resultados = await ServicioPersona.buscarIdentidadesPorNombre(q as string, rolUsuario);
    
    res.status(200).json({ status: 'success', data: resultados });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/personas/id/:idDocumento
 * @desc    Recupera una identidad específica mediante su ID de Firestore (Caché LRU activo).
 * @access  Privado
 */
router.get('/id/:idDocumento', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idDocumento } = req.params;
    const rolUsuario = (req as any).user.rol;
    
    const resultado = await ServicioPersona.buscarIdentidadPorId(idDocumento as string, rolUsuario);
    res.status(200).json({ status: 'success', data: resultado });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/personas/matricula/:numControl
 * @desc    Triangula y localiza la identidad maestra dueña de una matrícula específica.
 * @access  Privado
 */
router.get('/matricula/:numControl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numControl } = req.params;
    const rolUsuario = (req as any).user.rol;
    
    const resultado = await ServicioPersona.buscarIdentidadPorNumControl(numControl as string, rolUsuario);
    res.status(200).json({ status: 'success', data: resultado });
  } catch (error) {
    next(error);
  }
});

/**
 * ============================================================================
 * 2. RUTAS DE MUTACIÓN, CREACIÓN Y VINCULACIÓN
 * ============================================================================
 */

/**
 * @route   POST /api/personas/asegurar
 * @desc    Patrón Upsert Transaccional. Asegura que la CURP sea única en todo el sistema.
 * @access  Privado
 */
router.post('/asegurar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usuarioUid = (req as any).user.uid;
    
    // La validación estricta (Zod) ahora se ejecuta dentro de la capa de servicio
    // para garantizar atomicidad en la "Purga Inmunológica".
    const personaId = await ServicioPersona.asegurarIdentidadMaestra(req.body, usuarioUid);
    
    res.status(200).json({ 
      status: 'success',
      message: 'Identidad biométrica procesada y asegurada correctamente.',
      personaId 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/personas/:id/vincular
 * @desc    Conecta una nueva matrícula al arreglo "expedientesAsociados" de la identidad.
 * @access  Privado
 */
router.put('/:id/vincular', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { numControl } = req.body;
    const usuarioUid = (req as any).user.uid;

    if (!numControl || numControl.trim() === '') {
      throw new AppError('La matrícula a vincular es un parámetro obligatorio.', 400);
    }

    await ServicioPersona.vincularExpedienteAcademico(id as string, numControl, usuarioUid);
    
    res.status(200).json({ 
      status: 'success',
      message: 'Vínculo de dualidad académica actualizado y resguardado.' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ============================================================================
 * 3. KILLER FEATURES: MACHINE LEARNING, DEDUPLICACIÓN Y COMPLIANCE ARCO
 * ============================================================================
 */

/**
 * @route   GET /api/personas/ia/analisis-duplicidad
 * @desc    Dispara el worker de Machine Learning para detectar posibles identidades duplicadas.
 * @access  Privado (Restringido a JEFATURA y ADMIN)
 */
router.get('/ia/analisis-duplicidad', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    if (!['ADMIN', 'JEFATURA'].includes(rol)) {
      throw new AppError('Acceso denegado. Exclusivo para Jefatura (Auditoría Predictiva).', 403);
    }

    const umbral = req.query.umbral ? parseInt(req.query.umbral as string, 10) : 85;
    const sugerencias = await ServicioPersona.analizarDuplicidadPredictiva(umbral);

    res.status(200).json({
      status: 'success',
      message: `Análisis predictivo completado. Se detectaron ${sugerencias.length} posibles anomalías.`,
      data: sugerencias
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/personas/fusionar
 * @desc    Deduplicación Forense. Fusiona el registro duplicado en el maestro y aísla el error.
 * @access  Privado (Restringido a ADMIN)
 */
router.post('/fusionar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    if (rol !== 'ADMIN') {
      throw new AppError('Resolución de identidades requiere privilegios de Administrador de TI.', 403);
    }

    const { idMaestro, idDuplicado } = req.body;
    if (!idMaestro || !idDuplicado) {
      throw new AppError('Parámetros incompletos: Se requieren los identificadores Maestro y Duplicado.', 400);
    }

    const adminUid = (req as any).user.uid;
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_Desconocida';

    await ServicioPersona.fusionarIdentidades(idMaestro, idDuplicado, adminUid, ipAddress);

    res.status(200).json({
      status: 'success',
      message: 'Fusión forense ejecutada. El perfil duplicado ha sido absorbido y aislado en cuarentena.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/personas/:id/olvido-arco
 * @desc    Compliance. Ejecuta la destrucción criptográfica del PII respetando la estadística académica.
 * @access  Privado (Restringido a JEFATURA)
 */
router.post('/:id/olvido-arco', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    if (rol !== 'JEFATURA') {
      throw new AppError('Protocolo bloqueado. Solo el Oficial de Privacidad (Jefatura) puede ejecutar el Derecho al Olvido.', 403);
    }

    const { id } = req.params;
    const adminUid = (req as any).user.uid;

    await ServicioPersona.ejecutarOlvidoCriptografico(id as string, adminUid);

    res.status(200).json({
      status: 'success',
      message: 'Protocolo de Olvido Criptográfico (ARCO) aplicado. Datos de PII destruidos irreversiblemente.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/personas/:id/sso-token
 * @desc    Identidad Federada (IdP). Emite un Token JWT (Assertion) para ecosistemas externos del TecNM.
 * @access  Privado
 */
router.get('/:id/sso-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // La emisión de un token federado puede ser solicitada por el propio usuario (si hubiera portal) 
    // o por un sistema interno como la Bolsa de Trabajo.
    const token = await ServicioPersona.generarTokenFederadoSSO(id as string);

    res.status(200).json({
      status: 'success',
      message: 'Identity Provider Assertion generado correctamente.',
      data: { assertion_token: token }
    });
  } catch (error) {
    next(error);
  }
});

export default router;