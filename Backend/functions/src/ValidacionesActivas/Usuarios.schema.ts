import { z } from 'zod';

export const UsuarioSchema = z.object({
  email: z.string().email("Correo electrónico institucional no válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  nombre: z.string().min(3, "El nombre completo es obligatorio"),
  rol: z.enum(['ADMIN', 'JEFATURA', 'CAPTURISTA', 'AUDITOR', 'VENTANILLA'], {
    error: "El rol asignado no es válido para el sistema SIGAH"
  }),
  departamento: z.string().min(2, "El departamento es obligatorio")
}); // <-- Corrección: Cierre del objeto principal

export const UsuarioUpdateSchema = z.object({
  rol: z.enum(['ADMIN', 'JEFATURA', 'CAPTURISTA']).optional(),
  departamento: z.string().optional()
});