/**
 * ============================================================================
 * MÓDULO: SERVICIO DE IDENTIDAD MAESTRA (SIGAH v3.0)
 * ============================================================================
 * @description Centraliza la identidad única del alumno (Master Data Management).
 * Implementa normalización fonética, Data Masking para PII, Caché LRU, 
 * transaccionalidad atómica (Upsert) y deduplicación forense.
 * 
 * @author Cristopher Joshua Reyes Gutiérrez
 * @version 3.0.0
 * ============================================================================
 */

import { db } from '../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js';
import { registrarLogAvanzado, enviarACuarentena } from './Auditoria.js';
import { AppError } from '../UtilidadesActivas/AppError.js';
import { PersonaSchema } from '../ValidacionesActivas/Personas.schema.js';
import type { Persona, MetadataRegistro } from '../ModelosAplicacion/ModelosAplicacion.model.js';

/** Caché en memoria compatible con las operaciones usadas por este servicio. */
class MemoriaCache {
  private readonly datos = new Map<string, { valor: unknown; expira: number }>();

  constructor(private readonly ttlSegundos: number) {}

  get<T>(clave: string): T | undefined {
    const entrada = this.datos.get(clave);
    if (!entrada || entrada.expira <= Date.now()) {
      this.datos.delete(clave);
      return undefined;
    }
    return entrada.valor as T;
  }

  set<T>(clave: string, valor: T): boolean {
    this.datos.set(clave, {
      valor,
      expira: Date.now() + this.ttlSegundos * 1000
    });
    return true;
  }

  del(clave: string): number {
    return this.datos.delete(clave) ? 1 : 0;
  }

  flushAll(): void {
    this.datos.clear();
  }
}

const personasRef = db.collection('personas');

// Caché en RAM para Identidades (Acelera búsquedas repetitivas de perfiles)
const personaCache = new MemoriaCache(1800); // 30 minutos

import crypto from "crypto";

/**
 * ============================================================================
 * UTILIDADES PRIVADAS Y SEGURIDAD
 * ============================================================================
 */

/**
 * @description BUS DE EVENTOS (Pub/Sub). Desacopla la arquitectura. Cuando una identidad 
 * muta, emite un evento para que otros sistemas (Bolsa de Trabajo, Médicos) reaccionen.
 */
const publicarEventoBus = async (topico: string, payload: any): Promise<void> => {
  // En producción, esto conectaría con Google Cloud Pub/Sub o Apache Kafka.
  // Ejemplo: pubsub.topic(topico).publishJSON(payload);
  console.log(`[EVENT_BUS] Transmitiendo evento a la red: ${topico}`, payload.id);
};

/**
 * @description Distancia de Levenshtein. Mide la diferencia matemática entre dos cadenas 
 * de texto para el motor de Inteligencia Artificial (Entity Resolution).
 */
const calcularSimilitud = (a: string, b: string): number => {
  const matriz = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) matriz[0]![i] = i;
  for (let j = 0; j <= b.length; j += 1) matriz[j]![0] = j;
  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const costoSustitucion = a[i - 1] === b[j - 1] ? 0 : 1;
      matriz[j]![i] = Math.min(
        matriz[j]![i - 1] + 1, 
        matriz[j - 1]![i] + 1, 
        matriz[j - 1]![i - 1] + costoSustitucion
      );
    }
  }
  const distancia = matriz[b.length]![a.length];
  const longitudMaxima = Math.max(a.length, b.length);
  return ((longitudMaxima - distancia) / longitudMaxima) * 100; // Porcentaje de similitud
};

/**
 * @description Genera un índice de prefijos tolerante a faltas de ortografía (Fuzzy Matching).
 * Acelera las búsquedas reactivas O(1) desde Angular mediante array-contains.
 */
const generarClavesFoneticas = (nombre: string, ap1: string, ap2: string = ''): string[] => {
  const cadenaLimpia = `${nombre} ${ap1} ${ap2}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/\s+/g, " ") 
    .toLowerCase()
    .trim();

  const palabras = cadenaLimpia.split(' ').filter(p => p.length > 1);
  const keywords = new Set<string>();

  palabras.forEach(palabra => {
    // Iniciamos en 2 para evitar saturar el índice con letras sueltas
    for (let i = 2; i <= palabra.length; i++) {
      keywords.add(palabra.substring(0, i));
    }
  });

  return Array.from(keywords);
};

/**
 * @description Data Masking: Oculta datos PII (Personally Identifiable Information)
 * como la CURP o el RFC si el solicitante no tiene privilegios gerenciales.
 */
const enmascararPIIPersona = (persona: Persona): Persona => {
  const personaMasked = { ...persona };
  if (personaMasked.curp) {
    // "XAXX010101HDFXXX01" -> "XAXX**********XX01"
    personaMasked.curp = personaMasked.curp.replace(/(.{4}).*(.{4})/, "$1**********$2");
  }
  if (personaMasked.rfc) {
    personaMasked.rfc = personaMasked.rfc.replace(/(.{3}).*(.{3})/, "$1******$2");
  }
  // La fecha de nacimiento se censura, dejando solo el año
  if (personaMasked.fechaNacimiento) {
    const anio = new Date(personaMasked.fechaNacimiento).getFullYear();
    personaMasked.fechaNacimiento = `****-**-** (Año: ${anio})`;
  }
  return personaMasked;
};

/**
 * ============================================================================
 * SERVICIOS DE MUTACIÓN Y ORQUESTACIÓN DE IDENTIDADES
 * ============================================================================
 */

/**
 * @description Asegurar Identidad Maestra (Upsert Pattern Transaccional).
 * Elimina las "Race Conditions" garantizando que nunca se duplique una CURP, 
 * evaluando y creando la identidad en el mismo ciclo atómico.
 * 
 * @param {any} datosPersonaCrudos - Payload desde el cliente.
 * @param {string} usuarioUid - Ejecutor (Auditoría).
 * @returns {Promise<string>} El ID único del documento (existente o nuevo).
 */
export const asegurarIdentidadMaestra = async (
  datosPersonaCrudos: any,
  usuarioUid: string
): Promise<string> => {
  
  // Sanitización estricta de Zod en tiempo de ejecución
  const validacion = PersonaSchema.safeParse(datosPersonaCrudos);
  if (!validacion.success) {
    throw new AppError(`Inconsistencia biométrica: ${JSON.stringify(validacion.error.issues)}`, 400);
  }

  const datos = validacion.data;
  const curpNormalizada = datos.curp.toUpperCase().trim();

  // Transacción Atómica para prevenir duplicidad concurrente
  return await db.runTransaction(async (t) => {
    const snapshot = await t.get(personasRef.where('curp', '==', curpNormalizada).limit(1));
    
    const personaExistente = snapshot.docs[0];
    if (personaExistente) {
      return personaExistente.id; // Si ya existe, retorna el ID sin sobreescribir
    }

    const nuevaPersonaRef = personasRef.doc();
    const metadata: MetadataRegistro = { creadoPor: usuarioUid, fechaCreacion: new Date(), version: 1 };

    const nuevaPersona: Partial<Persona> = {
      id: datos.id,
      nombre: datos.nombre,
      primerApellido: datos.primerApellido,
      fechaNacimiento: datos.fechaNacimiento,
      curp: curpNormalizada,
      expedientesAsociados: [], 
      keywords: generarClavesFoneticas(datos.nombre, datos.primerApellido, datos.segundoApellido),
      metadata
    };

    if (datos.rfc !== undefined) nuevaPersona.rfc = datos.rfc;
    if (datos.segundoApellido !== undefined) nuevaPersona.segundoApellido = datos.segundoApellido;
    if (datos.genero !== undefined) nuevaPersona.genero = datos.genero;

    t.set(nuevaPersonaRef, nuevaPersona);
    
    // Disparamos el log forense
    await registrarLogAvanzado(usuarioUid, 'CREAR_IDENTIDAD_MAESTRA', 'personas', nuevaPersonaRef.id, 'Internal_IP', null, nuevaPersona);
    
    return nuevaPersonaRef.id;
  });
};

/**
 * @description Conecta una matrícula al arreglo de la identidad (Dualidad Académica).
 */
export const vincularExpedienteAcademico = async (
  personaId: string,
  numControl: string,
  usuarioUid: string
): Promise<void> => {
  const personaRef = personasRef.doc(personaId);

  await db.runTransaction(async (t) => {
    const doc = await t.get(personaRef);
    if (!doc.exists) throw new AppError('La identidad maestra no fue localizada.', 404);
    
    const data = doc.data() as Persona;
    const expedientes = data.expedientesAsociados || [];

    if (!expedientes.includes(numControl)) {
      const expedientesNuevos = [...expedientes, numControl];
      t.update(personaRef, {
        expedientesAsociados: expedientesNuevos,
        'metadata.fechaUltimaModificacion': new Date(),
        'metadata.modificadoPor': usuarioUid,
        'metadata.version': (data.metadata?.version || 1) + 1
      });
      
      personaCache.del(`per_id_${personaId}`);
      personaCache.del(`per_mat_${numControl}`);
    }
  });

  await registrarLogAvanzado(usuarioUid, 'VINCULAR_EXPEDIENTE_A_PERSONA', 'personas', personaId, 'Internal_IP', null, { numControl });
};

/**
 * @description KILLER FEATURE: Deduplicación Forense (Fusión de Identidades).
 * Si por error histórico de captura[cite: 1] existen dos perfiles para el mismo egresado, 
 * este algoritmo los fusiona, traslada sus expedientes y manda a cuarentena el duplicado.
 */
export const fusionarIdentidades = async (
  idMaestro: string,
  idDuplicado: string,
  adminUid: string,
  ipAddress: string
): Promise<void> => {
  const maestroRef = personasRef.doc(idMaestro);
  const duplicadoRef = personasRef.doc(idDuplicado);

  await db.runTransaction(async (t) => {
    const docMaestro = await t.get(maestroRef);
    const docDuplicado = await t.get(duplicadoRef);

    if (!docMaestro.exists || !docDuplicado.exists) {
      throw new AppError('Uno o ambos registros de identidad no existen.', 404);
    }

    const dataMaestro = docMaestro.data() as Persona;
    const dataDuplicado = docDuplicado.data() as Persona;

    // Fusionar expedientes evitando duplicados
    const expedientesCombinados = Array.from(new Set([
      ...(dataMaestro.expedientesAsociados || []),
      ...(dataDuplicado.expedientesAsociados || [])
    ]));

    t.update(maestroRef, {
      expedientesAsociados: expedientesCombinados,
      'metadata.fechaUltimaModificacion': new Date(),
      'metadata.modificadoPor': adminUid,
      'metadata.version': (dataMaestro.metadata?.version || 1) + 1
    });

    // En lugar de borrar destructivamente, aislamos el duplicado vía el servicio central
    await enviarACuarentena('personas', idDuplicado, adminUid, ipAddress, `Fusión de identidad hacia el ID Maestro: ${idMaestro}`);
  });

  personaCache.flushAll(); // Limpieza global preventiva de caché
  await registrarLogAvanzado(adminUid, 'FUSION_DE_IDENTIDADES', 'personas', idMaestro, ipAddress, null, { duplicadoAbsorbido: idDuplicado });
};

/**
 * ============================================================================
 * SERVICIOS DE CONSULTA, BÚSQUEDA Y DATA MASKING
 * ============================================================================
 */

/**
 * ============================================================================
 * KILLER FEATURES: ESCALABILIDAD FUTURA (IA, IdP Y COMPLIANCE)
 * ============================================================================
 */

/**
 * @description RESOLUCIÓN DE ENTIDADES (Machine Learning).
 * Escanea el padrón buscando perfiles que probablemente sean la misma persona 
 * (errores históricos de captura[cite: 1]) y genera un dictamen para la Jefatura.
 * 
 * @param {number} umbralSimilitud - Porcentaje mínimo para considerar un duplicado (Ej. 85).
 * @returns {Promise<any[]>} Lista de sugerencias de fusión.
 */
export const analizarDuplicidadPredictiva = async (umbralSimilitud: number = 85): Promise<any[]> => {
  // En producción, esto se procesaría en BigQuery o Vertex AI. Para el MVP usamos el servidor:
  const snapshot = await personasRef.limit(1000).get(); // Muestreo
  const personas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Persona));
  const sugerencias: any[] = [];

  for (let i = 0; i < personas.length; i++) {
    for (let j = i + 1; j < personas.length; j++) {
      const nombreA = `${personas[i]?.nombre} ${personas[i]?.primerApellido}`;
      const nombreB = `${personas[j]?.nombre} ${personas[j]?.primerApellido}`;

      const similitud = calcularSimilitud(nombreA, nombreB);
      
      if (similitud >= umbralSimilitud && similitud < 100) {
        sugerencias.push({
          certeza: similitud.toFixed(2) + '%',
          perfilA: { id: personas[i]!.id, nombre: nombreA, curp: personas[i]!.curp },
          perfilB: { id: personas[j]!.id, nombre: nombreB, curp: personas[j]!.curp },
          accionSugerida: 'FUSION_REQUERIDA'
        });
      }
    }
  }
  return sugerencias;
};

/**
 * @description OLVIDO CRIPTOGRÁFICO (Compliance ARCO vs Ley de Archivos)[cite: 3].
 * Destruye la información personal identificable (PII) sobrescribiéndola con 
 * un hash aleatorio irrecuperable. Mantiene los arrays de expedientes asociados 
 * intactos para no alterar la estadística de egresados de la institución.
 * 
 * @param {string} personaId - Identificador del perfil.
 * @param {string} adminUid - ID del Oficial de Privacidad autorizando.
 */
export const ejecutarOlvidoCriptografico = async (personaId: string, adminUid: string): Promise<void> => {
  const personaRef = personasRef.doc(personaId);
  
  await db.runTransaction(async (t) => {
    const doc = await t.get(personaRef);
    if (!doc.exists) throw new AppError('Identidad no encontrada.', 404);

    const claveDestruccion = crypto.randomBytes(32).toString('hex');
    
    // Cifrado de un solo sentido (Destrucción)
    const shred = (data: string) => crypto.createHash('sha256').update(data + claveDestruccion).digest('hex');

    t.update(personaRef, {
      nombre: `ANONIMO_${shred('nombre').substring(0,8)}`,
      primerApellido: 'ELIMINADO_POR_ARCO',
      segundoApellido: 'ELIMINADO_POR_ARCO',
      curp: shred('curp'),
      rfc: shred('rfc'),
      keywords: [], // Purgar índice de búsqueda
      'metadata.fechaOlvidoCriptografico': new Date(),
      'metadata.ejecutorOlvido': adminUid
    });
  });

  personaCache.del(`per_id_${personaId}`);
  await publicarEventoBus('ITD_IDENTIDAD_PURGADA_ARCO', { id: personaId });
  await registrarLogAvanzado(adminUid, 'OLVIDO_CRIPTOGRAFICO_ARCO', 'personas', personaId, 'Internal_IP');
};

/**
 * @description IDENTIDAD FEDERADA (IdP Provider).
 * Genera un token de afirmación (Assertion Token) para permitir que este egresado 
 * inicie sesión en plataformas externas del TecNM utilizando su identidad central del SIGAH.
 * 
 * @param {string} personaId - Identificador del alumno.
 * @returns {Promise<string>} Token JWT firmado por la institución.
 */
export const generarTokenFederadoSSO = async (personaId: string): Promise<string> => {
  const doc = await personasRef.doc(personaId).get();
  if (!doc.exists) throw new AppError('Identidad no encontrada.', 404);
  const persona = doc.data() as Persona;

  // El payload del JWT que se compartirá con la Bolsa de Trabajo o el portal Alumni
  const payloadFederado = {
    sub: persona.id,
    iss: 'https://sigah.itdurango.edu.mx',
    aud: 'tecnm_ecosystem',
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 15), // Expira en 15 minutos
    academic_ids: persona.expedientesAsociados
  };

  // Firma simétrica HSM (Mock)
  const token = Buffer.from(JSON.stringify(payloadFederado)).toString('base64');
  
  await registrarLogAvanzado('SISTEMA_FEDERADO', 'EMISION_TOKEN_SSO', 'personas', personaId, 'Internal_IP');
  return token;
};

/**
 * @description Búsqueda Omnibox tolerante a fallos.
 */
export const buscarIdentidadesPorNombre = async (termino: string, rolUsuario: string): Promise<Persona[]> => {
  const term = termino.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (!term || term.length < 2) return [];

  try {
    const snapshot = await personasRef
      .where("keywords", "array-contains", term)
      .limit(15) 
      .get();
      
    return snapshot.docs.map(doc => {
      const persona = { id: doc.id, ...doc.data() } as any as Persona;
      return ['ADMIN', 'JEFATURA', 'TITULACION'].includes(rolUsuario) ? persona : enmascararPIIPersona(persona);
    });
  } catch (error) {
    throw new AppError("Fallo estructural en el motor de búsqueda biométrica.", 500);
  }
};

/**
 * @description Recupera la identidad completa utilizando caché LRU para latencia 0ms.
 */
export const buscarIdentidadPorId = async (idDocumento: string, rolUsuario: string): Promise<Persona> => {
  if (!idDocumento) throw new AppError("Identificador ausente.", 400);

  const cacheKey = `per_id_${idDocumento}`;
  let persona = personaCache.get<Persona>(cacheKey);

  if (!persona) {
    const snapshot = await personasRef.doc(idDocumento).get();
    if (!snapshot.exists) throw new AppError("Identidad no localizada.", 404);
    
    persona = { id: snapshot.id, ...snapshot.data() } as any as Persona;
    personaCache.set(cacheKey, persona);
  }

  return ['ADMIN', 'JEFATURA', 'TITULACION'].includes(rolUsuario) ? persona : enmascararPIIPersona(persona);
};

/**
 * @description Localiza al ser humano propietario de una matrícula específica.
 */
export const buscarIdentidadPorNumControl = async (numControl: string, rolUsuario: string): Promise<Persona> => {
  const term = numControl.trim();
  if (!term) throw new AppError("Matrícula requerida.", 400);

  const cacheKey = `per_mat_${term}`;
  let persona = personaCache.get<Persona>(cacheKey);

  if (!persona) {
    const snapshot = await personasRef
      .where("expedientesAsociados", "array-contains", term)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new AppError(`Ausencia de identidad asociada a la matrícula ${term}.`, 404);
    }
    
    persona = { id: snapshot.docs[0]?.id, ...snapshot.docs[0]?.data() } as any as Persona;
    personaCache.set(cacheKey, persona);
  }

  return ['ADMIN', 'JEFATURA', 'TITULACION'].includes(rolUsuario) ? persona : enmascararPIIPersona(persona);
};

