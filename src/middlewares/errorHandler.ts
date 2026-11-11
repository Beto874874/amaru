import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { logger } from '../config/logger.js';
import { AppError, BadRequestError, PayloadTooLargeError } from '../shared/errors.js';
import { traducirErrorPg } from '../shared/pgErrors.js';

interface ErrorConTipo {
  type?: string;
  status?: number;
  body?: unknown;
}

function esErrorDeJson(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) return false;
  const conTipo = error as ErrorConTipo;
  // body-parser marca el error de parseo de JSON con status 400 y `body`.
  return conTipo.status === 400 && 'body' in conTipo;
}

// Middleware de errores: SIEMPRE responde con el formato unico de la seccion 7.2.
// Express 5 reconoce los 4 argumentos y envia aqui los errores de handlers async.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const reqId = req.id;

  // 1. Errores de validacion que no pasaron por validate() (p. ej. multipart).
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDACION_FALLIDA',
        message: 'Los datos enviados no son validos',
        details: error.issues.map((issue) => ({
          campo: issue.path.join('.') || 'body',
          mensaje: issue.message,
        })),
      },
    });
    return;
  }

  // 2. Errores de aplicacion (incluye rate limit y auth).
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  // 3. Errores de Postgres traducidos.
  const errorPg = traducirErrorPg(error);
  if (errorPg) {
    res.status(errorPg.statusCode).json({
      error: {
        code: errorPg.code,
        message: errorPg.message,
        ...(errorPg.details ? { details: errorPg.details } : {}),
      },
    });
    return;
  }

  // 4. JSON mal formado por body-parser.
  if (esErrorDeJson(error)) {
    res.status(400).json({
      error: { code: 'JSON_INVALIDO', message: 'El cuerpo de la peticion no es JSON valido' },
    });
    return;
  }

  // 5. Cuerpo demasiado grande (body-parser o multer).
  const conTipo = error as ErrorConTipo;
  if (conTipo.type === 'entity.too.large') {
    const grande = new PayloadTooLargeError();
    res.status(grande.statusCode).json({
      error: { code: grande.code, message: grande.message },
    });
    return;
  }
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const grande = new PayloadTooLargeError('El archivo supera el tamano maximo permitido');
      res.status(grande.statusCode).json({ error: { code: grande.code, message: grande.message } });
      return;
    }
    const mensajes: Record<string, string> = {
      LIMIT_FILE_COUNT: 'Se enviaron demasiados archivos',
      LIMIT_UNEXPECTED_FILE: 'Campo de archivo no esperado o demasiados archivos',
    };
    const malo = new BadRequestError(
      'ARCHIVO_INVALIDO',
      mensajes[error.code] ?? 'El archivo enviado no es valido',
    );
    res.status(malo.statusCode).json({ error: { code: malo.code, message: malo.message } });
    return;
  }

  // 6. Cualquier otra cosa: 500 generico. El detalle SOLO va al log.
  logger.error({ err: error, reqId }, 'Error no controlado');
  res.status(500).json({
    error: { code: 'ERROR_INTERNO', message: 'Ocurrio un error inesperado en el servidor' },
  });
};
