import type { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../../config/env.js';
import { VIDA_ACCESS_MS, VIDA_REFRESH_MS } from './tokens.js';

// UNICO lugar de la API donde se crean/borran cookies de sesion.

const PATH_ACCESS = '/';
// La cookie de refresco solo viaja a las rutas de auth: el navegador no la
// envia en cada peticion a la API (menos superficie de ataque).
const PATH_REFRESH = '/api/v1/auth';

const opcionesBase: CookieOptions = {
  httpOnly: true,
  secure: isProduction, // Secure obligatorio en produccion (HTTPS)
  sameSite: env.COOKIE_SAMESITE,
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

export function ponerCookiesDeSesion(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, {
    ...opcionesBase,
    path: PATH_ACCESS,
    maxAge: VIDA_ACCESS_MS,
  });
  res.cookie('refresh_token', refreshToken, {
    ...opcionesBase,
    path: PATH_REFRESH,
    maxAge: VIDA_REFRESH_MS,
  });
}

/**
 * Para BORRAR una cookie, clearCookie debe recibir exactamente los mismos
 * path/domain/sameSite/secure con los que se creo; si no, el navegador la ignora.
 */
export function limpiarCookiesDeSesion(res: Response): void {
  res.clearCookie('access_token', { ...opcionesBase, path: PATH_ACCESS });
  res.clearCookie('refresh_token', { ...opcionesBase, path: PATH_REFRESH });
}

/** Lee una cookie de sesion de forma segura (siempre string o undefined). */
export function leerCookie(req: Request, nombre: 'access_token' | 'refresh_token'): string | undefined {
  const cookies: unknown = req.cookies;
  if (cookies === null || typeof cookies !== 'object') return undefined;
  const valor = (cookies as Record<string, unknown>)[nombre];
  return typeof valor === 'string' && valor.trim() !== '' ? valor : undefined;
}
