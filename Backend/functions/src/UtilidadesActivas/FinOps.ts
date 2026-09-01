import { db } from '../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js';
import { getStorage } from 'firebase-admin/storage';
import cron from 'node-cron';

const bucket = getStorage().bucket('sigah-boveda-fria');

/**
 * ============================================================================
 * KILLER FEATURE 5: MOTOR FINOPS Y COLD STORAGE
 * ============================================================================
 * Tarea programada que mueve expedientes inactivos al almacenamiento de bajo costo.
 */
export const iniciarMotorFinOps = () => {
  // Se ejecuta a las 03:00 AM el primer día de cada mes
  cron.schedule('0 3 1 * *', async () => {
    console.log('Iniciando ciclo FinOps: Migración a Bóveda Fría...');
    
    // Calculamos la fecha límite (ej. 5 años atrás desde hoy)
    const fechaLimite = new Date();
    fechaLimite.setFullYear(fechaLimite.getFullYear() - 5);

    try {
      // 1. Buscamos expedientes que no han sido consultados en 5 años
      const snapshot = await db.collection('expedientes')
        .where('estatus', '==', 'HISTORICO')
        .where('metadata.ultimoAcceso', '<', fechaLimite)
        .where('metadata.enBovedaFria', '==', false)
        .limit(500) // Procesamos en lotes para no saturar la memoria
        .get();

      if (snapshot.empty) {
        console.log('Ciclo FinOps completado: No hay expedientes para archivar.');
        return;
      }

      const batch = db.batch();

      for (const doc of snapshot.docs) {
        const expediente = doc.data();
        
        // 2. Empaquetamos el objeto pesado (todo el historial, documentos, etc.)
        const payloadBuffer = Buffer.from(JSON.stringify(expediente));
        const archivoColdStorage = bucket.file(`cold_storage/${doc.id}.json`);
        
        // 3. Guardamos en el Storage de ultra-bajo costo (Fracciones de centavo)
        await archivoColdStorage.save(payloadBuffer, { resumable: false });

        // 4. "Adelgazamos" el documento en Firestore (Dejamos solo el cascarón)
        const docRef = db.collection('expedientes').doc(doc.id);
        batch.update(docRef, {
          'archivos': [], // Vaciamos los arrays pesados
          'metadata.enBovedaFria': true,
          'metadata.fechaMigracionFria': new Date()
        });
      }

      await batch.commit();
      console.log(`Ciclo FinOps completado: ${snapshot.size} expedientes movidos a Cold Storage.`);
      
    } catch (error) {
      console.error('Error crítico en el motor FinOps:', error);
    }
  });
};