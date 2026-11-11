import { imagenPrincipalSchema, imagenPublicaSchema } from '../imagenes/schemas.js';
import { paginacionCampos } from '../../shared/pagination.js';
import {
  booleanoOpcional,
  correoOpcionalNullable,
  enteroOpcional,
  enteroOpcionalNullable,
  numeroOpcional,
  numeroOpcionalNullable,
  textoOpcional,
  textoOpcionalNullable,
  textoRequerido,
  urlOpcionalNullable,
} from '../../shared/validacion.js';
import { z } from '../../shared/zod.js';

export const ESTADOS_INMUEBLE = ['Disponible', 'Arrendado', 'No disponible'] as const;
export const estadoInmuebleSchema = z.enum(ESTADOS_INMUEBLE);
export type EstadoInmueble = z.infer<typeof estadoInmuebleSchema>;

export const ORDEN_POR_CAMPOS = [
  'valor_arriendo',
  'fecha_publicacion',
  'area_construida',
] as const;

// ---------------------------------------------------------------------------
// Entrada: mismo formato que el CSV (9.2)
// ---------------------------------------------------------------------------

/**
 * POST /inmuebles. `strictObject` RECHAZA con 400 los campos controlados por el
 * servidor (id_inmueble, id_usuario, fecha_publicacion, created_at, updated_at,
 * ubicacion_inferida, alertas), tal como exige la guia.
 */
export const crearInmuebleSchema = z.strictObject({
  codigo_sae: textoRequerido(50).describe('Codigo unico del inmueble en el sistema SAE'),
  tipo_inmueble: textoRequerido(100).describe('Nombre exacto del tipo en el catalogo'),
  departamento: textoRequerido(100).describe('Nombre exacto del departamento en el catalogo'),
  direccion: textoRequerido(200),
  nombre_inmueble: textoOpcional(200).describe(
    'Si falta se genera "<tipo_inmueble> - <codigo_sae>"',
  ),
  ciudad: textoOpcional(100).describe('Nombre de la ciudad dentro del departamento'),
  estrato: enteroOpcional(1, 6),
  valor_arriendo: enteroOpcional(1).describe('Valor mensual en pesos colombianos'),
  area_terreno: numeroOpcional(0),
  area_construida: numeroOpcional(0),
  mas_admon: z.boolean().default(false).describe('Valor incluye administracion'),
  en_home: z.boolean().default(false),
  iva: z.boolean().default(false),
  pagina_web: urlOpcionalNullable(),
  estado_inmueble: estadoInmuebleSchema.default('Disponible'),
  nombre_contacto: textoOpcional(150).describe('Si viene, el contacto se busca o se crea'),
  telefono_contacto: textoOpcional(50),
  direccion_contacto: textoOpcional(200),
  correo_contacto: correoOpcionalNullable(),
  matricula_inmobiliaria: textoOpcional(50).describe(
    'Se acepta por compatibilidad con el CSV, pero el servidor lo ignora',
  ),
});

/**
 * PATCH /inmuebles/:id. Todos los campos son opcionales. Los opcionales de la
 * base aceptan null para vaciarlos; los NOT NULL de la base no.
 */
const actualizarInmuebleCampos = z.strictObject({
  codigo_sae: textoOpcional(50),
  tipo_inmueble: textoOpcional(100),
  departamento: textoOpcional(100),
  direccion: textoOpcional(200),
  nombre_inmueble: textoOpcional(200),
  ciudad: textoOpcionalNullable(100),
  estrato: enteroOpcionalNullable(1, 6),
  valor_arriendo: enteroOpcionalNullable(1),
  area_terreno: numeroOpcionalNullable(0),
  area_construida: numeroOpcionalNullable(0),
  mas_admon: z.boolean().optional(),
  en_home: z.boolean().optional(),
  iva: z.boolean().optional(),
  pagina_web: urlOpcionalNullable(),
  estado_inmueble: estadoInmuebleSchema.optional(),
  nombre_contacto: textoOpcionalNullable(150),
  telefono_contacto: textoOpcionalNullable(50),
  direccion_contacto: textoOpcionalNullable(200),
  correo_contacto: correoOpcionalNullable(),
  matricula_inmobiliaria: textoOpcional(50),
});

export const actualizarInmuebleSchema = actualizarInmuebleCampos.refine(
  (cambios) => Object.values(cambios).some((valor) => valor !== undefined),
  { message: 'Debes enviar al menos un campo para actualizar' },
);

// ---------------------------------------------------------------------------
// Entrada: lista paginada y filtrada (9.8)
// ---------------------------------------------------------------------------

export const listarInmueblesBaseSchema = z.strictObject({
  ...paginacionCampos,
  // Se documenta y usa el ID (no el nombre) para evitar ambiguedades.
  departamento: enteroOpcional(1).describe('ID del departamento'),
  ciudad: enteroOpcional(1).describe('ID de la ciudad'),
  tipo: enteroOpcional(1).describe('ID del tipo de inmueble'),
  estrato: enteroOpcional(1, 6),
  valor_min: enteroOpcional(1),
  valor_max: enteroOpcional(1),
  area_min: numeroOpcional(0).describe('Sobre area_construida'),
  area_max: numeroOpcional(0).describe('Sobre area_construida'),
  estado: estadoInmuebleSchema.default('Disponible'),
  q: textoOpcional(100).describe('Texto en nombre_inmueble y direccion (ILIKE)'),
  mias: booleanoOpcional().describe('Solo los del usuario autenticado; exige sesion'),
  sort: z.enum(ORDEN_POR_CAMPOS).default('fecha_publicacion'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const listarInmueblesSchema = listarInmueblesBaseSchema
  .refine(
    (q) => q.valor_min === undefined || q.valor_max === undefined || q.valor_min <= q.valor_max,
    { message: 'valor_min no puede ser mayor que valor_max', path: ['valor_min'] },
  )
  .refine(
    (q) => q.area_min === undefined || q.area_max === undefined || q.area_min <= q.area_max,
    { message: 'area_min no puede ser mayor que area_max', path: ['area_min'] },
  );

export const idInmuebleParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Salida publica (9.7). Nunca incluye id_usuario ni datos del dueno.
// ---------------------------------------------------------------------------

export const contactoSchema = z.strictObject({
  nombre: z.string(),
  telefono: z.string().nullable(),
  direccion: z.string().nullable(),
  correo: z.string().nullable(),
});

export const inmueblePublicoSchema = z.strictObject({
  id: z.number().int(),
  codigo_sae: z.string(),
  nombre: z.string(),
  tipo: z.string(),
  departamento: z.string(),
  ciudad: z.string().nullable(),
  direccion: z.string(),
  estrato: z.number().int().nullable(),
  valor_arriendo: z.number().int().nullable(),
  area_terreno: z.number().nullable(),
  area_construida: z.number().nullable(),
  mas_admon: z.boolean(),
  en_home: z.boolean(),
  iva: z.boolean(),
  pagina_web: z.string().nullable(),
  estado: estadoInmuebleSchema,
  ubicacion_inferida: z.boolean(),
  alertas: z.array(z.string()),
  fecha_publicacion: z.string().describe('ISO 8601 en UTC'),
  contacto: contactoSchema.nullable(),
  publicado_por_usuario: z
    .boolean()
    .describe('false = inmueble importado del CSV, sin dueno'),
  es_mio: z.boolean().describe('true si el solicitante autenticado es el dueno'),
  // Listados y tarjetas: null si el inmueble no tiene fotos.
  imagen_principal: imagenPrincipalSchema
    .nullable()
    .describe('Foto de la tarjeta; null si el inmueble no tiene fotos'),
});

// El arreglo completo de fotos SOLO va en el detalle (peso en listados).
export const inmuebleDetalleSchema = inmueblePublicoSchema.extend({
  imagenes: z.array(imagenPublicaSchema).describe('Fotos ordenadas por orden y luego id'),
});

export type CrearInmuebleInput = z.infer<typeof crearInmuebleSchema>;
export type ActualizarInmuebleInput = z.infer<typeof actualizarInmuebleSchema>;
export type ListarInmueblesQuery = z.infer<typeof listarInmueblesSchema>;
export type ContactoDTO = z.infer<typeof contactoSchema>;
export type InmueblePublico = z.infer<typeof inmueblePublicoSchema>;
export type InmuebleDetalle = z.infer<typeof inmuebleDetalleSchema>;
