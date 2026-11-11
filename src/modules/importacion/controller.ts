import type { RequestHandler } from 'express';
import { BadRequestError, UnauthorizedError } from '../../shared/errors.js';
import * as servicio from './service.js';

/** POST /importacion/inmuebles (solo admin, multipart/form-data). */
export const importarInmuebles: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('NO_AUTENTICADO', 'No hay una sesion activa');
  }

  const archivo = req.file;
  if (!archivo) {
    throw new BadRequestError(
      'ARCHIVO_REQUERIDO',
      'Debes enviar un archivo CSV en el campo "archivo"',
    );
  }

  const resultado = await servicio.importarInmuebles(req.user.id, archivo.buffer);
  res.status(201).json(resultado);
};
