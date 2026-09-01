import { type Request, type Response, type NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validate = (schema: z.ZodObject<any,any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Datos de entrada no válidos',
        errors: error.issues.map(issue => ({
          campo: issue.path.join('.'),
          mensaje: issue.message
        }))
      });
    }
    next(error);
  }
};