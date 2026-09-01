/**
 * ============================================================================
 * MÓDULO DE RUTAS: ESTADÍSTICAS Y PRODUCTIVIDAD (SIGAH v3.0)
 * ============================================================================
 * @description Endpoints para el Dashboard Gerencial.
 * Aplica FinOps sirviendo datos consolidados desde la memoria RAM.
 * ============================================================================
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import * as ServicioEstadisticas from '../ServiciosActivos/Estadisticas.js';
import authMiddleware from '../APIs/auth.middleware.js';
import { AppError } from '../UtilidadesActivas/AppError.js';
import { validarApiKey } from '../APIs/apiKey.middleware.js';

const router = Router();

/**
 * @route   POST /api/estadisticas/cron/consolidar
 * @desc    Endpoint protegido para el Cron-Worker de Google Cloud Scheduler.
 * @access  M2M (Requiere API Key)
 */
router.post('/cron/consolidar', validarApiKey('cron:consolidar_shards'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ServicioEstadisticas.consolidarShardsEnCache();
    res.status(200).json({ status: 'success', message: 'Shards estadísticos consolidados en memoria RAM exitosamente.' });
  } catch (error) {
    next(error);
  }
});

// A partir de aquí, las rutas requieren autenticación humana (JWT)
router.use(authMiddleware);

/**
 * @route   GET /api/estadisticas/dashboard
 * @desc    Retorna las métricas globales del acervo institucional.
 * @access  Privado (Restringido a ADMIN y JEFATURA)
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rol = (req as any).user.rol;
    if (!['ADMIN', 'JEFATURA'].includes(rol)) {
      throw new AppError('Acceso denegado. Dashboard exclusivo para perfiles directivos.', 403);
    }

    const dashboard = await ServicioEstadisticas.consultarDashboardGerencial();
    res.status(200).json({ status: 'success', data: dashboard });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/estadisticas/leaderboard
 * @desc    Retorna el top 10 de capturistas con mejor Quality Score del mes.
 * @access  Privado
 */
router.get('/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leaderboard = await ServicioEstadisticas.generarLeaderboardProductividad();
    res.status(200).json({ status: 'success', data: leaderboard });
  } catch (error) {
    next(error);
  }
});

export default router;