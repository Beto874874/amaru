import { paginacionMetaSchema, respuestasError } from '../../docs/components.js';
import { registry } from '../../docs/registry.js';
import { z } from '../../shared/zod.js';
import {
  actualizarContactoSchema,
  contactoPublicoSchema,
  crearContactoSchema,
  listarContactosSchema,
} from './schemas.js';

const contactoRegistrado = registry.register('ContactoConId', contactoPublicoSchema);

const respuestaContactoSchema = registry.register(
  'RespuestaContacto',
  z.strictObject({ contacto: contactoRegistrado }),
);

const respuestaListaContactosSchema = registry.register(
  'RespuestaListaContactos',
  z.strictObject({
    data: z.array(contactoRegistrado),
    meta: paginacionMetaSchema,
  }),
);

const paramsId = z.strictObject({ id: z.coerce.number().int().positive() });

const EJEMPLO_CONTACTO = {
  id: 97,
  nombre: 'Inmobiliaria Los Andes',
  telefono: '+57 601 555 0123',
  direccion: 'Calle 10 # 20-30, Bogota',
  correo: 'contacto@losandes.example',
};

registry.registerPath({
  method: 'get',
  path: '/contactos',
  tags: ['Contactos'],
  summary: 'Lista contactos con busqueda por nombre',
  description:
    'Requiere sesion. Lista paginada ordenada por nombre. `q` busca de forma parcial (ILIKE) ' +
    'sobre el nombre escapando los comodines del usuario.',
  security: [{ cookieAuth: [] }],
  request: { query: listarContactosSchema },
  responses: {
    200: {
      description: 'Lista paginada de contactos',
      content: {
        'application/json': {
          schema: respuestaListaContactosSchema,
          example: {
            data: [EJEMPLO_CONTACTO],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        },
      },
    },
    400: respuestasError[400],
    401: respuestasError[401],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'get',
  path: '/contactos/{id}',
  tags: ['Contactos'],
  summary: 'Obtiene un contacto',
  description: 'Requiere sesion. 404 `CONTACTO_NO_ENCONTRADO` si no existe.',
  security: [{ cookieAuth: [] }],
  request: { params: paramsId },
  responses: {
    200: {
      description: 'Contacto encontrado',
      content: {
        'application/json': {
          schema: respuestaContactoSchema,
          example: { contacto: EJEMPLO_CONTACTO },
        },
      },
    },
    400: respuestasError[400],
    401: respuestasError[401],
    404: respuestasError[404],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/contactos',
  tags: ['Contactos'],
  summary: 'Crea o reutiliza un contacto',
  description:
    'Requiere sesion. Busca un contacto con los MISMOS cuatro valores (NULL = NULL, igual que ' +
    'el UNIQUE `NULLS NOT DISTINCT`); si no existe lo crea. Responde **201** con el contacto ' +
    'nuevo y **200** si ya existia. El correo se normaliza a minusculas.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: crearContactoSchema,
          example: {
            nombre: EJEMPLO_CONTACTO.nombre,
            telefono: EJEMPLO_CONTACTO.telefono,
            direccion: EJEMPLO_CONTACTO.direccion,
            correo: EJEMPLO_CONTACTO.correo,
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Contacto creado',
      content: {
        'application/json': {
          schema: respuestaContactoSchema,
          example: { contacto: EJEMPLO_CONTACTO },
        },
      },
    },
    200: {
      description: 'El contacto ya existia; se devuelve el mismo',
      content: {
        'application/json': {
          schema: respuestaContactoSchema,
          example: { contacto: EJEMPLO_CONTACTO },
        },
      },
    },
    400: respuestasError[400],
    401: respuestasError[401],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/contactos/{id}',
  tags: ['Contactos'],
  summary: 'Actualiza un contacto (solo admin)',
  description:
    'Solo admin. Un contacto lo comparten muchos inmuebles: al editarlo cambia en todos. Los ' +
    'campos opcionales se vacian con `null`. Si el resultado coincide con otro contacto ' +
    'existente responde 409 `CONTACTO_DUPLICADO`.',
  security: [{ cookieAuth: [] }],
  request: {
    params: paramsId,
    body: {
      content: {
        'application/json': {
          schema: actualizarContactoSchema,
          example: { telefono: '+57 601 555 9999' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contacto actualizado',
      content: {
        'application/json': {
          schema: respuestaContactoSchema,
          example: {
            contacto: { ...EJEMPLO_CONTACTO, telefono: '+57 601 555 9999' },
          },
        },
      },
    },
    400: respuestasError[400],
    401: respuestasError[401],
    403: respuestasError[403],
    404: respuestasError[404],
    409: respuestasError[409],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/contactos/{id}',
  tags: ['Contactos'],
  summary: 'Elimina un contacto (solo admin)',
  description:
    'Solo admin. Si algun inmueble lo usa responde 409 `REFERENCIA_INVALIDA` (lo garantiza la ' +
    'FK). 204 sin cuerpo.',
  security: [{ cookieAuth: [] }],
  request: { params: paramsId },
  responses: {
    204: { description: 'Contacto eliminado' },
    400: respuestasError[400],
    401: respuestasError[401],
    403: respuestasError[403],
    404: respuestasError[404],
    409: respuestasError[409],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});
