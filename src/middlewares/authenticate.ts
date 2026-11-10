import type { RequestHandler } from 'express';
import { leerCookie } from '../modules/auth/cookies.js';
import { verificarAccessToken } from '../modules/auth/tokens.js';
import { UnauthorizedError } from '../shared/errors.js';

/**
 * Exige una sesion valida. Lee SOLO la cookie httpOnly de access token (nunca
 * la cabecera Authorization) y deja req.user = { id, rol }.
 * No consulta la base: ese es el sentido del access token corto.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = leerCookie(req, 'access_token');
  if (!token) {
    next(new UnauthorizedError('NO_AUTENTICADO', 'No hay una sesion activa'));
    return;
  }

  try {
    const { idUsuario, rol } = verificarAccessToken(token);
    req.user = { id: idUsuario, rol };
    next();
  } catch (error) {
    next(error);
  }
};
