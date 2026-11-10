import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { BadRequestError, type DetalleValidacion } from '../shared/errors.js';

// Se importa para configurar los mensajes de Zod en espanol (efecto global).
import '../shared/zod.js';

export interface EsquemasValidacion {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Valida body/query/params con Zod y deja el RESULTADO LIMPIO en req.validated.
 * Nunca se reasigna req.query (en Express 5 es un getter de solo lectura).
 */
export function validate(esquemas: EsquemasValidacion): RequestHandler {
  return (req, _res, next) => {
    req.validated ??= {};
    const detalles: DetalleValidacion[] = [];

    for (const parte of ['params', 'query', 'body'] as const) {
      const esquema = esquemas[parte];
      if (!esquema) continue;

      const resultado = esquema.safeParse(req[parte]);
      if (resultado.success) {
        req.validated[parte] = resultado.data;
      } else {
        for (const issue of resultado.error.issues) {
          detalles.push({
            campo: issue.path.length > 0 ? issue.path.join('.') : parte,
            mensaje: issue.message,
          });
        }
      }
    }

    if (detalles.length > 0) {
      next(new BadRequestError('VALIDACION_FALLIDA', 'Los datos enviados no son validos', detalles));
      return;
    }
    next();
  };
}

/**
 * Acceso tipado a los datos validados. Falla ruidosamente si la ruta olvido el
 * middleware validate: es un error de programacion, no de la peticion.
 */
export function validado<T>(req: Request, parte: 'body' | 'query' | 'params'): T {
  const valor = req.validated?.[parte];
  if (valor === undefined) {
    throw new Error(`No hay datos validados para "${parte}": falta validate() en la ruta`);
  }
  return valor as T;
}
