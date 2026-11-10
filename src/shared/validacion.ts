import { z } from 'zod';

// Helpers de validacion compartidos.
// El CSV usa celdas vacias para "sin dato", asi que "" se trata como ausente
// (undefined) y, en los PATCH, null sirve para vaciar un campo opcional.

const recortar = (valor: unknown): unknown =>
  typeof valor === 'string' ? (valor.trim() === '' ? undefined : valor.trim()) : valor;

// Para campos opcionales de POST: null tambien cuenta como ausente (evita que
// z.coerce.number() convierta null en 0).
const ausenteSiNulo = (valor: unknown): unknown => recortar(valor === null ? undefined : valor);

/** Texto opcional: recorta espacios y convierte "" en undefined. */
export function textoOpcional(max: number) {
  return z.preprocess(recortar, z.string().max(max).optional());
}

/** Texto opcional que ademas acepta null para vaciar el campo en un PATCH. */
export function textoOpcionalNullable(max: number) {
  return z.preprocess(recortar, z.string().max(max).nullish());
}

/** Texto obligatorio: recorta espacios y exige al menos un caracter. */
export function textoRequerido(max: number) {
  return z.string().trim().min(1).max(max);
}

/** Entero opcional (query string o body). "" y null se tratan como ausentes. */
export function enteroOpcional(min: number, max?: number) {
  const base = z.coerce.number().int().min(min);
  return z.preprocess(ausenteSiNulo, (max === undefined ? base : base.max(max)).optional());
}

/** Numero (admite decimales) opcional. "" y null se tratan como ausentes. */
export function numeroOpcional(min: number, max?: number) {
  const base = z.coerce.number().min(min);
  return z.preprocess(ausenteSiNulo, (max === undefined ? base : base.max(max)).optional());
}

/** Entero opcional que acepta null para vaciar el campo en un PATCH. */
export function enteroOpcionalNullable(min: number, max?: number) {
  const base = z.coerce.number().int().min(min);
  return z.preprocess(recortar, (max === undefined ? base : base.max(max)).nullish());
}

/** Numero opcional que acepta null para vaciar el campo en un PATCH. */
export function numeroOpcionalNullable(min: number, max?: number) {
  const base = z.coerce.number().min(min);
  return z.preprocess(recortar, (max === undefined ? base : base.max(max)).nullish());
}

/** Booleano opcional: acepta true/false reales y las cadenas 'true'/'false'. */
export function booleanoOpcional() {
  return z.preprocess(
    recortar,
    z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
      .optional(),
  );
}

/** URL http/https opcional que acepta null para vaciarla en un PATCH. */
export function urlOpcionalNullable(max = 500) {
  return z.preprocess(recortar, z.url({ protocol: /^https?$/ }).max(max).nullish());
}

/**
 * Correo opcional que acepta null. Se normaliza a minusculas para que el
 * UNIQUE de contacto no considere distintos dos correos iguales con otra caja.
 */
export function correoOpcionalNullable(max = 254) {
  return z.preprocess(
    (valor) => {
      const limpio = recortar(valor);
      return typeof limpio === 'string' ? limpio.toLowerCase() : limpio;
    },
    z.email({ message: 'El correo no tiene un formato valido' }).max(max).nullish(),
  );
}
