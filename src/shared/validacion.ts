import { z } from 'zod';

// Helpers de validacion compartidos.
// El CSV usa celdas vacias para "sin dato", asi que "" se trata como ausente
// (undefined) y, en los PATCH, null sirve para vaciar un campo opcional.

const normalizarTexto = (valor: unknown): unknown =>
  typeof valor === 'string' ? (valor.trim() === '' ? undefined : valor.trim()) : valor;

/** Texto opcional: recorta espacios y convierte "" en undefined. */
export function textoOpcional(max: number) {
  return z.preprocess(normalizarTexto, z.string().max(max).optional());
}

/** Texto opcional que ademas acepta null para vaciar el campo en un PATCH. */
export function textoOpcionalNullable(max: number) {
  return z.preprocess(normalizarTexto, z.string().max(max).nullish());
}

/** Texto obligatorio: recorta espacios y exige al menos un caracter. */
export function textoRequerido(max: number) {
  return z.string().trim().min(1).max(max);
}

/** Entero opcional (query string o body). "" se trata como ausente. */
export function enteroOpcional(min: number, max?: number) {
  const base = z.coerce.number().int().min(min);
  return z.preprocess(normalizarTexto, (max === undefined ? base : base.max(max)).optional());
}

/** Booleano opcional: acepta true/false reales y las cadenas 'true'/'false'. */
export function booleanoOpcional() {
  return z.preprocess(
    normalizarTexto,
    z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
      .optional(),
  );
}
