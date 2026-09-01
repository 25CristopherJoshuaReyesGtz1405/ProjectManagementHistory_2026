/**
 * SISTEMA INTEGRAL DE GESTIÓN DE ARCHIVOS HISTÓRICOS (SIGAH)
 * Definición de Modelos de Datos (Interfaces TypeScript) - V4 (Optimizada HTTP)
 * Stack: Node.js (Express) + Firestore + Angular
 */

// ==========================================
// 1. TIPOS DE DATOS FIJOS (Enums/Types)
// ==========================================

export type RolUsuario = 'ADMIN' | 'JEFATURA' | 'TITULACION' | 'CAPTURISTA' | 'AUDITOR' | 'VENTANILLA';
export type NivelAcademico = 'BACHILLERATO' | 'LICENCIATURA' | 'MAESTRIA' | 'DOCTORADO';
export type EstatusExpediente = 'ACTIVO' | 'HISTORICO' | 'BAJA_DEFINITIVA' | 'TRANSITO';
export type EstadoConservacion = 'BUENO' | 'REGULAR' | 'MALO' | 'DETERIORADO' | 'INCOMPLETO';
export type EstatusPrestamo = 'ACTIVO' | 'VENCIDO' | 'DEVUELTO' | 'PRORROGA';

// ==========================================
// 2. METADATA COMÚN
// ==========================================
export interface MetadataRegistro {
  creadoPor: string;        // UID
  fechaCreacion: Date | string;
  modificadoPor?: string;   // UID
  fechaUltimaModificacion?: Date | string;
  version: number;          // Control de concurrencia
  firmaDigital?: string;    // Sello criptográfico para inalterabilidad
}

// ==========================================
// 3. COLECCIÓN: USUARIOS ('users')
// ==========================================
export interface Usuario {
  uid: string;              // ID de Firebase Auth
  email: string;            // Correo institucional
  nombreCompleto: string;
  rol: RolUsuario;
  departamento: string;     // Ej: "Titulación", "Ventanilla Sistemas"
  fechaCreacion: Date | string;
  activo: boolean;          // Soft delete para mantener historial
  ultimoAcceso?: Date | string;
}

// ==========================================
// 4. COLECCIÓN: PERSONAS ('personas') - Identidad Maestra
// ==========================================
export interface Persona {
  id: string;               // ID autogenerado de Firestore
  curp: string;             // Identificador principal (Unique) para unificar
  rfc?: string;
  nombre: string;
  primerApellido: string;
  segundoApellido?: string;
  fechaNacimiento?: Date | string;
  genero?: 'M' | 'F' | 'O';
  keywords: string[];       // Array normalizado para búsquedas rápidas (ej: ["juan", "perez"])
  
  // Arreglo de Números de Control asociados a esta persona (Dualidad Académica)
  expedientesAsociados: string[]; 
  
  metadata: MetadataRegistro;
}

// ==========================================
// 5. COLECCIÓN: EXPEDIENTES ('expedientes') - Vida Académica
// ==========================================
export interface Expediente {
  numControl: string;       // ID del Documento en Firestore (Ej: 22040000)
  personaId: string;        // FK a la colección 'personas'
  folioDigital: string;     // ID Lógico Humano
  
  // Datos Académicos
  nivel: NivelAcademico;
  carrera: string;        // FK al catálogo de carreras
  generacion: string;       // Ej: "2016-2020"
  modalidad?: 'PRESENCIAL' | 'DISTANCIA' | 'VIRTUAL';
  fechaEgreso?: Date | string;
  estatus: EstatusExpediente;

  keywords: string[];       // Array normalizado para búsquedas rápidas (ej: ["juan", "perez"])

  // Ubicación Física (Topografía)
  ubicacion: {
    edificio?: string;
    estante?: string;
    caja: string;
    carpeta: string;
    estadoConservacion: EstadoConservacion;
    observacionesFisicas?: string;
  };

  // Módulo de Titulación (Específico para Licenciatura/Posgrado)
  titulacion?: {
    tieneActaNacimiento: boolean;
    tieneCertificadoPreparatoria: boolean;
    tieneCertificadoLicenciatura: boolean;
    tieneTitulo: boolean;
    tieneCedula: boolean;
    inglesB1: boolean;
    actividadesComplementarias: boolean;
    servicioSocial: boolean;
    residenciaProfesional: boolean;
    fechaTitulacion?: Date | string;
  };

  // Archivos Digitalizados
  archivos: ArchivoAdjunto[];

  // Auditoría e Inalterabilidad 
  bloqueadoHistorico: boolean; // True si tiene > 5 años de egreso

  metadata: MetadataRegistro;
}

export interface ArchivoAdjunto {
  id: string;
  nombre: string;
  url: string;              // URL firmada de Firebase Storage
  fechaSubida: Date | string;
  tipo: 'ACTA' | 'CERTIFICADO' | 'TITULO' | 'BOLETA' | 'OTRO';
  subidoPor: string;        // UID del usuario que lo digitalizó
}

// ==========================================
// 6. SUB-COLECCIÓN: HISTÓRICO DE VERSIONES ('historico_cambios')
// ==========================================
export interface VersionHistorica {
  id: string;
  fechaModificacion: Date | string;
  modificadoPor: string;    // UID
  motivoCambio: string;     // Requerido por normativa para modificaciones de históricos
  snapshotAnterior: Partial<Expediente>; // El estado del documento antes del cambio
}

// ==========================================
// 7. COLECCIÓN: PRÉSTAMOS ('prestamos')
// ==========================================
export interface Prestamo {
  id: string;
  folioPrestamo: string;
  numControl: string;       // FK a Expediente
  personaId: string;        // FK a Persona
  
  idUsuarioSolicitante: string;
  nombreSolicitante: string;
  idUsuarioAutoriza: string; 
  
  fechaSalida: Date | string;
  fechaTentativaRegreso: Date | string;
  fechaRealRegreso?: Date | string;
  
  motivoId: string;         // FK a catálogo de motivos
  observacionesSalida?: string;
  observacionesRegreso?: string;
  estatus: EstatusPrestamo;
}

// ==========================================
// 8. COLECCIÓN: LOGS DE AUDITORÍA ('audit_logs')
// ==========================================
export interface LogAuditoria {
  id: string;
  fecha: Date | string;
  usuarioUid: string;
  accion: string;
  coleccionAfectada: string;
  documentoId: string;
  ipAddress: string;
  detalles: string; // JSON en formato texto con información adicional
}

// ==========================================
// 9. COLECCIÓN: CATÁLOGOS ('catalogos')
// ==========================================
export interface CatalogoItem {
  id: string;               // ID del documento
  clave: string;            // Ej: "ISC"
  nombre: string;           // Ej: "Ingeniería en Sistemas Computacionales"
  tipo: 'CARRERA' | 'MOTIVO_PRESTAMO' | 'EDIFICIO';
  activo: boolean;
}

// ==========================================
// 10. COLECCIÓN: ESTADÍSTICAS ('stats') Y DASHBOARD
// ==========================================
export interface EstadisticasDashboard {
  id?: string; // Ej: 'dashboard_general'
  totalExpedientes: number;
  totalExpedientesDigitalizados: number;
  totalPrestamosActivos: number;
  
  conteoPorNivel: {
    bachillerato: number;
    licenciatura: number;
    maestria: number;
    doctorado: number;
  };
  
  conteoPorEstadoFisico: Record<EstadoConservacion, number>;
  
  prestamos: {
    activos: number;
    vencidos: number;
    enEspera: number;
  };
  
  ultimaActualizacion: Date | string;
}

export interface StatsProductividad {
  id: 'productividad_global';
  registrosPorUsuario: {
    [uid: string]: {
      nombreUsuario: string;
      totalCapturas: number;
      ultimoRegistro: Date | string;
    }
  };
}

export interface ReporteGenerado {
  archivoUrl: string;
  fechaGeneracion: Date | string;
}

// ==========================================
// 11. RESPUESTAS HTTP, AUTH Y DTOs
// ==========================================

export interface PerfilUsuarioDTO {
  usuarioActual: Usuario;
  rol: Usuario['rol'];
  personaActual: Persona | null; 
}

export interface RespuestaApi<T = any> {
  status: string;
  message?: string;
  data?: T;
  jobId?: string; // Para tareas asíncronas
}

export interface RespuestaAuth {
  status: string;
  message?: string;
  token: string; 
  usuario: Usuario;
}

export interface TrustScore {
  solicitanteId: string;
  puntaje: number; 
  nivelConfianza: 'ALTO' | 'MEDIO' | 'BAJO' | 'RESTRINGIDO';
  prestamosActivos: number;
  historialVencidos: number;
}