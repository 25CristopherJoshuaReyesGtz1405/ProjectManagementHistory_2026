/**
 * ============================================================================
 * MÓDULO: MOTOR ANALÍTICO Y SHARDING ESTADÍSTICO (SIGAH v3.0)
 * ============================================================================
 * @description Orquesta el procesamiento de métricas en tiempo real.
 * Implementa Distributed Counters (Sharding) mitigando Hot-spots,
 * analítica predictiva de Burn-down, gamificación de calidad y protección
 * Anti-Spam biométrica.
 * 
 * @author Cristopher Joshua Reyes Gutiérrez
 * @version 3.0.0
 * ============================================================================
 */

import { db } from "../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js";
import { FieldValue } from "firebase-admin/firestore";
import { AppError } from "../UtilidadesActivas/AppError.js";
import { enviarACuarentena } from "./Auditoria.js";
import NodeCache from "node-cache";

const statsRef = db.collection("estadisticas_globales").doc("dashboard_principal");
const productividadRef = db.collection("estadisticas_productividad");

const NUM_SHARDS = 10;
// Caché FinOps: Mantiene el dashboard en memoria RAM por 5 minutos
const analiticaCache = new NodeCache({ stdTTL: 300 }); 

/**
 * ============================================================================
 * 1. DISTRIBUTED COUNTERS (Compatibilidad Estricta)
 * ============================================================================
 */

/**
 * @description Incrementa KPIs distribuyendo la carga atómicamente. 
 * Mantiene la firma original para compatibilidad con Expediente.ts.
 */
export const incrementarEstadisticasIncrementales = async (
  nivelAcademico: string, 
  batchTransaccion: FirebaseFirestore.WriteBatch
): Promise<void> => {
  // Fragmentación de escritura: Selecciona un nodo al azar para evitar Hot-spots
  const shardId = Math.floor(Math.random() * NUM_SHARDS).toString();
  const shardRef = statsRef.collection("shards").doc(shardId);
  
  const increment = FieldValue.increment(1);
  batchTransaccion.set(shardRef, {
    totalExpedientesDigitalizados: increment,
    [`conteoPorNivel.${nivelAcademico.toUpperCase()}`]: increment,
    ultimaActualizacion: new Date()
  }, { merge: true });
};

/**
 * ============================================================================
 * 2. PRODUCTIVIDAD Y DETECCIÓN DE ANOMALÍAS (Anti-Spam)
 * ============================================================================
 */

export const registrarProductividadAvanzada = async (
  usuarioUid: string, 
  ipAddress: string,
  tipoAccion: 'DIGITALIZACION' | 'TRIAGE_OCR' | 'PRESTAMO_FISICO',
  esCapturaLimpia: boolean = true
): Promise<void> => {
  
  const mesActual = new Date().toISOString().slice(0, 7);
  const docRef = productividadRef.doc(`${usuarioUid}_${mesActual}`);

  await db.runTransaction(async (t) => {
    const doc = await t.get(docRef);
    let velocidadSospechosa = false;

    if (doc.exists) {
      const data = doc.data() as any;
      const ultimaActividad = data.ultimaActividad?.toDate();
      const ahora = new Date();
      
      // ANTI-SPAM: Velocidad sobrehumana (< 5 segundos entre capturas)
      if (ultimaActividad && (ahora.getTime() - ultimaActividad.getTime()) < 5000) {
        velocidadSospechosa = true;
      }
    }

    if (velocidadSospechosa) {
      t.update(db.collection('usuarios').doc(usuarioUid), { activo: false, motivoBloqueo: 'ANOMALIA_VELOCIDAD_CAPTURA' });
      await enviarACuarentena('estadisticas_productividad', doc.id, 'SISTEMA_IA', ipAddress, 'Alerta de bot o captura masiva fraudulenta.');
      throw new AppError('ALERTA DE SEGURIDAD: Velocidad de captura inusual detectada. Cuenta suspendida preventivamente.', 403);
    }

    const puntosCalidad = esCapturaLimpia ? 10 : -5;
    t.set(docRef, {
      usuarioUid,
      mesOperativo: mesActual,
      [`metricas.${tipoAccion}`]: FieldValue.increment(1),
      qualityScore: FieldValue.increment(puntosCalidad),
      ultimaActividad: new Date()
    }, { merge: true });
  });
};

/**
 * ============================================================================
 * 3. CONSOLIDACIÓN Y RECUPERACIÓN (FinOps)
 * ============================================================================
 */

/**
 * @description CONSOLIDACIÓN ASÍNCRONA. A ejecutar mediante Cron-Job.
 */
export const consolidarShardsEnCache = async (): Promise<void> => {
  const shardsSnapshot = await statsRef.collection("shards").get();
  
  let totalDigitalizados = 0;
  const conteoNiveles: Record<string, number> = { BACHILLERATO: 0, LICENCIATURA: 0, MAESTRIA: 0, DOCTORADO: 0 };
  let fechaMasReciente = new Date(0);

  shardsSnapshot.forEach((doc) => {
    const data = doc.data();
    totalDigitalizados += (data.totalExpedientesDigitalizados || 0);
    
    for (const nivel in data.conteoPorNivel || {}) {
      conteoNiveles[nivel] = (conteoNiveles[nivel] || 0) + data.conteoPorNivel[nivel];
    }
    if (data.ultimaActualizacion && data.ultimaActualizacion.toDate() > fechaMasReciente) {
      fechaMasReciente = data.ultimaActualizacion.toDate();
    }
  });

  const consolidado = {
    totalExpedientesDigitalizados: totalDigitalizados,
    conteoPorNivel: conteoNiveles,
    ultimaActualizacion: fechaMasReciente
  };

  await statsRef.set(consolidado);
  analiticaCache.set("dashboard_data", consolidado);
};

/**
 * @description LECTURA O(1). Consulta ultrarrápida desde memoria RAM.
 */
export const consultarDashboardGerencial = async (): Promise<any> => {
  const dataEnRam = analiticaCache.get("dashboard_data");
  if (dataEnRam) return dataEnRam;

  const statsDoc = await statsRef.get();
  if (statsDoc.exists) {
    analiticaCache.set("dashboard_data", statsDoc.data());
    return statsDoc.data();
  }

  return { 
    totalExpedientesDigitalizados: 0, 
    conteoPorNivel: {}, 
    mensaje: "Consolidando métricas del acervo..." 
  };
};

export const generarLeaderboardProductividad = async (): Promise<any[]> => {
  const mesActual = new Date().toISOString().slice(0, 7);
  
  const snapshot = await productividadRef
    .where('mesOperativo', '==', mesActual)
    .orderBy('qualityScore', 'desc')
    .limit(10)
    .get();

  return snapshot.docs.map(doc => ({
    usuarioUid: doc.data().usuarioUid,
    puntosCalidad: doc.data().qualityScore || 0,
    volumenDigitalizado: doc.data().metricas?.DIGITALIZACION || 0
  }));
};