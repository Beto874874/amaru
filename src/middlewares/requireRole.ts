import type { RequestHandler } from 'express';
import type { Rol } from '../modules/auth/tokens.js';
import { ForbiddenError, UnauthorizedError } from '../shared/errors.js';

/**
 * Exige que req.user.rol este en la lista. SIEMPRE se usa despues de
 * authenticate (o optionalAuth, si la ruta admite visitantes y solo restringe
 * algunas acciones). La autorizacion de dominio (dueno o admin) vive en el
 * service, no aqui.
 */
export function requireRole(...roles: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError('NO_AUTENTICADO', 'No hay una sesion activa'));
      return;
    }
    if (!roles.includes(req.user.rol)) {
      next(new ForbiddenError('PROHIBIDO', 'No tienes permiso para realizar esta accion'));
      return;
    }
    next();
  };
}
