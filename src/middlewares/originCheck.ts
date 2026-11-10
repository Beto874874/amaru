import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ForbiddenError } from '../shared/errors.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Normaliza para comparar sin barra final ni mayusculas en el host.
function normalizar(origen: string): string {
  return origen.trim().replace(/\/+$/, '').toLowerCase();
}

// Defensa CSRF adicional a SameSite: en peticiones que modifican estado, si el
// navegador envia cabecera Origin, debe ser uno de los origenes permitidos o el
// propio origen del API (lo necesita el "Try it out" de Swagger UI).
// Si no hay Origin (curl, Postman, servidor a servidor) se permite: un navegador
// SIEMPRE lo envia en peticiones cruzadas que cambian estado.
const origenesPermitidos = new Set(
  [...env.CORS_ORIGINS, env.API_PUBLIC_URL].map((origen) => normalizar(origen)),
);

export const originCheck: RequestHandler = (req, _res, next) => {
  if (METODOS_SEGUROS.has(req.method)) {
    next();
    return;
  }

  const origen = req.get('origin');
  if (!origen) {
    next();
    return;
  }

  if (origenesPermitidos.has(normalizar(origen))) {
    next();
    return;
  }

  next(new ForbiddenError('ORIGEN_NO_PERMITIDO', 'El origen de la peticion no esta permitido'));
};
