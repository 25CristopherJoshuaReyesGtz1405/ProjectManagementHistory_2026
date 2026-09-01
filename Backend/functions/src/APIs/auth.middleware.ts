/**
 * ============================================================================
 * MIDDLEWARE: PROTECCIÓN ZERO-TRUST (JWT)
 * ============================================================================
 * Intercepta las peticiones, extrae el Bearer Token y verifica su firma 
 * criptográfica contra Firebase Auth antes de permitir el paso a los controladores.
 * ============================================================================
 */

import type { Request, Response, NextFunction } from 'express';
import { auth } from '../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js';
import { type DecodedIdToken } from 'firebase-admin/auth';
import { AppError } from '../UtilidadesActivas/AppError.js';

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const headerToken = req.headers.authorization;

    if (!headerToken || !headerToken.startsWith('Bearer ')) {
      // Delegamos el error al manejador centralizado de server.ts
      throw new AppError('Acceso denegado. Token JWT no proporcionado o formato de cabecera inválido.', 401);
    }

    const token = headerToken.split('Bearer ')[1].trim();

    // Verificación asíncrona contra los servidores de Google Cloud Identity
    const decodedToken = await auth.verifyIdToken(token);
    
    // Inyectamos el payload del token (UID, Rol, etc.) en la petición
    req.user = decodedToken;
    
    next();
  } catch (error: any) {
    // Captura firmas inválidas, tokens expirados o revocados prematuramente
    next(new AppError(`Credenciales rechazadas: ${error.message || 'Token inválido o expirado.'}`, 403));
  }
};

export default authMiddleware;