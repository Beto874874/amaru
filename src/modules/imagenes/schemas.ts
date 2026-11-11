import { z } from '../../shared/zod.js';

// Limites cerrados de la guia (1.6). Se exportan para no repetirlos en el
// middleware, el service y el repository.
export const MAX_IMAGENES_POR_PETICION = 5;
export const MAX_IMAGENES_POR_INMUEBLE = 10;

/** Parametros de las rutas montadas bajo /inmuebles/:id/imagenes. */
export const idInmuebleParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive(),
});

export const idImagenParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive(),
  idImagen: z.coerce.number().int().positive(),
});

/**
 * PATCH /inmuebles/:id/imagenes/:idImagen. Al menos un campo.
 * `es_principal` solo acepta true: para quitar la principal se elige otra.
 */
const actualizarImagenCampos = z.strictObject({
  es_principal: z.literal(true).optional(),
  orden: z.coerce.number().int().min(0).optional(),
});

export const actualizarImagenSchema = actualizarImagenCampos.refine(
  (cambios) => cambios.es_principal !== undefined || cambios.orden !== undefined,
  { message: 'Debes enviar es_principal: true o un orden' },
);

// ---------------------------------------------------------------------------
// Salida publica (7.3). Nunca se exponen rutas internas ni id_inmueble.
// ---------------------------------------------------------------------------

export const imagenPrincipalSchema = z.strictObject({
  url: z.string().describe('URL publica de la imagen grande'),
  miniatura_url: z.string().describe('URL publica de la miniatura para listados'),
});

export const imagenPublicaSchema = z.strictObject({
  id: z.number().int(),
  url: z.string().describe('URL publica de la imagen grande (detalle)'),
  miniatura_url: z.string().describe('URL publica de la miniatura (listados)'),
  ancho: z.number().int(),
  alto: z.number().int(),
  orden: z.number().int(),
  es_principal: z.boolean(),
});

export type ActualizarImagenInput = z.infer<typeof actualizarImagenSchema>;
export type ImagenPrincipal = z.infer<typeof imagenPrincipalSchema>;
export type ImagenPublica = z.infer<typeof imagenPublicaSchema>;
