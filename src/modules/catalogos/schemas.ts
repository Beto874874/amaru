import { z } from '../../shared/zod.js';
import { textoRequerido } from '../../shared/validacion.js';

// Nombres de catalogo: trim + no vacio + maximo 100.
export const nombreCatalogo = textoRequerido(100);

export const crearNombreSchema = z.strictObject({
  nombre: nombreCatalogo,
});

export const actualizarNombreSchema = z
  .strictObject({
    nombre: nombreCatalogo.optional(),
  })
  .refine((cambios) => cambios.nombre !== undefined, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

export const idCatalogoParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive(),
});

// GET /ciudades?departamento=<id> (parametro opcional).
export const listarCiudadesQuerySchema = z.strictObject({
  departamento: z.coerce.number().int().positive().optional(),
});

export const crearCiudadSchema = z.strictObject({
  nombre: nombreCatalogo,
  id_departamento: z.coerce.number().int().positive(),
});

export const actualizarCiudadSchema = z
  .strictObject({
    nombre: nombreCatalogo.optional(),
    id_departamento: z.coerce.number().int().positive().optional(),
  })
  .refine((cambios) => cambios.nombre !== undefined || cambios.id_departamento !== undefined, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

export interface DepartamentoDTO {
  id: number;
  nombre: string;
}

export interface CiudadDTO {
  id: number;
  nombre: string;
  id_departamento: number;
}

export interface TipoInmuebleDTO {
  id: number;
  nombre: string;
}

export type CrearNombreInput = z.infer<typeof crearNombreSchema>;
export type ActualizarNombreInput = z.infer<typeof actualizarNombreSchema>;
export type CrearCiudadInput = z.infer<typeof crearCiudadSchema>;
export type ActualizarCiudadInput = z.infer<typeof actualizarCiudadSchema>;
export type ListarCiudadesQuery = z.infer<typeof listarCiudadesQuerySchema>;
