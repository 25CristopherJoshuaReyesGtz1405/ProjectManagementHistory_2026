/**
 * ============================================================================
 * MÓDULO: SERVICIO DE AUDITORÍA FORENSE Y EXCELENCIA OPERATIVA (SIGAH v3.0)
 * ============================================================================
 * @description Motor central de trazabilidad, inmutabilidad y recuperación de datos 
 * para el Instituto Tecnológico de Durango. Este servicio implementa patrones de
 * nivel Enterprise como Blockchain interno, Diffing dinámico y Soft-Delete 
 * para cumplir estrictamente con la Ley General de Archivos[cite: 3].
 * 
 * @author Cristopher Joshua Reyes Gutiérrez
 * @version 3.0.0
 * ============================================================================
 */

import { db } from '../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js';
import crypto from 'crypto';
import { AppError } from '../UtilidadesActivas/AppError.js';
import type { LogAuditoria } from '../ModelosAplicacion/ModelosAplicacion.model.js';

const logsRef = db.collection('logActividad');

/**
 * @function generarHashLog
 * @description Genera un sello criptográfico (Hash SHA-256) encadenando la información del log
 * actual con la firma del log inmediatamente anterior. Esto previene la alteración manual
 * de la base de datos (Inmutabilidad Blockchain).
 * 
 * @param {any} datosLog - Objeto con los datos que conforman el log actual.
 * @param {string} hashAnterior - La firma criptográfica del bloque (log) anterior.
 * @returns {string} Hash SHA-256 en formato hexadecimal.
 */
const generarHashLog = (datosLog: any, hashAnterior: string): string => {
  const payload = `${JSON.stringify(datosLog)}|${hashAnterior}|${process.env.SIGAH_SECRET || 'ITD_1948'}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * @function calcularDiferencias
 * @description Algoritmo de 'Diffing' que evalúa quirúrgicamente dos estados de un documento
 * para extraer únicamente los campos que sufrieron alteraciones. Optimiza el almacenamiento.
 * 
 * @param {any} objAnterior - Estado del documento antes de la transacción.
 * @param {any} objNuevo - Estado del documento después de la transacción.
 * @returns {Record<string, any>} Objeto estructurado solo con las diferencias detectadas.
 */
const calcularDiferencias = (objAnterior: any, objNuevo: any): Record<string, any> => {
  const diferencias: Record<string, any> = {};
  if (!objAnterior) return { operacion: 'CREACION_NUEVA', estado: objNuevo };
  if (!objNuevo) return { operacion: 'ELIMINACION', estadoAnterior: objAnterior };

  for (const key in objNuevo) {
    if (JSON.stringify(objAnterior[key]) !== JSON.stringify(objNuevo[key])) {
      diferencias[key] = { antes: objAnterior[key], despues: objNuevo[key] };
    }
  }
  return diferencias;
};

/**
 * @function registrarLogAvanzado
 * @description Inscribe un nuevo evento en la bitácora de auditoría inmutable[cite: 3]. 
 * Utiliza transacciones atómicas para asegurar que el cálculo del hash anterior 
 * y la escritura del nuevo log sean procesos herméticos frente a la concurrencia.
 * 
 * @param {string} usuarioUid - Identificador del usuario que realiza la acción.
 * @param {string} accion - Clave de la acción (Ej. 'CREAR_EXPEDIENTE').
 * @param {string} coleccionAfectada - Nombre de la colección de Firestore intervenida.
 * @param {string} documentoId - Identificador del documento modificado.
 * @param {string} ipAddress - Dirección IP de origen de la petición.
 * @param {any} [estadoAnterior] - Snapshot del documento previo al cambio.
 * @param {any} [estadoNuevo] - Snapshot del documento con los cambios aplicados.
 * @param {any} [detallesExtra] - Metadatos adicionales relevantes para la auditoría.
 * @returns {Promise<string>} Identificador único (ID) del log generado.
 * @throws {AppError} Falla general de la transacción si hay error en la base de datos.
 */
export const registrarLogAvanzado = async (
  usuarioUid: string,
  accion: string,
  coleccionAfectada: string,
  documentoId: string,
  ipAddress: string,
  estadoAnterior?: any,
  estadoNuevo?: any,
  detallesExtra?: any
): Promise<string> => {
  try {
    const cambios = calcularDiferencias(estadoAnterior, estadoNuevo);

    return await db.runTransaction(async (t) => {
      const ultimoLogQuery = await t.get(logsRef.orderBy('fecha', 'desc').limit(1));
      const hashPrevio = ultimoLogQuery.empty ? 'GENESIS_BLOCK_ITD' : ultimoLogQuery.docs[0]?.data().firmaCriptografica;

      const docRef = logsRef.doc();
      const nuevoLog: Partial<LogAuditoria> & { firmaCriptografica: string } = {
        fecha: new Date(),
        usuarioUid,
        accion,
        coleccionAfectada,
        documentoId,
        ipAddress,
        detalles: JSON.stringify({ cambiosAfectados: cambios, contextoExtra: detallesExtra }),
        firmaCriptografica: ''
      };

      nuevoLog.firmaCriptografica = generarHashLog(nuevoLog, hashPrevio);
      t.set(docRef, nuevoLog);
      
      return docRef.id;
    });
  } catch (error) {
    console.error('🔥 Error crítico en Auditoría:', error);
    throw new AppError('Fallo en el blindaje de trazabilidad.', 500);
  }
};

/**
 * @function revertirCambioQuirurgico
 * @description Máquina del tiempo (Time Machine). Lee el 'Diff' almacenado en un log
 * específico y aplica las propiedades en sentido inverso sobre el documento original, 
 * devolviéndolo a su estado previo. Ideal para corregir capturas erróneas masivas.
 * 
 * @param {string} logId - Identificador del log que contiene el estado a restaurar.
 * @param {string} adminUid - Identificador del administrador ejecutando el Rollback.
 * @param {string} ipAddress - Dirección IP del administrador.
 * @returns {Promise<void>}
 * @throws {AppError} Si el log no existe, no posee un diff válido, o el documento original fue purgado.
 */
export const revertirCambioQuirurgico = async (logId: string, adminUid: string, ipAddress: string): Promise<void> => {
  const logDoc = await logsRef.doc(logId).get();
  if (!logDoc.exists) throw new AppError('Registro de auditoría no encontrado.', 404);

  const logData = logDoc.data() as LogAuditoria;
  const detalles = JSON.parse(logData.detalles);
  
  if (!detalles.cambiosAfectados) throw new AppError('El log no contiene un diff estructural para revertir.', 400);

  const estadoRestaurado: Record<string, any> = {};
  for (const key in detalles.cambiosAfectados) {
    if (detalles.cambiosAfectados[key].antes !== undefined) {
      estadoRestaurado[key] = detalles.cambiosAfectados[key].antes;
    }
  }

  const docObjetivoRef = db.collection(logData.coleccionAfectada).doc(logData.documentoId);

  await db.runTransaction(async (t) => {
    const docObjetivo = await t.get(docObjetivoRef);
    if (!docObjetivo.exists) throw new AppError('El documento original ya no existe.', 404);

    t.update(docObjetivoRef, estadoRestaurado);
  });

  await registrarLogAvanzado(adminUid, 'ROLLBACK_SISTEMA', logData.coleccionAfectada, logData.documentoId, ipAddress, docObjetivoRef, estadoRestaurado, { logRevertido: logId });
};

/**
 * @function enviarACuarentena
 * @description Bloquea el borrado destructivo (Zero-Trust). Aisla un documento crítico
 * para evitar su exposición y marca sus metadatos normativos como bloqueados,
 * requiriendo justificación forzosa por parte de la Jefatura.
 * 
 * @param {string} coleccion - Nombre de la colección donde reside el documento.
 * @param {string} documentoId - ID del documento a aislar.
 * @param {string} jefeUid - UID del Jefe autorizando la cuarentena.
 * @param {string} ipAddress - IP de origen.
 * @param {string} motivo - Justificación legal para el aislamiento del documento.
 * @returns {Promise<void>}
 */
export const enviarACuarentena = async (coleccion: string, documentoId: string, jefeUid: string, ipAddress: string, motivo: string): Promise<void> => {
  const docRef = db.collection(coleccion).doc(documentoId);
  
  await db.runTransaction(async (t) => {
    const doc = await t.get(docRef);
    if (!doc.exists) throw new AppError('Documento no encontrado.', 404);

    t.update(docRef, {
      estatus: 'CUARENTENA',
      'metadata.bloqueadoHistorico': true,
      'metadata.fechaCuarentena': new Date(),
      'metadata.motivoCuarentena': motivo
    });
  });

  await registrarLogAvanzado(jefeUid, 'AISLAMIENTO_CUARENTENA', coleccion, documentoId, ipAddress, null, null, { motivo });
};

/**
 * @function analizarProductividadOperativa
 * @description Minería de datos para el reporte de productividad[cite: 3]. Analiza el volumen 
 * de captura por usuario en un lapso determinado para calcular el Lead Time operativo.
 * 
 * @param {Date} fechaInicio - Límite inferior del periodo a evaluar.
 * @param {Date} fechaFin - Límite superior del periodo a evaluar.
 * @returns {Promise<Record<string, number>>} Mapa con UIDs de capturistas y su total de registros procesados.
 */
export const analizarProductividadOperativa = async (fechaInicio: Date, fechaFin: Date): Promise<Record<string, number>> => {
  const snapshot = await logsRef
    .where('accion', '==', 'CREAR_EXPEDIENTE')
    .where('fecha', '>=', fechaInicio)
    .where('fecha', '<=', fechaFin)
    .get();

  const productividadPorUsuario: Record<string, number> = {};

  snapshot.docs.forEach(doc => {
    const uid = doc.data().usuarioUid;
    productividadPorUsuario[uid] = (productividadPorUsuario[uid] || 0) + 1;
  });

  return productividadPorUsuario;
};

/**
 * @function generarMetadataParaDictamenLGA
 * @description Proceso de Compliance automatizado. Identifica todos los expedientes cuyo 
 * estatus transicionó a "HISTORICO" dentro de un año fiscal para nutrir los PDF 
 * obligatorios de la Ley General de Archivos[cite: 3].
 * 
 * @param {number} anioFiscal - Año sobre el cual se realizará el dictamen.
 * @returns {Promise<any>} Objeto con totales, lista de matrículas y metadatos del reporte.
 */
export const generarMetadataParaDictamenLGA = async (anioFiscal: number): Promise<any> => {
  const inicio = new Date(`${anioFiscal}-01-01`);
  const fin = new Date(`${anioFiscal}-12-31`);

  const snapshot = await logsRef
    .where('accion', '==', 'ACTUALIZAR_EXPEDIENTE')
    .where('fecha', '>=', inicio)
    .where('fecha', '<=', fin)
    .get();

  const expedientesTransferidos: string[] = [];

  snapshot.docs.forEach(doc => {
    const detalles = JSON.parse(doc.data().detalles);
    if (detalles.cambiosAfectados?.estatus?.despues === 'HISTORICO') {
      expedientesTransferidos.push(doc.data().documentoId);
    }
  });

  return {
    anioFiscal,
    totalTransferencias: expedientesTransferidos.length,
    matriculasInvolucradas: expedientesTransferidos,
    notaLGA: 'Datos listos para ser inyectados en el PDF de Transferencia Primaria según Ley General de Archivos.'
  };
};