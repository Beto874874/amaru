import { respuestasError } from '../../docs/components.js';
import { registry } from '../../docs/registry.js';
import { z } from '../../shared/zod.js';

const respuestaImportacionSchema = registry.register(
  'RespuestaImportacion',
  z.strictObject({
    insertados: z.number().int().describe('Cantidad de inmuebles insertados'),
    omitidos: z
      .number()
      .int()
      .describe('Siempre 0: la importacion es todo o nada, no se omite ninguna fila'),
  }),
);

// El body multipart no se puede derivar de un esquema Zod de validacion porque
// el archivo llega como binario; se declara en OpenAPI crudo.
const cuerpoCsv = {
  type: 'object' as const,
  required: ['archivo'],
  properties: {
    archivo: {
      type: 'string' as const,
      format: 'binary',
      description:
        'Archivo CSV UTF-8 de maximo 5 MB con la cabecera del formato original (23 columnas)',
    },
  },
};

registry.registerPath({
  method: 'post',
  path: '/importacion/inmuebles',
  tags: ['Importacion'],
  summary: 'Importa inmuebles desde un CSV (solo admin)',
  description:
    'Solo admin. Recibe `multipart/form-data` en el campo `archivo` (CSV UTF-8, maximo 5 MB). ' +
    'Valida TODAS las filas con el mismo esquema del POST normal y respeta la politica **todo o ' +
    'nada**: si una fila falla no se inserta ninguna y responde 422 con hasta 100 detalles ' +
    '`{ fila, campo, mensaje }`. Un `codigo_sae` repetido en el archivo o ya existente en la ' +
    'base cuenta como error de esa fila. Si todo es valido inserta en una sola transaccion, por ' +
    'lotes de 200, y deja `id_usuario` del admin que importo. Las columnas `id_categoria` y ' +
    '`matricula_inmobiliaria` se ignoran. `fecha_publicacion` llega en hora de Colombia ' +
    '(`America/Bogota`, UTC-5) y se guarda como instante UTC; `alertas` viene separado por `;`.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: cuerpoCsv,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Archivo valido: todos los inmuebles fueron insertados',
      content: {
        'application/json': {
          schema: respuestaImportacionSchema,
          example: { insertados: 1365, omitidos: 0 },
        },
      },
    },
    400: respuestasError[400],
    401: respuestasError[401],
    403: respuestasError[403],
    413: respuestasError[413],
    422: respuestasError[422],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});
