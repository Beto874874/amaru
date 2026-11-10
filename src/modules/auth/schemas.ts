import { z } from '../../shared/zod.js';
import { textoRequerido } from '../../shared/validacion.js';

// Politica de contrasenas: 10..128. El maximo evita DoS por hashear entradas
// enormes; no se exigen simbolos obligatorios.
export const passwordSchema = z
  .string()
  .min(10, 'La contrasena debe tener al menos 10 caracteres')
  .max(128, 'La contrasena no puede superar 128 caracteres');

// El email se normaliza ANTES de cualquier consulta: la base lo exige.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'El correo es demasiado largo')
  .pipe(z.email({ message: 'El correo no tiene un formato valido' }));

export const nombreSchema = textoRequerido(100);

export const registroSchema = z.strictObject({
  nombre: nombreSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.strictObject({
  email: emailSchema,
  // En login no se aplica la politica completa: solo se comprueba que haya algo.
  password: z.string().min(1, 'La contrasena es obligatoria').max(128),
});

export const actualizarPerfilSchema = z.strictObject({
  nombre: nombreSchema,
});

export const cambiarPasswordSchema = z.strictObject({
  passwordActual: z.string().min(1, 'La contrasena actual es obligatoria').max(128),
  passwordNueva: passwordSchema,
});

export const usuarioPublicoSchema = z.strictObject({
  id: z.number().int().describe('Identificador del usuario'),
  nombre: z.string().describe('Nombre visible'),
  email: z.string().describe('Correo del usuario (solo el propio)'),
  rol: z.enum(['usuario', 'admin']).describe('Rol: usuario o admin'),
});

export const respuestaUsuarioSchema = z.strictObject({
  usuario: usuarioPublicoSchema,
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ActualizarPerfilInput = z.infer<typeof actualizarPerfilSchema>;
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;
export type UsuarioPublico = z.infer<typeof usuarioPublicoSchema>;
