import { paginacionMetaSchema, respuestasError } from '../../docs/components.js';
import { registry } from '../../docs/registry.js';
import { z } from '../../shared/zod.js';
import {
  contactoSchema,
  inmuebleDetalleSchema,
  inmueblePublicoSchema,
  listarInmueblesBaseSchema,
  crearInmuebleSchema,
  actualizarInmuebleSchema,
} from './schemas.js';

// Componentes reutilizables. El DTO publico se construye campo a campo en
// mapper.ts: NUNCA incluye id_usuario, email ni ningun dato del dueno.
// Contacto se registra aparte porque la Fase 5 lo reutiliza.
registry.register('Contacto', contactoSchema);
const inmuebleRegistrado = registry.register('Inmueble', inmueblePublicoSchema);
const inmuebleDetalleRegistrado = registry.register('InmuebleDetalle', inmuebleDetalleSchema);

const respuestaInmuebleSchema = registry.register(
  'RespuestaInmueble',
  z.strictObject({ inmueble: inmuebleRegistrado }),
);

const respuestaInmuebleDetalleSchema = registry.register(
  'RespuestaInmuebleDetalle',
  z.strictObject({ inmueble: inmuebleDetalleRegistrado }),
);

const respuestaListaInmueblesSchema = registry.register(
  'RespuestaListaInmuebles',
  z.strictObject({
    data: z.array(inmuebleRegistrado),
    meta: paginacionMetaSchema,
  }),
);

const EJEMPLO_CONTACTO = {
  nombre: 'Inmobiliaria Los Andes',
  telefono: '+57 601 555 0123',
  direccion: 'Calle 10 # 20-30, Bogota',
  correo: 'contacto@losandes.example',
};

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

const EJEMPLO_IMAGEN_PRINCIPAL = {
  url: EJEMPLO_IMAGEN.url,
  miniatura_url: EJEMPLO_IMAGEN.miniatura_url,
};

const EJEMPLO_INMUEBLE = {
  id: 98635,
  codigo_sae: 'SAE-000123',
  nombre: 'Apartamento - SAE-000123',
  tipo: 'Apartamento',
  departamento: 'Risaralda',
  ciudad: 'Pereira',
  direccion: 'Carrera 7 # 25-40, Apto 502',
  estrato: 4,
  valor_arriendo: 1500000,
  area_terreno: 80.5,
  area_construida: 72.25,
  mas_admon: false,
  en_home: true,
  iva: false,
  pagina_web: null,
  estado: 'Disponible' as const,
  ubicacion_inferida: false,
  alertas: [],
  fecha_publicacion: '2026-11-09T18:00:00.000Z',
  contacto: EJEMPLO_CONTACTO,
  publicado_por_usuario: true,
  es_mio: false,
  imagen_principal: EJEMPLO_IMAGEN_PRINCIPAL,
};

const EJEMPLO_DETALLE = {
  ...EJEMPLO_INMUEBLE,
  imagenes: [EJEMPLO_IMAGEN],
};

const EJEMPLO_LISTA = {
  data: [EJEMPLO_INMUEBLE],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/inmuebles',
  tags: ['Inmuebles'],
  summary: 'Lista inmuebles paginados y filtrados',
  description:
    'Publico. Devuelve solo inmuebles con el estado pedido (por defecto `Disponible`). ' +
    'Los filtros por departamento, ciudad y tipo usan **IDs** (no nombres). `q` busca en ' +
    '`nombre_inmueble` y `direccion` escapando los comodines de LIKE. El orden siempre ' +
    'agrega `id_inmueble` como desempate para que la paginacion sea estable. Con sesion, ' +
    'cada inmueble incluye `es_mio`; `mias=true` exige sesion (401 si no hay) y filtra por ' +
    'el usuario del token. Cada inmueble incluye `imagen_principal` (o `null` si no tiene ' +
    'fotos): el arreglo completo de fotos solo se envia en el detalle.',
  security: [],
  request: {
    query: listarInmueblesBaseSchema,
  },
  responses: {
    200: {
      description: 'Lista paginada de inmuebles',
      content: {
        'application/json': {
          schema: respuestaListaInmueblesSchema,
          example: EJEMPLO_LISTA,
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
  path: '/inmuebles/{id}',
  tags: ['Inmuebles'],
  summary: 'Obtiene el detalle de un inmueble',
  description:
    'Publico. El `id` debe ser un entero positivo (400 si no). Si no existe responde 404 ' +
    '`INMUEBLE_NO_ENCONTRADO`. Con sesion, `es_mio` indica si el solicitante es el dueno. ' +
    'Incluye `imagen_principal` y el arreglo `imagenes` con TODAS las fotos del inmueble, ' +
    'ordenadas por `orden` y luego por `id` (vacio si no tiene).',
  security: [],
  request: { params: z.strictObject({ id: z.coerce.number().int().positive() }) },
  responses: {
    200: {
      description: 'Detalle del inmueble con todas sus fotos',
      content: {
        'application/json': {
          schema: respuestaInmuebleDetalleSchema,
          example: { inmueble: EJEMPLO_DETALLE },
        },
      },
    },
    400: respuestasError[400],
    404: respuestasError[404],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/inmuebles',
  tags: ['Inmuebles'],
  summary: 'Publica un inmueble',
  description:
    'Requiere sesion. `tipo_inmueble` y `departamento` deben existir en los catalogos por ' +
    'nombre exacto; `ciudad` debe existir dentro del departamento. Si `nombre_inmueble` ' +
    'falta se genera `"<tipo_inmueble> - <codigo_sae>"`. El `codigo_sae` es unico: si se ' +
    'repite responde 409 `CODIGO_SAE_DUPLICADO`. Los campos controlados por el servidor ' +
    '(`id_inmueble`, `id_usuario`, fechas, `ubicacion_inferida`, `alertas`) se rechazan con ' +
    '400 si llegan. Los datos de contacto se muestran en la respuesta, pero nunca el ' +
    'usuario dueno.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: crearInmuebleSchema,
          example: {
            codigo_sae: 'SAE-000123',
            tipo_inmueble: 'Apartamento',
            departamento: 'Risaralda',
            ciudad: 'Pereira',
            direccion: 'Carrera 7 # 25-40, Apto 502',
            estrato: 4,
            valor_arriendo: 1500000,
            area_terreno: 80.5,
            area_construida: 72.25,
            mas_admon: false,
            en_home: true,
            iva: false,
            pagina_web: 'https://ejemplo.com/inmueble/SAE-000123',
            estado_inmueble: 'Disponible',
            nombre_contacto: EJEMPLO_CONTACTO.nombre,
            telefono_contacto: EJEMPLO_CONTACTO.telefono,
            direccion_contacto: EJEMPLO_CONTACTO.direccion,
            correo_contacto: EJEMPLO_CONTACTO.correo,
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Inmueble creado',
      content: {
        'application/json': {
          schema: respuestaInmuebleSchema,
          example: { inmueble: EJEMPLO_INMUEBLE },
        },
      },
    },
    400: respuestasError[400],
    401: respuestasError[401],
    409: respuestasError[409],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/inmuebles/{id}',
  tags: ['Inmuebles'],
  summary: 'Actualiza parcialmente un inmueble',
  description:
    'Requiere sesion. Solo el dueno del inmueble o un admin puede modificarlo; los ' +
    'inmuebles importados del CSV (sin dueno) solo los edita un admin. Un campo ausente no ' +
    'se toca; un opcional se vacia enviando `null`. Al cambiar `departamento` o `ciudad` se ' +
    'revalida que la ciudad resultante pertenezca al departamento. Los contactos son ' +
    'compartidos: si sus datos cambian se crea/reutiliza otro y se reasigna. ' +
    '`nombre_contacto: null` quita el contacto.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.strictObject({ id: z.coerce.number().int().positive() }),
    body: {
      content: {
        'application/json': {
          schema: actualizarInmuebleSchema,
          example: { valor_arriendo: 1650000, estado_inmueble: 'Arrendado' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Inmueble actualizado',
      content: {
        'application/json': {
          schema: respuestaInmuebleSchema,
          example: {
            inmueble: { ...EJEMPLO_INMUEBLE, valor_arriendo: 1650000, estado: 'Arrendado' },
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
  path: '/inmuebles/{id}',
  tags: ['Inmuebles'],
  summary: 'Elimina un inmueble',
  description:
    'Requiere sesion. Misma regla de propiedad que PATCH. Borrado fisico; el contacto NO ' +
    'se elimina porque es compartido. Responde 204 sin cuerpo.',
  security: [{ cookieAuth: [] }],
  request: { params: z.strictObject({ id: z.coerce.number().int().positive() }) },
  responses: {
    204: { description: 'Inmueble eliminado' },
    400: respuestasError[400],
    401: respuestasError[401],
    403: respuestasError[403],
    404: respuestasError[404],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});
