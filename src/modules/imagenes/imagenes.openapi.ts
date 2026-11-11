import { respuestasError } from '../../docs/components.js';
import { registry } from '../../docs/registry.js';
import { z } from '../../shared/zod.js';
import { actualizarImagenSchema, imagenPrincipalSchema, imagenPublicaSchema } from './schemas.js';

// Esquemas publicos. La URL se calcula al responder; las rutas internas y el
// id_inmueble nunca salen del backend.
const imagenRegistrada = registry.register('ImagenPublica', imagenPublicaSchema);
registry.register('ImagenPrincipal', imagenPrincipalSchema);

const respuestaImagenSchema = registry.register(
  'RespuestaImagen',
  z.strictObject({ imagen: imagenRegistrada }),
);

const respuestaImagenesSchema = registry.register(
  'RespuestaImagenes',
  z.strictObject({ data: z.array(imagenRegistrada) }),
);

const EJEMPLO_IMAGEN = {
  id: 12,
  url: 'https://<ref>.supabase.co/storage/v1/object/public/inmuebles/inmuebles/98635/2f7c1c0e-5f0a-4b7e-9c1d-3a8f6e2b9d41.webp',
  miniatura_url:
    'https://<ref>.supabase.co/storage/v1/object/public/inmuebles/inmuebles/98635/2f7c1c0e-5f0a-4b7e-9c1d-3a8f6e2b9d41_m.webp',
  ancho: 1600,
  alto: 900,
  orden: 0,
  es_principal: true,
};

// El body multipart no se puede derivar de un esquema Zod de validacion porque
// los archivos llegan como binarios; se declara en OpenAPI crudo (igual que el
// CSV de importacion).
const cuerpoImagenes = {
  type: 'object' as const,
  required: ['imagenes'],
  properties: {
    imagenes: {
      type: 'array' as const,
      minItems: 1,
      maxItems: 5,
      items: { type: 'string' as const, format: 'binary' },
      description:
        'De 1 a 5 archivos JPEG, PNG o WebP de maximo 10 MB cada uno. El servidor los re-codifica a WebP.',
    },
  },
};

const paramsInmueble = z.strictObject({ id: z.coerce.number().int().positive() });
const paramsImagen = z.strictObject({
  id: z.coerce.number().int().positive(),
  idImagen: z.coerce.number().int().positive(),
});

registry.registerPath({
  method: 'post',
  path: '/inmuebles/{id}/imagenes',
  tags: ['Imagenes'],
  summary: 'Sube fotos a un inmueble',
  description:
    'Requiere sesion. Solo el dueno del inmueble o un admin puede subir fotos; los inmuebles ' +
    'importados del CSV (sin dueno) solo los toca un admin. Recibe `multipart/form-data` en el ' +
    'campo `imagenes` (1 a 5 archivos JPEG/PNG/WebP de maximo 10 MB cada uno). Cada foto se ' +
    'procesa en memoria y se guarda como dos WebP: grande (max 1600 px de ancho) y miniatura ' +
    '(max 480 px). La validacion es por **contenido real**, no por extension ni por el ' +
    'Content-Type declarado. La operacion es **todo o nada**: si un archivo falla no se sube ' +
    'ninguno. Maximo 10 fotos por inmueble. La primera foto de un inmueble sin fotos queda como ' +
    'principal.',
  security: [{ cookieAuth: [] }],
  request: {
    params: paramsInmueble,
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: cuerpoImagenes,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Fotos creadas (ordenadas por `orden` y luego por `id`)',
      content: {
        'application/json': {
          schema: respuestaImagenesSchema,
          example: { data: [EJEMPLO_IMAGEN] },
        },
      },
    },
    400: respuestasError[400],
    401: respuestasError[401],
    403: respuestasError[403],
    404: respuestasError[404],
    409: respuestasError[409],
    413: respuestasError[413],
    429: respuestasError[429],
    500: respuestasError[500],
    502: respuestasError[502],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/inmuebles/{id}/imagenes/{idImagen}',
  tags: ['Imagenes'],
  summary: 'Cambia la foto principal o su orden',
  description:
    'Requiere sesion y la misma regla de propiedad que editar el inmueble. Al menos uno de ' +
    '`es_principal` u `orden` es obligatorio. `es_principal` solo acepta `true`: para quitar la ' +
    'principal hay que marcar otra foto. `orden` es el valor final deseado (no tiene que ser ' +
    'consecutivo). Si la imagen no pertenece a ese inmueble responde 404 ' +
    '`IMAGEN_NO_ENCONTRADA` (no revela que exista en otro inmueble).',
  security: [{ cookieAuth: [] }],
  request: {
    params: paramsImagen,
    body: {
      content: {
        'application/json': {
          schema: actualizarImagenSchema,
          example: { es_principal: true, orden: 0 },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Imagen actualizada',
      content: {
        'application/json': {
          schema: respuestaImagenSchema,
          example: { imagen: EJEMPLO_IMAGEN },
        },
      },
    },
    400: respuestasError[400],
    401: respuestasError[401],
    403: respuestasError[403],
    404: respuestasError[404],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/inmuebles/{id}/imagenes/{idImagen}',
  tags: ['Imagenes'],
  summary: 'Elimina una foto de un inmueble',
  description:
    'Requiere sesion y la misma regla de propiedad que editar el inmueble. Borra la fila y los ' +
    'dos archivos de Storage (grande y miniatura). Si la foto era la principal y quedan mas, el ' +
    'servidor promueve la de menor `orden` (desempate por `id`). Responde 204 sin cuerpo.',
  security: [{ cookieAuth: [] }],
  request: { params: paramsImagen },
  responses: {
    204: { description: 'Imagen eliminada' },
    400: respuestasError[400],
    401: respuestasError[401],
    403: respuestasError[403],
    404: respuestasError[404],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});
