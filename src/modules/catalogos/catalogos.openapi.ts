import { respuestasError } from '../../docs/components.js';
import { registry } from '../../docs/registry.js';
import { z } from '../../shared/zod.js';
import {
  actualizarCiudadSchema,
  actualizarNombreSchema,
  crearCiudadSchema,
  crearNombreSchema,
  listarCiudadesQuerySchema,
} from './schemas.js';

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------

const departamentoSchema = registry.register(
  'Departamento',
  z.strictObject({ id: z.number().int(), nombre: z.string() }),
);

const ciudadSchema = registry.register(
  'Ciudad',
  z.strictObject({
    id: z.number().int(),
    nombre: z.string(),
    id_departamento: z.number().int(),
  }),
);

const tipoInmuebleSchema = registry.register(
  'TipoInmueble',
  z.strictObject({ id: z.number().int(), nombre: z.string() }),
);

const listaDepartamentosSchema = registry.register(
  'ListaDepartamentos',
  z.strictObject({ data: z.array(departamentoSchema) }),
);

const listaCiudadesSchema = registry.register(
  'ListaCiudades',
  z.strictObject({ data: z.array(ciudadSchema) }),
);

const listaTiposSchema = registry.register(
  'ListaTiposInmueble',
  z.strictObject({ data: z.array(tipoInmuebleSchema) }),
);

const respuestaDepartamentoSchema = registry.register(
  'RespuestaDepartamento',
  z.strictObject({ departamento: departamentoSchema }),
);

const respuestaCiudadSchema = registry.register(
  'RespuestaCiudad',
  z.strictObject({ ciudad: ciudadSchema }),
);

const respuestaTipoSchema = registry.register(
  'RespuestaTipoInmueble',
  z.strictObject({ tipo: tipoInmuebleSchema }),
);

const paramsId = z.strictObject({ id: z.coerce.number().int().positive() });

const EJEMPLO_DEPARTAMENTO = { id: 17, nombre: 'Risaralda' };
const EJEMPLO_CIUDAD = { id: 1, nombre: 'Pereira', id_departamento: 17 };
const EJEMPLO_TIPO = { id: 1, nombre: 'Apartamento' };

const erroresComunes = {
  400: respuestasError[400],
  401: respuestasError[401],
  403: respuestasError[403],
  404: respuestasError[404],
  409: respuestasError[409],
  429: respuestasError[429],
  500: respuestasError[500],
} as const;

const cabeceraCache = {
  'Cache-Control': {
    description: 'Cache publico corto (max-age=300): los catalogos casi no cambian.',
    schema: { type: 'string' as const },
  },
};

// ---------------------------------------------------------------------------
// Departamentos
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/departamentos',
  tags: ['Catalogos'],
  summary: 'Lista los departamentos ordenados por nombre',
  description: 'Publico. Devuelve el catalogo completo (26 departamentos) con cache publico corto.',
  security: [],
  responses: {
    200: {
      description: 'Departamentos ordenados por nombre',
      headers: cabeceraCache,
      content: {
        'application/json': {
          schema: listaDepartamentosSchema,
          example: { data: [EJEMPLO_DEPARTAMENTO] },
        },
      },
    },
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/departamentos',
  tags: ['Catalogos'],
  summary: 'Crea un departamento (solo admin)',
  description: 'Nombre con trim y no vacio. Si ya existe responde 409.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: crearNombreSchema,
          example: { nombre: 'Caldas' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Departamento creado',
      content: {
        'application/json': {
          schema: respuestaDepartamentoSchema,
          example: { departamento: { id: 33, nombre: 'Caldas' } },
        },
      },
    },
    ...erroresComunes,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/departamentos/{id}',
  tags: ['Catalogos'],
  summary: 'Renombra un departamento (solo admin)',
  description: 'Un nombre repetido responde 409. No permite enviar el body vacio.',
  security: [{ cookieAuth: [] }],
  request: {
    params: paramsId,
    body: {
      content: {
        'application/json': {
          schema: actualizarNombreSchema,
          example: { nombre: 'Risaralda' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Departamento actualizado',
      content: {
        'application/json': {
          schema: respuestaDepartamentoSchema,
          example: { departamento: EJEMPLO_DEPARTAMENTO },
        },
      },
    },
    ...erroresComunes,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/departamentos/{id}',
  tags: ['Catalogos'],
  summary: 'Elimina un departamento (solo admin)',
  description:
    'Si tiene ciudades o inmuebles asociados responde 409 `REFERENCIA_INVALIDA` (lo garantiza ' +
    'la FK; no se hace una consulta previa que tenga carrera). 204 sin cuerpo.',
  security: [{ cookieAuth: [] }],
  request: { params: paramsId },
  responses: {
    204: { description: 'Departamento eliminado' },
    ...erroresComunes,
  },
});

// ---------------------------------------------------------------------------
// Ciudades
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/ciudades',
  tags: ['Catalogos'],
  summary: 'Lista las ciudades ordenadas por nombre',
  description:
    'Publico. `?departamento=<id>` limita la lista a las ciudades de ese departamento. ' +
    'Cache publico corto.',
  security: [],
  request: { query: listarCiudadesQuerySchema },
  responses: {
    200: {
      description: 'Ciudades ordenadas por nombre',
      headers: cabeceraCache,
      content: {
        'application/json': {
          schema: listaCiudadesSchema,
          example: { data: [EJEMPLO_CIUDAD] },
        },
      },
    },
    400: respuestasError[400],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/ciudades',
  tags: ['Catalogos'],
  summary: 'Crea una ciudad (solo admin)',
  description:
    'El departamento debe existir (400 `DEPARTAMENTO_INVALIDO`). Una ciudad repetida dentro ' +
    'del mismo departamento responde 409.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: crearCiudadSchema,
          example: { nombre: 'Manizales', id_departamento: 33 },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Ciudad creada',
      content: {
        'application/json': {
          schema: respuestaCiudadSchema,
          example: { ciudad: { id: 1101, nombre: 'Manizales', id_departamento: 33 } },
        },
      },
    },
    ...erroresComunes,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/ciudades/{id}',
  tags: ['Catalogos'],
  summary: 'Actualiza una ciudad (solo admin)',
  description:
    'Puede cambiar el nombre y/o el departamento. Si la ciudad esta en uso y el cambio rompe ' +
    'la FK compuesta de los inmuebles responde 409 `REFERENCIA_INVALIDA`.',
  security: [{ cookieAuth: [] }],
  request: {
    params: paramsId,
    body: {
      content: {
        'application/json': {
          schema: actualizarCiudadSchema,
          example: { nombre: 'Pereira' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Ciudad actualizada',
      content: {
        'application/json': {
          schema: respuestaCiudadSchema,
          example: { ciudad: EJEMPLO_CIUDAD },
        },
      },
    },
    ...erroresComunes,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/ciudades/{id}',
  tags: ['Catalogos'],
  summary: 'Elimina una ciudad (solo admin)',
  description: 'Si esta en uso responde 409 `REFERENCIA_INVALIDA`. 204 sin cuerpo.',
  security: [{ cookieAuth: [] }],
  request: { params: paramsId },
  responses: {
    204: { description: 'Ciudad eliminada' },
    ...erroresComunes,
  },
});

// ---------------------------------------------------------------------------
// Tipos de inmueble
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/tipos-inmueble',
  tags: ['Catalogos'],
  summary: 'Lista los tipos de inmueble ordenados por nombre',
  description: 'Publico. Devuelve el catalogo completo (18 tipos) con cache publico corto.',
  security: [],
  responses: {
    200: {
      description: 'Tipos ordenados por nombre',
      headers: cabeceraCache,
      content: {
        'application/json': {
          schema: listaTiposSchema,
          example: { data: [EJEMPLO_TIPO] },
        },
      },
    },
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/tipos-inmueble',
  tags: ['Catalogos'],
  summary: 'Crea un tipo de inmueble (solo admin)',
  description: 'Nombre con trim y no vacio. Si ya existe responde 409.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: crearNombreSchema,
          example: { nombre: 'Bodega' },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Tipo creado',
      content: {
        'application/json': {
          schema: respuestaTipoSchema,
          example: { tipo: { id: 19, nombre: 'Bodega' } },
        },
      },
    },
    ...erroresComunes,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/tipos-inmueble/{id}',
  tags: ['Catalogos'],
  summary: 'Renombra un tipo de inmueble (solo admin)',
  description: 'Un nombre repetido responde 409. No permite enviar el body vacio.',
  security: [{ cookieAuth: [] }],
  request: {
    params: paramsId,
    body: {
      content: {
        'application/json': {
          schema: actualizarNombreSchema,
          example: { nombre: 'Apartamento' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Tipo actualizado',
      content: {
        'application/json': {
          schema: respuestaTipoSchema,
          example: { tipo: EJEMPLO_TIPO },
        },
      },
    },
    ...erroresComunes,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/tipos-inmueble/{id}',
  tags: ['Catalogos'],
  summary: 'Elimina un tipo de inmueble (solo admin)',
  description: 'Si tiene inmuebles asociados responde 409 `REFERENCIA_INVALIDA`. 204 sin cuerpo.',
  security: [{ cookieAuth: [] }],
  request: { params: paramsId },
  responses: {
    204: { description: 'Tipo eliminado' },
    ...erroresComunes,
  },
});
