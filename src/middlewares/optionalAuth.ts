import type { RequestHandler } from 'express';
import { leerCookie } from '../modules/auth/cookies.js';
import { verificarAccessToken } from '../modules/auth/tokens.js';

/**
 * Identifica al usuario si hay un token valido, pero NO exige sesion. Si el
 * token falta o es invalido/vencido, continua con req.user = undefined.
 * Se usa en rutas publicas cuya respuesta cambia si hay usuario (ej. ?mias=true).
 */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = leerCookie(req, 'access_token');
  if (!token) {
    req.user = undefined;
    next();
    return;
  }

  try {
    const { idUsuario, rol } = verificarAccessToken(token);
    req.user = { id: idUsuario, rol };
  } catch {
    // Token vencido o invalido: sigue como visitante.
    req.user = undefined;
  }
  next();
};
