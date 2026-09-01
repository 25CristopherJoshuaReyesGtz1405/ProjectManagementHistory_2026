import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Importación de rutas
import PersonaRoutes from './RoutesActivas/Persona.routes.js';
import ExpedienteRoutes from './RoutesActivas/Expediente.routes.js';
import AuditoriaRoutes from './RoutesActivas/Auditoria.routes.js';
import UsuariosRoutes from './RoutesActivas/Usuarios.routes.js';
import EstadisticasRoutes from './RoutesActivas/Estadisticas.routes.js';
import PrestamosRoutes from './RoutesActivas/Prestamos.routes.js';
import titulacionRoutes from './RoutesActivas/Titulacion.routes.js'; // <- Nuevo Router

import { globalErrorHandler } from './APIs/error.middleware.js';
import { AppError } from './UtilidadesActivas/AppError.js';
import { swaggerSpec } from './ConfiguracionesActivas/SwaggerConfig.js';

const app: Application = express();

// Blindaje de red y parseo
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' })); // Restringir en producción
app.use(express.json({ limit: '10mb' })); // Límite para payloads de OCR

// 1. RUTA DE SALUD
app.get('/api/health', (req, res) => {
  res.json({ status: 'success', message: 'SIGAH API Online' });
});

// 2. MONTAJE DE RUTAS
app.use('/api/personas', PersonaRoutes);
app.use('/api/expedientes', ExpedienteRoutes);
app.use('/api/auditoria', AuditoriaRoutes);
app.use('/api/usuarios', UsuariosRoutes);
app.use('/api/estadisticas', EstadisticasRoutes);
app.use('/api/prestamos', PrestamosRoutes);
app.use('/api/titulacion', titulacionRoutes);

// 3. MANEJO DE 404 
app.use((req, res, next) => {
  next(new AppError(`La ruta ${req.originalUrl} no existe.`, 404));
});

//  5. MANEJADOR GLOBAL 
app.use(globalErrorHandler);

export default app;

