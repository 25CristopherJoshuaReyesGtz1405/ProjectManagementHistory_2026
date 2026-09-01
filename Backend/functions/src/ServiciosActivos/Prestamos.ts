/**
 * ============================================================================
 * MÓDULO: SERVICIO DE CONTROL DE PRÉSTAMOS FÍSICOS (SIGAH v3.0)
 * ============================================================================
 * @description Orquesta la logística y tránsito del acervo histórico.
 * Integra Pick-Path Optimization para almacenes físicos, protocolo Zero-Trust 
 * efímero (OTP), motor de colas reactivo y Trust Score algorítmico.
 * 
 * @author Cristopher Joshua Reyes Gutiérrez
 * @version 3.0.0
 * ============================================================================
 */

import { db } from "../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js";
import { registrarLogAvanzado } from "./Auditoria.js";
import { consultarExpedientePorNumControl } from "./Expediente.js";
import * as ServicioUsuarios from "./Usuarios.js";
import { AppError } from "../UtilidadesActivas/AppError.js";
import crypto from 'crypto';
import type { EstadoConservacion, Expediente } from "../ModelosAplicacion/ModelosAplicacion.model.js";

import { FieldValue } from 'firebase-admin/firestore';

const prestamosRef = db.collection("control_prestamos");
const expedientesRef = db.collection("expedientes");
const usuariosRef = db.collection("usuarios");

// Mapa de pesos para el cálculo de degradación forense (Delta Físico)
const PesoConservacion: Record<EstadoConservacion, number> = {
  'BUENO': 5,
  'REGULAR': 4,
  'MALO': 3,
  'DETERIORADO': 2,
  'INCOMPLETO': 1
};

/**
 * ============================================================================
 * UTILIDADES LOGÍSTICAS Y DE SEGURIDAD
 * ============================================================================
 */

/**
 * @description Calcula la fecha de vencimiento ignorando fines de semana.
 */
const calcularVencimientoHabiles = (fechaInicio: Date, dias: number): Date => {
  let fecha = new Date(fechaInicio);
  let contador = 0;
  while (contador < dias) {
    fecha.setDate(fecha.getDate() + 1);
    if (fecha.getDay() !== 0 && fecha.getDay() !== 6) contador++;
  }
  return fecha;
};

/**
 * @description Sello criptográfico de un solo sentido para el protocolo Zero-Trust.
 */
const generarHashOTP = (otpPlano: string): string => {
  const secretSalt = process.env.SIGAH_OTP_SALT || "ITD_TEMPORAL_SALT";
  return crypto.createHash("sha256").update(`${otpPlano}|${secretSalt}`).digest("hex");
};

/**
 * @description Emulador de Bus de Eventos (Pub/Sub) para notificaciones asíncronas.
 */
const publicarEventoBus = async (topico: string, payload: any): Promise<void> => {
  console.log(`[EVENT_BUS] Transmitiendo evento logístico: ${topico}`, payload);
};

/**
 * @description Penalización transaccional del historial crediticio institucional.
 */
const actualizarTrustScore = async (uid: string, penalizacion: number, t: FirebaseFirestore.Transaction) => {
  const userRef = usuariosRef.doc(uid);
  const userDoc = await t.get(userRef);
  if (userDoc.exists) {
    const scoreActual = userDoc.data()?.trustScore ?? 100;
    const nuevoScore = Math.max(0, scoreActual - penalizacion);
    t.update(userRef, { trustScore: nuevoScore });
  }
};

/**
 * @description KILLER FEATURE: Pick-Path Optimization (Algoritmo Logístico).
 * Ordena un lote masivo de expedientes trazando la ruta física más corta para 
 * el archivista (Agrupación topográfica ascendente).
 */
const optimizarRutaRecoleccion = (expedientes: Expediente[]) => {
  return expedientes.sort((a, b) => {
    const locA = a.ubicacion;
    const locB = b.ubicacion;
    if (locA.edificio !== locB.edificio) return (locA.edificio || '').localeCompare(locB.edificio || '');
    if (locA.estante !== locB.estante) return (locA.estante || '').localeCompare(locB.estante || '');
    if (locA.caja !== locB.caja) return locA.caja.localeCompare(locB.caja);
    return locA.carpeta.localeCompare(locB.carpeta);
  });
};

/**
 * ============================================================================
 * ORQUESTACIÓN DE PRÉSTAMOS INDIVIDUALES Y COLAS DE ESPERA
 * ============================================================================
 */

export const registrarSalidaIndividual = async (
  numControl: string,
  solicitanteUid: string,
  observaciones: string,
  adminUid: string,
  ipAddress: string
) => {
  const solicitante = await ServicioUsuarios.consultarPerfilUsuario(solicitanteUid);
  
  if (!['ADMIN', 'JEFATURA', 'CAPTURISTA', 'TITULACION'].includes(solicitante.rol)) {
    throw new AppError("Denegado. Su rol institucional no autoriza la extracción de acervo físico.", 403);
  }

  // Prevención de Riesgos: Bloqueo automático por mala reputación (Morosidad)
  if ((solicitante as any).trustScore !== undefined && (solicitante as any).trustScore < 50) {
    throw new AppError("Préstamo denegado. Trust Score crítico por infracciones previas.", 403);
  }

  // Invocación al servicio base con rol administrativo para saltar el Data Masking temporalmente
  const expediente = await consultarExpedientePorNumControl(numControl, 'ADMIN');
  if (!expediente) throw new AppError("Documento no localizado en la topografía.", 404);
  
  if (['TRANSITO', 'RESERVADO_AUDITORIA'].includes(expediente.estatus)) {
    throw new AppError("Conflicto Logístico: El documento físico no se encuentra en su anaquel.", 409);
  }

  const fechaSalida = new Date();
  const fechaVencimiento = calcularVencimientoHabiles(fechaSalida, 5);
  const folioVale = `PRESTAMO_${solicitanteUid}_${fechaSalida.getTime()}`;

  const nuevoPrestamoRef = prestamosRef.doc();
  const prestamoData = {
    folio: folioVale,
    numControl,
    solicitanteUid,
    autorizaUid: adminUid,
    fechaSalida,
    fechaVencimiento,
    estatus: 'ACTIVO',
    observaciones,
    metadata: { fechaCreacion: new Date(), version: 1 }
  };

  await db.runTransaction(async (t) => {
    const docRef = expedientesRef.doc(numControl);
    t.set(nuevoPrestamoRef, prestamoData);
    t.update(docRef, { 
      estatus: 'TRANSITO',
      'metadata.fechaUltimaModificacion': new Date(),
      'metadata.modificadoPor': adminUid
    });
  });

  await registrarLogAvanzado(adminUid, "REGISTRO_PRESTAMO_FISICO", "control_prestamos", nuevoPrestamoRef.id, ipAddress, null, prestamoData);
  return { id: nuevoPrestamoRef.id, folio: folioVale, vence: fechaVencimiento };
};

export const encolarPeticionExpediente = async (numControl: string, solicitanteUid: string, ipAddress: string): Promise<void> => {
  await db.runTransaction(async (t) => {
    const docRef = expedientesRef.doc(numControl);
    const doc = await t.get(docRef);
    if (!doc.exists) throw new AppError("Expediente no encontrado.", 404);
    
    if (doc.data()?.estatus !== 'TRANSITO') {
      throw new AppError("Heurística inválida: El expediente está disponible en su anaquel.", 400);
    }

    const colaActual = doc.data()?.colaEspera || [];
    if (colaActual.includes(solicitanteUid)) {
      throw new AppError("Usted ya posee un ticket en la lista de espera de este documento.", 409);
    }

    t.update(docRef, { colaEspera: [...colaActual, solicitanteUid] });
  });

  await registrarLogAvanzado(solicitanteUid, "ENCOLAMIENTO_PETICION", "expedientes", numControl, ipAddress);
};

/**
 * ============================================================================
 * KILLER FEATURES: RETORNOS, SENSÓRICA DE DESGASTE Y ZERO-TRUST
 * ============================================================================
 */

export const registrarRetornoConDelta = async (
  prestamoId: string,
  estadoRetorno: EstadoConservacion,
  observacionesRetorno: string,
  adminUid: string,
  ipAddress: string
) => {
  const prestamoRef = prestamosRef.doc(prestamoId);
  let alertaSiniestro = false;
  let siguienteEnFila: string | null = null;
  let numControlContext = '';

  await db.runTransaction(async (t) => {
    const prestamoDoc = await t.get(prestamoRef);
    if (!prestamoDoc.exists) throw new AppError("Registro logístico no encontrado.", 404);
    
    const datosPrestamo = prestamoDoc.data();
    if (datosPrestamo?.estatus === 'DEVUELTO') throw new AppError("Inconsistencia: Préstamo cerrado previamente.", 400);

    numControlContext = datosPrestamo?.numControl;
    const expedienteRef = expedientesRef.doc(numControlContext);
    const expedienteDoc = await t.get(expedienteRef);
    const datosExpediente = expedienteDoc.data();
    
    const estadoOriginal = datosExpediente?.ubicacion.estadoConservacion as EstadoConservacion;

    // Delta Físico: Sensor de desgaste institucional
    if (PesoConservacion[estadoRetorno] < PesoConservacion[estadoOriginal]) {
      alertaSiniestro = true;
      if (!observacionesRetorno || observacionesRetorno.length < 15) {
        throw new AppError("Auditoría obligatoria: Describa el daño o extravío sufrido (mínimo 15 chars).", 400);
      }
      
      const siniestroRef = db.collection('control_siniestros').doc();
      t.set(siniestroRef, {
        numControl: numControlContext,
        prestamoId: prestamoId,
        estadoAnterior: estadoOriginal,
        estadoNuevo: estadoRetorno,
        observaciones: observacionesRetorno,
        reportadoPor: adminUid,
        fechaReporte: new Date()
      });

      await actualizarTrustScore(datosPrestamo?.solicitanteUid, 20, t); // Castigo severo por daño
    }

    if (new Date() > datosPrestamo?.fechaVencimiento.toDate()) {
      await actualizarTrustScore(datosPrestamo?.solicitanteUid, 10, t); // Castigo por morosidad
    }

    t.update(prestamoRef, {
      estatus: 'DEVUELTO',
      fechaRetorno: new Date(),
      estadoFisicoRetorno: estadoRetorno,
      observacionesRetorno,
      alertaSiniestroFisico: alertaSiniestro,
      'metadata.version': (datosPrestamo?.metadata?.version || 1) + 1
    });

    const colaEspera = datosExpediente?.colaEspera || [];
    let nuevoEstatus = 'HISTORICO';

    // Orquestación Reactiva de Colas
    if (colaEspera.length > 0) {
      siguienteEnFila = colaEspera.shift(); 
      nuevoEstatus = 'RESERVADO_ESPERA'; 
    }

    t.update(expedienteRef, {
      estatus: nuevoEstatus,
      colaEspera: colaEspera, 
      'ubicacion.estadoConservacion': estadoRetorno,
      'metadata.fechaUltimaModificacion': new Date()
    });
  });

  if (siguienteEnFila) {
    // Transmite el evento al ecosistema para disparar el SMS/Email
    await publicarEventoBus('EXPEDIENTE_LIBERADO_COLA', { numControl: numControlContext, uidTurno: siguienteEnFila });
  }

  await registrarLogAvanzado(adminUid, alertaSiniestro ? "RETORNO_CON_SINIESTRO" : "RETORNO_EXPEDIENTE", "control_prestamos", prestamoId, ipAddress);

  return { exito: true, siniestroReportado: alertaSiniestro, reAsignadoA: siguienteEnFila };
};

export const generarReservaConOtp = async (numControles: string[], solicitanteUid: string, observaciones: string, adminUid: string, ipAddress: string) => {
  if (numControles.length > 200) throw new AppError("Límite logístico superado (Max. 200/Lote).", 400);

  // 1. Extraemos y ordenamos físicamente (Pick-Path Optimization)
  const expedientesDocumentos = await Promise.all(
    numControles.map(nc => consultarExpedientePorNumControl(nc, 'ADMIN'))
  );
  
  const expedientesValidos = expedientesDocumentos.filter(e => e !== null) as Expediente[];
  
  for (const exp of expedientesValidos) {
    if (exp.estatus !== "HISTORICO") {
      throw new AppError(`El expediente ${exp.numControl} no está en anaquel (Estatus: ${exp.estatus}).`, 409);
    }
  }

  const loteRuteado = optimizarRutaRecoleccion(expedientesValidos);

  // 2. Generación Transaccional Zero-Trust
  const batch = db.batch();
  const fechaSalida = new Date();
  const fechaVencimiento = calcularVencimientoHabiles(fechaSalida, 5);
  const folioMaestro = `AUDITORIA_${solicitanteUid}_${fechaSalida.getTime()}`;
  
  const prestamosGenerados: { numControl: string; ubicacion: any; otpPlano: string; }[] = [];

  for (const exp of loteRuteado) {
    const nuevoPrestamoRef = prestamosRef.doc();
    const otpPlano = crypto.randomInt(100000, 999999).toString(); // PIN de 6 dígitos
    const otpHashed = generarHashOTP(otpPlano);
    
    const expiracionOTP = new Date();
    expiracionOTP.setMinutes(expiracionOTP.getMinutes() + 15); // Efímero: 15 min TTL

    batch.set(nuevoPrestamoRef, {
      folio: folioMaestro,
      numControl: exp.numControl,
      solicitanteUid,
      autorizaUid: adminUid,
      fechaSalida,
      fechaVencimiento,
      estatus: 'PENDIENTE_ENTREGA',
      otpHashed: otpHashed,
      expiracionOTP: expiracionOTP,
      observaciones,
      metadata: { fechaCreacion: new Date(), version: 1 }
    });

    batch.update(expedientesRef.doc(exp.numControl), { estatus: 'RESERVADO_AUDITORIA' });
    
    prestamosGenerados.push({ 
      numControl: exp.numControl, 
      ubicacion: exp.ubicacion, // Entregamos la ubicación para imprimir la hoja de ruta
      otpPlano 
    });
  }

  await batch.commit();
  await registrarLogAvanzado(adminUid, "GENERACION_LOTE_ZERO_TRUST", "control_prestamos", folioMaestro, ipAddress);
  
  // Retornamos la ruta ordenada y los OTPs planos por única vez
  return { folioMaestro, vence: fechaVencimiento, rutaLogistica: prestamosGenerados };
};

export const confirmarEntregaFisica = async (prestamoId: string, otpProporcionado: string, adminUid: string, ipAddress: string) => {
  const prestamoRef = prestamosRef.doc(prestamoId);

  await db.runTransaction(async (t) => {
    const doc = await t.get(prestamoRef);
    if (!doc.exists) throw new AppError("Registro logístico no encontrado.", 404);
    
    const datos = doc.data();
    if (datos?.estatus !== 'PENDIENTE_ENTREGA') throw new AppError("El documento no requiere validación biométrica/OTP.", 400);

    if (new Date() > datos?.expiracionOTP.toDate()) {
      throw new AppError("Fallo Zero-Trust: El token criptográfico expiró (15 min). Solicite la regeneración.", 401);
    }

    const hashProporcionado = generarHashOTP(otpProporcionado);
    if (datos?.otpHashed !== hashProporcionado) {
      throw new AppError("Inconsistencia Criptográfica: Token inválido.", 401);
    }

    t.update(prestamoRef, {
      estatus: 'ACTIVO',
      otpHashed: null, 
      expiracionOTP: null,
      fechaSalidaReal: new Date(),
      'metadata.version': (datos?.metadata?.version || 1) + 1,
      'metadata.entregadoPor': adminUid
    });

    t.update(expedientesRef.doc(datos.numControl), { estatus: 'TRANSITO' });
  });

  await registrarLogAvanzado(adminUid, "VALIDACION_FIRMADA_OTP", "control_prestamos", prestamoId, ipAddress);
};

/**
 * @description CRON WORKER: Barrido Logístico Nocturno. 
 * Detecta préstamos vencidos, cambia estatus a MOROSO e impacta los Trust Scores.
 */
export const ejecutarBarridoMorosidad = async (): Promise<number> => {
  const snapshot = await prestamosRef
    .where('estatus', '==', 'ACTIVO')
    .where('fechaVencimiento', '<', new Date())
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  let procesados = 0;

  for (const doc of snapshot.docs) {
    const prestamo = doc.data();
    batch.update(doc.ref, { estatus: 'VENCIDO' });
    
    // Penalización automática
    const userRef = usuariosRef.doc(prestamo.solicitanteUid);
    batch.update(userRef, { trustScore: FieldValue.increment(-5) });
    
    procesados++;
    if (procesados % 400 === 0) { // Respetar límites de lote de Firestore
      await batch.commit();
    }
  }
  
  if (procesados % 400 !== 0) await batch.commit();
  await publicarEventoBus('BARRIDO_MOROSIDAD_COMPLETADO', { expedientesAfectados: procesados });
  return procesados;
};

/**
 * @description TOPOGRAFÍA PREDICTIVA (Machine Learning / Clustering Analítico).
 * Evalúa los logs de préstamos de los últimos 6 meses para detectar generaciones 
 * o carreras con alta demanda recurrente y sugiere su reubicación física a "Hot Storage".
 */
export const generarInsightsTopograficos = async (): Promise<any[]> => {
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

  // Extracción de datos de entrenamiento (Historial de Préstamos)
  const snapshot = await prestamosRef
    .where('fechaSalida', '>=', seisMesesAtras)
    .get();

  const frecuenciaPorCaja: Record<string, number> = {};
  
  // En un entorno productivo avanzado, este dataset alimentaría un modelo 
  // de clasificación en TensorFlow o Scikit-learn. Aquí aplicamos la heurística base:
  for (const doc of snapshot.docs) {
    const prestamo = doc.data();
    const expDoc = await expedientesRef.doc(prestamo.numControl).get();
    if (expDoc.exists) {
      const ubi = expDoc.data()?.ubicacion;
      const keyCaja = `${ubi.edificio}-${ubi.estante}-${ubi.caja}`;
      frecuenciaPorCaja[keyCaja] = (frecuenciaPorCaja[keyCaja] || 0) + 1;
    }
  }

  // Filtrar las cajas con anomalía de alta demanda (>50 extracciones)
  const cajasCalientes = Object.entries(frecuenciaPorCaja)
    .filter(([_, count]) => count > 50)
    .map(([caja, count]) => ({
      coordenada: caja,
      extraccionesRecientes: count,
      sugerenciaLogistica: 'REUBICAR_A_ESTANTE_DE_ACCESO_RAPIDO (ZONA A)'
    }));

  return cajasCalientes;
};

/**
 * @description INTEGRACIÓN IoT (Hardware Webhooks).
 * Endpoint diseñado para ser consumido por escáneres RFID/Barcode (Ej. ESP32-S3 o Raspberry Pi).
 * Procesa devoluciones masivas en ráfaga con un solo escaneo de hardware.
 */
export const procesarRetornoMasivoIoT = async (
  payloadHardware: { scannerId: string, lecturas: string[], timestamp: number },
  ipAddress: string
): Promise<{ exitosos: number, fallidos: string[] }> => {
  
  const { lecturas, scannerId } = payloadHardware;
  const fallidos: string[] = [];
  let exitosos = 0;

  const batch = db.batch();

  for (const matriculaEscaneada of lecturas) {
    // Buscar si la matrícula tiene un préstamo activo
    const query = await prestamosRef
      .where('numControl', '==', matriculaEscaneada)
      .where('estatus', '==', 'ACTIVO')
      .limit(1)
      .get();

    if (query.empty) {
      fallidos.push(matriculaEscaneada);
      continue;
    }

    const prestamo = query.docs[0];
    batch.update(prestamo!.ref, {
      estatus: 'DEVUELTO',
      fechaRetorno: new Date(),
      estadoFisicoRetorno: 'BUENO', // Default optimista para retornos IoT rápidos
      observacionesRetorno: `Retorno automatizado vía escáner de hardware IoT (${scannerId}).`,
      'metadata.version': (prestamo?.data().metadata?.version || 1) + 1
    });

    batch.update(expedientesRef.doc(matriculaEscaneada), {
      estatus: 'HISTORICO',
      'ubicacion.estadoConservacion': 'BUENO',
      'metadata.fechaUltimaModificacion': new Date()
    });

    exitosos++;
  }

  if (exitosos > 0) {
    await batch.commit();
    await registrarLogAvanzado('SISTEMA_IOT', 'RETORNO_MASIVO_HARDWARE', 'control_prestamos', scannerId, ipAddress, null, { extracciones: exitosos });
  }

  return { exitosos, fallidos };
};

/**
 * @description CADENA DE CUSTODIA (Puntos de Control).
 * Registra un micro-salto logístico en el ciclo de vida de un préstamo activo.
 */
export const registrarPuntoDeControl = async (prestamoId: string, ubicacionActual: string, responsableUid: string) => {
  const prestamoRef = prestamosRef.doc(prestamoId);
  
  await db.runTransaction(async (t) => {
    const doc = await t.get(prestamoRef);
    if (!doc.exists) throw new AppError("Préstamo no localizado.", 404);
    
    const custodiaActual = doc.data()?.cadenaDeCustodia || [];
    
    const nuevoSalto = {
      timestamp: new Date(),
      ubicacion: ubicacionActual,
      responsable: responsableUid,
      firmaHash: generarHashOTP(`${prestamoId}|${ubicacionActual}|${Date.now()}`)
    };

    t.update(prestamoRef, {
      cadenaDeCustodia: [...custodiaActual, nuevoSalto],
      'metadata.version': (doc.data()?.metadata?.version || 1) + 1
    });
  });

  // Notificación reactiva (SSE/WebSockets) para actualizar interfaces sin recargar
  await publicarEventoBus('NUEVO_SALTO_LOGISTICO', { prestamoId, ubicacionActual });
};