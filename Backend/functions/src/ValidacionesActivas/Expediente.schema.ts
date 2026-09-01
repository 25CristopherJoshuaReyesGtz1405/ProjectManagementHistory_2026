import { z } from "zod";
import type { NivelAcademico } from "../ModelosAplicacion/ModelosAplicacion.model.js";

const NIVELES = [
  "BACHILLERATO",
  "LICENCIATURA",
  "MAESTRIA",
  "DOCTORADO",
] as const;

export const ExpedienteSchema = z.object({
  numControl: z.string().min(8).max(10),
  personaId: z.string().min(1),
  carrera: z.string().min(5),
  ubicacion: z.object({
    edificio: z.string(),
    estante: z.string(),
    caja: z.string(),
    carpeta: z.string(),
  }),

  folioDigital: z.string().min(10).max(20), // ID Lógico Humano

  // Datos Académicos
  nivel: z.string().refine((val) => NIVELES.includes(val as NivelAcademico), {
    message: `Nivel académico inválido. Debe ser uno de: ${NIVELES.join(", ")}`,
  }),
  modalidad: z.enum(["PRESENCIAL", "DISTANCIA", "VIRTUAL"]),
  fechaEgreso: z.union([z.date(), z.string().datetime()]),
  estatus: z.enum(["ACTIVO", "BAJA_DEFINITIVA", "SUSPENDIDO"]),

  keywords: z.array(z.string()), // Array normalizado para búsquedas rápidas (ej: ["juan", "perez"])

  // Módulo de Titulación (Específico para Licenciatura/Posgrado)
  titulacion: {
    tieneActaNacimiento: z.boolean(),
    tieneCertificadoPreparatoria: z.boolean(),
    tieneCertificadoLicenciatura: z.boolean(),
    tieneTitulo: z.boolean(),
    tieneCedula: z.boolean(),
    inglesB1: z.boolean(),
    actividadesComplementarias: z.boolean(),
    servicioSocial: z.boolean(),
    residenciaProfesional: z.boolean(),
    fechaTitulacion: z.union([z.date(), z.string().datetime()]),
  },

  // Archivos Digitalizados
  archivos: z.array(z.any()), // Array de objetos de archivo adjunto

  // Auditoría e Inalterabilidad
  bloqueadoHistorico: z.boolean(), // True si tiene > 5 años de egreso

  metadata: z.any(), // Objeto de metadatos del registro
});
