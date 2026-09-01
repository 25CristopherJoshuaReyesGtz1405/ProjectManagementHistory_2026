import app from './app.js'; 
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { iniciarMotorFinOps } from './UtilidadesActivas/FinOps.js';

// 1. La API de Express para todas las rutas del colegio
export const api = onRequest({ cors: true }, app);

// --- Arranca Con Los Trabajos Cron de Estadísticas Nocturnas ---
// 2. El Cron Job nativo de Firebase (Por Ejemplo: se ejecuta cada noche a las 12:00 AM)
export const estadisticasNocturnas = onSchedule("0 0 * * *", async (event) => {
  console.log("Iniciando procesamiento nocturno de estadísticas...");
  await iniciarMotorFinOps();
  console.log("Procesamiento nocturno completado con éxito.");
});

/*import app from './app.js'; // Importa la aplicación configurada

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});*/