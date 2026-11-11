import { z } from '../shared/zod.js';
import { registry } from './registry.js';

// ---------------------------------------------------------------------------
// Esquemas compartidos
// ---------------------------------------------------------------------------

const detalleSchema = z.strictObject({
  campo: z.string().describe('Nombre del campo que fallo'),
  mensaje: z.string().describe('Explicacion en espanol'),
  fila: z
    .number()
    .int()
    .optional()
    .describe('Numero de fila fisica del CSV (solo en la importacion masiva)'),
});

/** Formato unico de error de toda la API (seccion 7.2). */
export const errorSchema = registry.register(
  'Error',
  z.strictObject({
    error: z.strictObject({
      code: z
        .string()
        .describe('Codigo estable en MAYUSCULAS; el front decide con el, no con el mensaje'),
      message: z.string().describe('Mensaje en espanol para mostrar al usuario'),
      details: z.array(detalleSchema).optional().describe('Solo en errores de validacion'),
    }),
  }),
);

/** Igual que Error, pero `details` es obligatorio (errores de validacion). */
export const errorValidacionSchema = registry.register(
  'ErrorValidacion',
  z.strictObject({
    error: z.strictObject({
      code: z.string(),
      message: z.string(),
      details: z.array(detalleSchema),
    }),
  }),
);

export const paginacionMetaSchema = registry.register(
  'PaginacionMeta',
  z.strictObject({
    page: z.number().int().describe('Pagina actual (empieza en 1)'),
    limit: z.number().int().describe('Elementos por pagina (maximo 100)'),
    total: z.number().int().describe('Total de elementos que cumplen los filtros'),
    totalPages: z.number().int().describe('Total de paginas (techo de total / limit)'),
  }),
);

// ---------------------------------------------------------------------------
// Seguridad: los JWT viajan solo en cookies httpOnly
// ---------------------------------------------------------------------------

export const COOKIE_AUTH_REF = '#/components/securitySchemes/cookieAuth';

registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'access_token',
  description:
    'Sesion por cookies httpOnly. Hace login en /auth/login y el navegador guarda access_token ' +
    '(15 min) y refresh_token (7 dias, limitada a /api/v1/auth). El front debe enviar ' +
    "credentials: 'include' en cada peticion.",
});

// ---------------------------------------------------------------------------
// Respuestas de error reutilizables
// ---------------------------------------------------------------------------
// Se referencian los esquemas registrados (generados desde Zod) en lugar de
// duplicarlos. registerComponent('responses') solo acepta OpenAPI crudo, asi
// que se arman objetos ResponseConfig reutilizables en TypeScript.
const referenciaError = { $ref: '#/components/schemas/Error' };
const referenciaErrorValidacion = { $ref: '#/components/schemas/ErrorValidacion' };

export const respuestasError = {
  400: {
    description: 'Datos invalidos (body, query o params) o regla de negocio incumplida',
    content: { 'application/json': { schema: referenciaErrorValidacion } },
  },
  401: {
    description: 'No hay sesion valida, el token expiro o las credenciales son incorrectas',
    content: { 'application/json': { schema: referenciaError } },
  },
  403: {
    description: 'Sesion valida pero sin permiso para esta accion',
    content: { 'application/json': { schema: referenciaError } },
  },
  404: {
    description: 'El recurso no existe',
    content: { 'application/json': { schema: referenciaError } },
  },
  409: {
    description: 'Conflicto con datos existentes (duplicado, referencia en uso)',
    content: { 'application/json': { schema: referenciaError } },
  },
  413: {
    description: 'El cuerpo o el archivo supera el limite permitido',
    content: { 'application/json': { schema: referenciaError } },
  },
  422: {
    description: 'El lote no se proceso porque hay filas invalidas (politica todo o nada)',
    content: { 'application/json': { schema: referenciaErrorValidacion } },
  },
  429: {
    description: 'Demasiadas peticiones desde esta IP en la ventana de tiempo',
    content: { 'application/json': { schema: referenciaError } },
  },
  500: {
    description: 'Error inesperado del servidor (el detalle solo queda en los logs)',
    content: { 'application/json': { schema: referenciaError } },
  },
} as const;
