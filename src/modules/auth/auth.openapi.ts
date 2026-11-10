import { respuestasError } from '../../docs/components.js';
import { registry } from '../../docs/registry.js';
import { z } from '../../shared/zod.js';
import {
  actualizarPerfilSchema,
  cambiarPasswordSchema,
  loginSchema,
  registroSchema,
  usuarioPublicoSchema,
} from './schemas.js';

// El DTO publico se registra como componente reutilizable. NUNCA incluye
// password_hash: el schema lo demuestra y el service lo construye campo a campo.
const usuarioSchema = registry.register('Usuario', usuarioPublicoSchema);

const respuestaUsuarioSchema = registry.register(
  'RespuestaUsuario',
  z.strictObject({
    usuario: usuarioSchema,
  }),
);

const EJEMPLO_USUARIO = {
  id: 7,
  nombre: 'Ana Torres',
  email: 'ana.torres@ejemplo.com',
  rol: 'usuario' as const,
};

/**
 * Set-Cookie documentado en las respuestas que emiten o borran sesion.
 * Swagger UI no puede establecer cookies httpOnly por si mismo; el contrato
 * deja claro que el navegador las maneja y que el front no las lee.
 */
const cabeceraSetCookie = {
  description:
    'Cookies httpOnly de sesion: access_token (15 min, Path=/) y refresh_token ' +
    '(7 dias, Path=/api/v1/auth). El front debe usar credentials: "include".',
  schema: { type: 'string' as const },
};

const cabeceraCookiesBorradas = {
  description:
    'El servidor borra access_token (Path=/) y refresh_token (Path=/api/v1/auth) ' +
    'enviando ambas cookies vacias y ya vencidas.',
  schema: { type: 'string' as const },
};

const respuestaConSesion = (descripcion: string) => ({
  description: descripcion,
  headers: { 'Set-Cookie': cabeceraSetCookie },
  content: {
    'application/json': {
      schema: respuestaUsuarioSchema,
      example: { usuario: EJEMPLO_USUARIO },
    },
  },
});

// ---------------------------------------------------------------------------
// Endpoints publicos
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Crea una cuenta y abre sesion',
  description:
    'Publico. Normaliza el correo a minusculas, hashea la contrasena con argon2id e ' +
    'inserta el usuario con rol `usuario`. Si todo va bien emite las cookies de sesion ' +
    '(auto-login) y responde 201. La contrasena debe tener entre 10 y 128 caracteres.',
  security: [],
  request: {
    body: {
      content: {
        'application/json': {
          schema: registroSchema,
          example: {
            nombre: 'Ana Torres',
            email: 'Ana.Torres@Ejemplo.com',
            password: 'clave-segura-123',
          },
        },
      },
    },
  },
  responses: {
    201: respuestaConSesion('Cuenta creada y sesion iniciada'),
    400: respuestasError[400],
    409: respuestasError[409],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Inicia sesion con correo y contrasena',
  description:
    'Publico. Devuelve el mismo 401 `CREDENCIALES_INVALIDAS` si el correo no existe o ' +
    'la contrasena es incorrecta (no se puede enumerar cuentas). Si la cuenta esta ' +
    'desactivada responde 403 `USUARIO_DESACTIVADO` solo despues de validar la clave. ' +
    'Crea una sesion nueva con familia nueva.',
  security: [],
  request: {
    body: {
      content: {
        'application/json': {
          schema: loginSchema,
          example: { email: 'ana.torres@ejemplo.com', password: 'clave-segura-123' },
        },
      },
    },
  },
  responses: {
    200: respuestaConSesion('Sesion iniciada'),
    400: respuestasError[400],
    401: respuestasError[401],
    403: respuestasError[403],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Rota el refresh token y emite cookies nuevas',
  description:
    'Publico, pero requiere la cookie httpOnly `refresh_token`. Verifica el JWT, compara ' +
    'sha256(token) con el hash guardado en tiempo constante y, en una transaccion, revoca ' +
    'la sesion actual e inserta otra con la misma familia. Si detecta reutilizacion de un ' +
    'token revocado hace mas de 10 segundos, revoca TODA la familia (posible robo). ' +
    'Cualquier fallo limpia las cookies; el front debe volver al login.',
  security: [],
  responses: {
    200: respuestaConSesion('Sesion renovada'),
    401: respuestasError[401],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Cierra la sesion actual (idempotente)',
  description:
    'Publico. Si la cookie `refresh_token` contiene un token valido, revoca esa sesion. ' +
    'Siempre borra ambas cookies y responde 204, aunque el token falte, este vencido o sea ' +
    'invalido: el logout nunca falla desde el punto de vista del cliente.',
  security: [],
  responses: {
    204: {
      description: 'Sesion cerrada y cookies borradas',
      headers: { 'Set-Cookie': cabeceraCookiesBorradas },
    },
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

// ---------------------------------------------------------------------------
// Endpoints autenticados
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/auth/logout-all',
  tags: ['Auth'],
  summary: 'Cierra todas las sesiones del usuario',
  description:
    'Requiere sesion. Revoca todas las sesiones activas del usuario (todos los ' +
    'dispositivos) y borra las cookies del cliente actual. 204.',
  security: [{ cookieAuth: [] }],
  responses: {
    204: {
      description: 'Todas las sesiones revocadas y cookies borradas',
      headers: { 'Set-Cookie': cabeceraCookiesBorradas },
    },
    401: respuestasError[401],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Devuelve el perfil del usuario autenticado',
  description:
    'Requiere sesion. Devuelve el DTO publico del usuario dueno de la sesion: id, ' +
    'nombre, email y rol. Nunca incluye password_hash.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'Perfil del usuario autenticado',
      content: {
        'application/json': {
          schema: respuestaUsuarioSchema,
          example: { usuario: EJEMPLO_USUARIO },
        },
      },
    },
    401: respuestasError[401],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Actualiza el nombre del usuario autenticado',
  description: 'Requiere sesion. Solo permite cambiar el nombre visible (1..100 caracteres).',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: actualizarPerfilSchema,
          example: { nombre: 'Ana Maria Torres' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Perfil actualizado',
      content: {
        'application/json': {
          schema: respuestaUsuarioSchema,
          example: {
            usuario: { ...EJEMPLO_USUARIO, nombre: 'Ana Maria Torres' },
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
  method: 'patch',
  path: '/auth/password',
  tags: ['Auth'],
  summary: 'Cambia la contrasena y reinicia las sesiones',
  description:
    'Requiere sesion. Verifica la contrasena actual (si no coincide, 401 ' +
    '`CREDENCIALES_INVALIDAS`), guarda la nueva, revoca TODAS las sesiones del usuario ' +
    '(incluida la actual) y abre una sesion nueva, reemitiendo las cookies para que quien ' +
    'cambio la clave siga dentro. Las demas sesiones quedan cerradas. 204.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: cambiarPasswordSchema,
          example: {
            passwordActual: 'clave-segura-123',
            passwordNueva: 'clave-aun-mas-segura-456',
          },
        },
      },
    },
  },
  responses: {
    204: {
      description: 'Contrasena cambiada; el resto de sesiones fue revocado',
      headers: { 'Set-Cookie': cabeceraSetCookie },
    },
    400: respuestasError[400],
    401: respuestasError[401],
    429: respuestasError[429],
    500: respuestasError[500],
  },
});
