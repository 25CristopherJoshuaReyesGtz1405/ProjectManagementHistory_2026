import { type Request, type Response, type NextFunction } from 'express';
import { db } from '../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js';
import crypto from 'crypto';

export const validarApiKey = (permisoRequerido: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKeyRecibida = req.headers['x-api-key'] as string;
      if (!apiKeyRecibida) throw new Error('API Key no proporcionada');

      // 1. Hasheamos la llave que nos enviaron para compararla con la BD
      const hashRecibido = crypto.createHash('sha256').update(apiKeyRecibida).digest('hex');

      // 2. Buscamos en Firestore
      const snapshot = await db.collection('api_keys').where('hash', '==', hashRecibido).limit(1).get();
      if (snapshot.empty) throw new Error('API Key inválida o revocada');

      const datosKey = snapshot.docs[0]!.data();

      // 3. Validamos si tiene el permiso específico (El Scope)
      if (!datosKey.scopes.includes(permisoRequerido)) {
        throw new Error(`Acceso denegado: Se requiere el permiso [${permisoRequerido}]`);
      }

      // 4. Todo está en orden. Dejamos pasar la petición y anotamos qué sistema está consultando.
      (req as any).sistemaExterno = datosKey.nombreDepartamento;
      next();
    } catch (error: any) {
      res.status(401).json({ status: 'error', message: error.message });
    }
  };
};