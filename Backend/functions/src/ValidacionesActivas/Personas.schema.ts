import { z } from 'zod';

export const PersonaSchema = z.object({

  id: z.string().uuid(),
    curp: z.string().length(18, "La CURP debe tener 18 caracteres"),
    rfc: z.string().length(13, "El RFC debe tener 13 caracteres").optional(),
    nombre: z.string().min(2, "Nombre demasiado corto"),
    primerApellido: z.string().min(2, "El primer apellido es obligatorio"),
    segundoApellido: z.string().optional(),
    fechaNacimiento: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Fecha de nacimiento inválida",
    }),
    genero: z.enum(["M", "F", "O"]).optional(),
    keywords: z.array(z.string()).min(1, "Al menos una palabra clave es obligatoria"),
    
    // Arreglo de Números de Control asociados a esta persona (Dualidad Académica)
    expedientesAsociados: z.array(z.string().uuid()), 
    
    metadata: z.any().optional(), // Información adicional que puede ser útil para la aplicación, pero no es crítica para la validación de la person
  })
