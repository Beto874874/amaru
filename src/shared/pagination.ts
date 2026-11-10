import { z } from 'zod';

// Parametros de paginacion reutilizables. Se exportan como objeto para poder
// esparcirlos en los esquemas de query de cada modulo:
//   z.strictObject({ ...paginacionCampos, estado: ... })
// (asi se evita depender del comportamiento de .extend() con objetos estrictos).
export const paginacionCampos = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const paginacionSchema = z.strictObject(paginacionCampos);

export type Paginacion = z.infer<typeof paginacionSchema>;

export interface MetaPaginacion {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function calcularOffset(paginacion: Paginacion): number {
  return (paginacion.page - 1) * paginacion.limit;
}

export function construirMeta(
  paginacion: Paginacion,
  total: number,
): MetaPaginacion {
  return {
    page: paginacion.page,
    limit: paginacion.limit,
    total,
    totalPages: Math.ceil(total / paginacion.limit),
  };
}

export interface RespuestaPaginada<T> {
  data: T[];
  meta: MetaPaginacion;
}
