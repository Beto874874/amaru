import type { Request, RequestHandler } from 'express';
import { validado } from '../../middlewares/validate.js';
import { UnauthorizedError } from '../../shared/errors.js';
import { limpiarCookiesDeSesion, leerCookie, ponerCookiesDeSesion } from './cookies.js';
import type {
  ActualizarPerfilInput,
  CambiarPasswordInput,
  LoginInput,
  RegistroInput,
} from './schemas.js';
import * as servicio from './service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function metaDeSesion(req: Request): servicio.MetaSesion {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}

function idUsuarioDe(req: Request): number {
  if (!req.user) {
    throw new UnauthorizedError('NO_AUTENTICADO', 'No hay una sesion activa');
  }
  return req.user.id;
}

// ---------------------------------------------------------------------------
// Handlers. Los DTO salen SIEMPRE del service, construidos campo a campo:
// nunca se hace spread de la fila de base (tiene password_hash).
// ---------------------------------------------------------------------------

/** POST /auth/register (publico). 201 + cookies de auto-login. */
export const registrar: RequestHandler = async (req, res) => {
  const datos = validado<RegistroInput>(req, 'body');
  const resultado = await servicio.registrar(datos, metaDeSesion(req));
  ponerCookiesDeSesion(res, resultado.accessToken, resultado.refreshToken);
  res.status(201).json({ usuario: resultado.usuario });
};

/** POST /auth/login (publico). 200 + cookies. */
export const iniciarSesion: RequestHandler = async (req, res) => {
  const datos = validado<LoginInput>(req, 'body');
  const resultado = await servicio.iniciarSesion(datos, metaDeSesion(req));
  ponerCookiesDeSesion(res, resultado.accessToken, resultado.refreshToken);
  res.status(200).json({ usuario: resultado.usuario });
};

/**
 * POST /auth/refresh (publico, usa la cookie refresh_token).
 * Si CUALQUIER paso falla se limpian las cookies: el cliente debe volver al
 * login en vez de reintentar con un token que ya no sirve.
 */
export const refrescar: RequestHandler = async (req, res) => {
  const token = leerCookie(req, 'refresh_token');
  try {
    const resultado = await servicio.refrescar(token, metaDeSesion(req));
    ponerCookiesDeSesion(res, resultado.accessToken, resultado.refreshToken);
    res.status(200).json({ usuario: resultado.usuario });
  } catch (error) {
    limpiarCookiesDeSesion(res);
    throw error;
  }
};

/** POST /auth/logout (publico). Idempotente: siempre 204. */
export const cerrarSesion: RequestHandler = async (req, res) => {
  await servicio.cerrarSesion(leerCookie(req, 'refresh_token'));
  limpiarCookiesDeSesion(res);
  res.status(204).end();
};

/** POST /auth/logout-all (autenticado). Revoca todas las sesiones. 204. */
export const cerrarTodasLasSesiones: RequestHandler = async (req, res) => {
  await servicio.cerrarTodasLasSesiones(idUsuarioDe(req));
  limpiarCookiesDeSesion(res);
  res.status(204).end();
};

/** GET /auth/me (autenticado). 200 { usuario }. */
export const obtenerPerfil: RequestHandler = async (req, res) => {
  const usuario = await servicio.obtenerPerfil(idUsuarioDe(req));
  res.status(200).json({ usuario });
};

/** PATCH /auth/me (autenticado). 200 { usuario }. */
export const actualizarPerfil: RequestHandler = async (req, res) => {
  const datos = validado<ActualizarPerfilInput>(req, 'body');
  const usuario = await servicio.actualizarPerfil(idUsuarioDe(req), datos);
  res.status(200).json({ usuario });
};

/**
 * PATCH /auth/password (autenticado). Revoca todas las sesiones, abre una
 * nueva y reemite cookies para que quien cambio la clave siga dentro. 204.
 */
export const cambiarPassword: RequestHandler = async (req, res) => {
  const datos = validado<CambiarPasswordInput>(req, 'body');
  const resultado = await servicio.cambiarPassword(idUsuarioDe(req), datos, metaDeSesion(req));
  ponerCookiesDeSesion(res, resultado.accessToken, resultado.refreshToken);
  res.status(204).end();
};
