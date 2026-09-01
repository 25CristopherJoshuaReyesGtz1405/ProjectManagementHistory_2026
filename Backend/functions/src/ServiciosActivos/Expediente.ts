/**
 * ============================================================================
 * MÓDULO: SERVICIO DE GESTIÓN DE EXPEDIENTES (SIGAH v3.0)
 * ============================================================================
 * 
 *      Motor transaccional para la gestión de los 60,000 registros del ITD. Integra tolerancia a fallos 
 * en ingestas masivas (DLQ), validación con Zod, aceleración en RAM (Cache-Aside), Control de 
 * Concurrencia Optimista (OCC), tokenización multidimensional y enmascaramiento dinámico de datos 
 * sensibles (PII).
 * 
 * ============================================================================
 */

import { db } from "../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js";
import { registrarLogAvanzado } from "./Auditoria.js";
import { vincularExpedienteAcademico } from "./Persona.js";
import { incrementarEstadisticasIncrementales } from "./Estadisticas.js";
import { AppError } from "../UtilidadesActivas/AppError.js";
import { ExpedienteSchema } from "../ValidacionesActivas/Expediente.schema.js";
import type { Expediente, NivelAcademico } from "../ModelosAplicacion/ModelosAplicacion.model.js";
import csv from "csv-parser";
import fs from "fs";
import crypto from "crypto";
import { getStorage } from "firebase-admin/storage";

const expedientesRef = db.collection("expedientes");
const tareasRef = db.collection("cola_tareas");

// Caché en RAM: Mantiene registros frecuentes en memoria por 15 minutos (0ms latencia).
// Implementación local para evitar una dependencia externa y sus declaraciones de tipos.
const CACHE_TTL_MS = 15 * 60 * 1000;
const expedienteCache = new Map<string, { value: Expediente; expiresAt: number }>();

const obtenerDelCache = (key: string): Expediente | undefined => {
  const entrada = expedienteCache.get(key);
  if (!entrada || entrada.expiresAt <= Date.now()) {
    expedienteCache.delete(key);
    return undefined;
  }
  return entrada.value;
};

const guardarEnCache = (key: string, value: Expediente): void => {
  expedienteCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

/**
 * ============================================================================
 * UTILIDADES PRIVADAS DE SEGURIDAD, NORMATIVA Y BÚSQUEDA
 * ============================================================================
 */

/**
 * @description Bloquea operaciones destructivas fuera del horario institucional.
 * Implementa el protocolo de seguridad Zero-Trust.
 * @throws {AppError} Si la transacción ocurre fuera de las 07:00 a 21:00 hrs.
 */
const validarHorarioOperativo = (): void => {
  const horaActual = new Date().getHours();
  if (horaActual < 7 || horaActual > 21) {
    throw new AppError("Alerta Zero-Trust: Operación denegada fuera de la jornada laboral.", 403);
  }
};

/**
 * @description Verifica el Principio de Inalterabilidad Histórica dictado por la LGA.
 * @param {Expediente} expediente - Documento a evaluar.
 * @returns {boolean} True si el egreso supera los 5 años o su estatus es HISTORICO.
 */
const verificarBloqueoHistorico = (expediente: Expediente): boolean => {
  if (expediente.estatus === "HISTORICO") return true;
  if (expediente.fechaEgreso) {
    const aniosTranscurridos = new Date().getFullYear() - new Date(expediente.fechaEgreso).getFullYear();
    return aniosTranscurridos >= 5;
  }
  return false;
};

/**
 * @description Genera un sello SHA-256 para auditoría forense e inalterabilidad de datos.
 * @param {string} numControl - Matrícula del egresado.
 * @param {string} curp - CURP o Identificador maestro.
 * @param {string} estatus - Estatus del expediente.
 * @returns {string} Sello en formato hexadecimal.
 */
const generarSelloInalterabilidad = (numControl: string, curp: string, estatus: string): string => {
  const secretSalt = process.env.SIGAH_SECRET_SALT || "ITD_Archivo_Historico_1948";
  return crypto.createHash("sha256").update(`${numControl}|${curp}|${estatus}|${secretSalt}`).digest("hex");
};

/**
 * @description Genera N-gramas (Fuzzy Matching) para habilitar búsquedas instantáneas y 
 * tolerantes a errores tipográficos directamente desde el frontend.
 * @param {string} numControl - Matrícula principal.
 * @param {string} textoBase - Carrera o nombre a fusionar en los tokens.
 * @returns {string[]} Arreglo de fragmentos lexicográficos.
 */
const generarTokensBusqueda = (numControl: string, textoBase: string = ''): string[] => {
  const cadenaLimpia = `${numControl} ${textoBase}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const palabras = cadenaLimpia.split(' ').filter(p => p.length > 1);
  const keywords = new Set<string>();

  palabras.forEach(palabra => {
    for (let i = 2; i <= palabra.length; i++) keywords.add(palabra.substring(0, i));
  });
  return Array.from(keywords);
};

/**
 * @description Data Masking: Privacidad por diseño. Censura PII e información 
 * topográfica para roles con privilegios limitados.
 * @param {Expediente} expediente - Objeto crudo de la base de datos.
 * @returns {Expediente} Objeto con datos censurados.
 */
const enmascararDatosPII = (expediente: Expediente): Expediente => {
  const expedienteMasked = { ...expediente };
  // Oculta los últimos dígitos de la matrícula: "22041122" -> "2204****"
  expedienteMasked.numControl = expediente.numControl.replace(/(.{4}).*/, "$1****");
  
  // Ocultamiento de la ubicación física exacta
  if (expedienteMasked.ubicacion) {
      expedienteMasked.ubicacion.carpeta = "***";
      expedienteMasked.ubicacion.caja = "***";
  }
  return expedienteMasked;
};

/**
 * ============================================================================
 * SERVICIOS PÚBLICOS DE CONSULTA Y BÚSQUEDA
 * ============================================================================
 */

/**
 * @description Consulta individual protegida por Caché LRU y Data Masking.
 * @param {string} numControl - Matrícula objetivo.
 * @param {string} rolUsuario - Rol del solicitante extraído del JWT.
 * @returns {Promise<Expediente | null>} Estructura del expediente (cruda o enmascarada).
 */
export const consultarExpedientePorNumControl = async (numControl: string, rolUsuario: string): Promise<Expediente | null> => {
  const cacheKey = `exp_${numControl}`;
  let expediente = obtenerDelCache(cacheKey);

  if (!expediente) {
    const doc = await expedientesRef.doc(numControl).get();
    if (!doc.exists) return null;
    expediente = { id: doc.id, ...doc.data() } as any as Expediente;
    guardarEnCache(cacheKey, expediente);
  }

  // Roles externos (Ej. Bolsa de Trabajo o Auditor Básico) reciben datos censurados
  if (!['ADMIN', 'JEFATURA', 'VENTANILLA'].includes(rolUsuario)) {
    return enmascararDatosPII(expediente);
  }
  return expediente;
};

/**
 * @description Buscador reactivo O(1). Resuelve coincidencias mediante índices de Firestore.
 * @param {string} termino - Matrícula, nombre o carrera a buscar.
 * @returns {Promise<Expediente[]>} Lista paginada de coincidencias.
 */
export const buscarExpedientesGlobal = async (termino: string): Promise<Expediente[]> => {
  const term = termino.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!term || term.length < 2) return [];

  try {
    const snapshot = await expedientesRef
      .where("keywords", "array-contains", term)
      .where("estatus", "!=", "BAJA_DEFINITIVA")
      .limit(15) 
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any as Expediente);
  } catch (error) {
    throw new AppError("Fallo en el motor de búsqueda vectorial.", 500);
  }
};

/**
 * @description Listado general paginado para vistas iniciales.
 * @returns {Promise<Expediente[]>} Colección de los 20 registros más recientes.
 */
export const consultarExpedientes = async (): Promise<Expediente[]> => {
  const snapshot = await expedientesRef.orderBy("metadata.fechaCreacion", "desc").limit(20).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as any as Expediente);
};

/**
 * ============================================================================
 * SERVICIOS PÚBLICOS DE MUTACIÓN Y CREACIÓN
 * ============================================================================
 */

/**
 * @description Inicializa un expediente validado estrictamente en tiempo de ejecución.
 * @param {any} nuevoExpedienteCrudo - Payload enviado desde el frontend.
 * @param {string} usuarioUid - UID del capturista (Auditoría).
 * @throws {AppError} Si la validación Zod detecta inconsistencias o inyecciones.
 */
export const crearExpediente = async (
  nuevoExpedienteCrudo: any,
  usuarioUid: string
): Promise<void> => {
  
  // Sanitización estricta mediante Zod
  const validacion = ExpedienteSchema.safeParse(nuevoExpedienteCrudo);
if (!validacion.success) {
  throw new AppError(`Formato inválido`, 400);
}

// Purga inmediata de campos undefined para satisfacer a TS y a Firestore
const nuevoExpediente = JSON.parse(JSON.stringify(validacion.data));

  const { titulacion: titulacionValidada, ...expedienteSinTitulacion } = nuevoExpediente;
  const batch = db.batch();
  const docRef = expedientesRef.doc(nuevoExpediente.numControl);
  
  const firmaDigital = generarSelloInalterabilidad(nuevoExpediente.numControl, nuevoExpediente.personaId || 'N/A', nuevoExpediente.estatus);

  const data: Partial<Expediente> = {
    ...expedienteSinTitulacion,
    estatus: nuevoExpediente.estatus as Expediente["estatus"],
    nivel: nuevoExpediente.nivel as NivelAcademico,
    ...(titulacionValidada !== undefined
      ? { titulacion: titulacionValidada as Expediente["titulacion"] }
      : {}),
    ubicacion: {
      ...nuevoExpediente.ubicacion,
      estadoConservacion: "BUENO" as Expediente["ubicacion"]["estadoConservacion"]
    },
    keywords: generarTokensBusqueda(nuevoExpediente.numControl, nuevoExpediente.carrera),
    bloqueadoHistorico: false,
    metadata: { creadoPor: usuarioUid, fechaCreacion: new Date(), version: 1, firmaDigital } as any
  };

  batch.set(docRef, data);
  await incrementarEstadisticasIncrementales(nuevoExpediente.nivel, batch);
  await batch.commit();
  
  if (nuevoExpediente.personaId && nuevoExpediente.personaId !== 'PENDIENTE_VINCULACION') {
      await vincularExpedienteAcademico(nuevoExpediente.personaId, nuevoExpediente.numControl, usuarioUid);
  }
  await registrarLogAvanzado(usuarioUid, "CREAR_EXPEDIENTE", "expedientes", nuevoExpediente.numControl, "Internal_IP", null, data);
};

/**
 * @description Mutación protegida con Control de Concurrencia Optimista (OCC). Evita 
 * "Actualizaciones Perdidas" si dos operadores editan simultáneamente.
 * @param {string} numControl - Matrícula objetivo.
 * @param {Partial<Expediente>} cambios - Diferencial de campos a mutar.
 * @param {string} usuarioUid - Ejecutor.
 * @param {string} motivoCambio - Justificación obligatoria para la bitácora.
 * @param {number} versionEsperada - Versión leída por el cliente antes de la mutación.
 */
export const actualizarExpedienteOCC = async (
  numControl: string,
  cambios: Partial<Expediente>,
  usuarioUid: string,
  motivoCambio: string,
  versionEsperada: number
): Promise<void> => {
  validarHorarioOperativo();
  const docRef = expedientesRef.doc(numControl);
  
  await db.runTransaction(async (t) => {
    const snap = await t.get(docRef);
    if (!snap.exists) throw new AppError("Expediente no localizado.", 404);
    
    const actual = snap.data() as Expediente;
    
    // Verificación de colisiones concurrentes (OCC)
    if (actual.metadata.version !== versionEsperada) {
      throw new AppError("CONCURRENCIA: El expediente fue modificado por otro usuario. Recargue la información.", 409);
    }

    if (verificarBloqueoHistorico(actual)) {
      throw new AppError("REGLA_VIOLADA: Modificación arbitraria de acervo histórico denegada.", 403);
    }

    t.update(docRef, {
      ...cambios,
      "metadata.fechaUltimaModificacion": new Date(),
      "metadata.modificadoPor": usuarioUid,
      "metadata.version": actual.metadata.version + 1,
    });
  });

  expedienteCache.delete(`exp_${numControl}`); // Obliga a la red a cargar la nueva versión
  await registrarLogAvanzado(usuarioUid, "ACTUALIZAR_EXPEDIENTE_OCC", "expedientes", numControl, "Internal_IP", null, cambios, { motivoCambio });
};

/**
 * @description Modifica estrictamente las coordenadas físicas previniendo saturación de anaqueles.
 */
export const actualizarUbicacionFisica = async (
  numControl: string,
  ubicacion: Expediente["ubicacion"],
  usuarioUid: string,
  versionEsperada: number
): Promise<void> => {
  const LIMITE_POR_CAJA = 50;
  const snapshotCaja = await expedientesRef
    .where("ubicacion.edificio", "==", ubicacion.edificio)
    .where("ubicacion.estante", "==", ubicacion.estante)
    .where("ubicacion.caja", "==", ubicacion.caja)
    .count()
    .get();

  if (snapshotCaja.data().count >= LIMITE_POR_CAJA) {
    throw new AppError(`La Caja ${ubicacion.caja} ha superado el límite operativo de ${LIMITE_POR_CAJA} carpetas.`, 400);
  }

  await actualizarExpedienteOCC(numControl, { ubicacion }, usuarioUid, "Actualización topográfica", versionEsperada);
};

/**
 * ============================================================================
 * KILLER FEATURES: INGESTA MASIVA (DLQ), PORTABILIDAD Y COLD STORAGE
 * ============================================================================
 */

/**
 * @description Data Portability. Empaqueta el registro completo asegurando autoría.
 */
export const exportarExpedienteCertificado = async (numControl: string, adminUid: string, rolUsuario: string): Promise<any> => {
  const expediente = await consultarExpedientePorNumControl(numControl, rolUsuario);
  if (!expediente) throw new AppError("Documento no encontrado.", 404);

  const payloadExportacion = {
    institucion: "Instituto Tecnológico de Durango",
    fechaExportacion: new Date().toISOString(),
    datos: expediente,
    firmaCertificadora: generarSelloInalterabilidad(numControl, expediente.personaId, expediente.estatus)
  };

  await registrarLogAvanzado(adminUid, "EXPORTACION_CERTIFICADA", "expedientes", numControl, "Internal_IP");
  return payloadExportacion;
};

/**
 * @description Punto de entrada para el Bulk Import. Dispara el procesamiento asíncrono.
 */
export const iniciarImportacionAsincrona = async (filePath: string, usuarioUid: string): Promise<string> => {
  const tareaRef = tareasRef.doc();
  const jobId = tareaRef.id;

  await tareaRef.set({
    estatus: "PROCESANDO",
    totalProcesados: 0,
    totalEsperado: "Analizando I/O...",
    creadoPor: usuarioUid,
    fechaInicio: new Date(),
  });

  procesarCSVEnBackground(filePath, usuarioUid, jobId).catch(err => console.error(`Error crítico DLQ en Job ${jobId}`, err));
  return jobId;
};

/**
 * @description Motor Batch con Stream. Si un registro falla la validación Zod, 
 * se enruta a la Dead Letter Queue (DLQ) garantizando la continuidad del lote general.
 */
const procesarCSVEnBackground = async (filePath: string, usuarioUid: string, jobId: string) => {
  const resultadosBrutos: any[] = [];
  
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => resultadosBrutos.push(data))
    .on("end", async () => {
      let exitosos = 0;
      let anomalias = 0;
      const total = resultadosBrutos.length;

      await tareasRef.doc(jobId).update({ totalEsperado: total, estatus: "SANITIZANDO_ZOD" });

      while (exitosos + anomalias < total) {
        const batch = db.batch();
        // Procesamiento en lotes de 400 para respetar límites de escritura de Firestore
        const chunk = resultadosBrutos.slice(exitosos + anomalias, exitosos + anomalias + 400);

        for (const filaCruda of chunk) {
          const validacion = ExpedienteSchema.safeParse(filaCruda);

          if (validacion.success) {
            const datosLimpios = validacion.data;
            const docRef = expedientesRef.doc(datosLimpios.numControl);
            
            batch.set(docRef, {
              ...datosLimpios,
              keywords: generarTokensBusqueda(datosLimpios.numControl, datosLimpios.carrera),
              metadata: { creadoPor: usuarioUid, fechaCreacion: new Date(), version: 1 } as any
            });
            exitosos++;
          } else {
            // Aislamiento: Envío a la Dead Letter Queue
            const anomaliaRef = tareasRef.doc(jobId).collection("cola_anomalias").doc();
            batch.set(anomaliaRef, {
              payloadOriginal: filaCruda,
              motivoRechazo: validacion.error.issues,
              fechaFallo: new Date()
            });
            anomalias++;
          }
        }

        await batch.commit();
        await tareasRef.doc(jobId).update({ totalProcesados: exitosos, totalAnomalias: anomalias });
      }

      await tareasRef.doc(jobId).update({ 
        estatus: anomalias > 0 ? "COMPLETADO_CON_ADVERTENCIAS" : "COMPLETADO", 
        fechaFin: new Date() 
      });

      // Recolección de basura: Libera almacenamiento temporal del contenedor Node.js
      fs.unlink(filePath, () => {}); 
    });
};

/**
 * @description Invierte el ciclo FinOps. Descongela documentos de Google Cloud Storage 
 * de ultrabajo costo y los reintegra a la memoria caliente de Firestore.
 */
export const restaurarDesdeBovedaFria = async (numControl: string, adminUid: string): Promise<void> => {
  const bucket = getStorage().bucket("sigah-boveda-fria");
  const archivoColdStorage = bucket.file(`cold_storage/${numControl}.json`);
  
  const [existe] = await archivoColdStorage.exists();
  if (!existe) throw new AppError(`Inconsistencia: El respaldo del expediente ${numControl} no existe en bóveda fría.`, 404);

  const [buffer] = await archivoColdStorage.download();
  const expedienteRestaurado = JSON.parse(buffer.toString("utf-8"));
  
  const batch = db.batch();
  const docRef = expedientesRef.doc(numControl);
  
  batch.update(docRef, {
    archivos: expedienteRestaurado.archivos || [],
    "metadata.enBovedaFria": false,
    "metadata.fechaRestauracion": new Date(),
    "metadata.modificadoPor": adminUid,
  });

  await batch.commit();
  expedienteCache.delete(`exp_${numControl}`);
  await registrarLogAvanzado(adminUid, "RESTAURACION_BOVEDA_FRIA", "expedientes", numControl, "Internal_IP");
};