import { paginacionCampos } from '../../shared/pagination.js';
import {
  correoOpcionalNullable,
  textoOpcional,
  textoOpcionalNullable,
  textoRequerido,
} from '../../shared/validacion.js';
import { z } from '../../shared/zod.js';

// Un contacto es compartido por muchos inmuebles; por eso solo un admin lo
// edita o elimina. El nombre es obligatorio; el resto puede ser null.
export const crearContactoSchema = z.strictObject({
  nombre: textoRequerido(150),
  telefono: textoOpcionalNullable(50),
  direccion: textoOpcionalNullable(200),
  correo: correoOpcionalNullable(),
});

export const actualizarContactoSchema = z
  .strictObject({
    nombre: textoOpcional(150),
    telefono: textoOpcionalNullable(50),
    direccion: textoOpcionalNullable(200),
    correo: correoOpcionalNullable(),
  })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    message: 'Debes enviar al menos un campo para actualizar',
  });

export const listarContactosSchema = z.strictObject({
  ...paginacionCampos,
  q: textoOpcional(150).describe('Busqueda parcial por nombre (ILIKE)'),
});

export const idContactoParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive(),
});

export const contactoPublicoSchema = z.strictObject({
  id: z.number().int(),
  nombre: z.string(),
  telefono: z.string().nullable(),
  direccion: z.string().nullable(),
  correo: z.string().nullable(),
});

export type CrearContactoInput = z.infer<typeof crearContactoSchema>;
export type ActualizarContactoInput = z.infer<typeof actualizarContactoSchema>;
export type ListarContactosQuery = z.infer<typeof listarContactosSchema>;
export type ContactoPublico = z.infer<typeof contactoPublicoSchema>;
