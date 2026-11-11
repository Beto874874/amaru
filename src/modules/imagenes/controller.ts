import type { Request, RequestHandler } from 'express';
import { validado } from '../../middlewares/validate.js';
import { UnauthorizedError } from '../../shared/errors.js';
import type { UsuarioSolicitante } from '../inmuebles/service.js';
import type { ActualizarImagenInput } from './schemas.js';
import * as servicio from './service.js';

function usuarioDe(req: Request): UsuarioSolicitante {
  if (!req.user) {
    throw new UnauthorizedError('NO_AUTENTICADO', 'No hay una sesion activa');
  }
  return { id: req.user.id, rol: req.user.rol };
}

/** multer deja los archivos en req.files (array con .array()). */
function archivosDe(req: Request): Express.Multer.File[] {
  return Array.isArray(req.files) ? req.files : [];
}

/** POST /inmuebles/:id/imagenes (autenticado; dueno o admin). 201 { data }. */
export const subir: RequestHandler = async (req, res) => {
  const { id } = validado<{ id: number }>(req, 'params');
  const imagenes = await servicio.subir(usuarioDe(req), id, archivosDe(req));
  res.status(201).json({ data: imagenes });
};

/** PATCH /inmuebles/:id/imagenes/:idImagen. 200 { imagen }. */
export const actualizar: RequestHandler = async (req, res) => {
  const { id, idImagen } = validado<{ id: number; idImagen: number }>(req, 'params');
  const cambios = validado<ActualizarImagenInput>(req, 'body');
  const imagen = await servicio.actualizar(usuarioDe(req), id, idImagen, cambios);
  res.status(200).json({ imagen });
};

/** DELETE /inmuebles/:id/imagenes/:idImagen. 204. */
export const eliminar: RequestHandler = async (req, res) => {
  const { id, idImagen } = validado<{ id: number; idImagen: number }>(req, 'params');
  await servicio.eliminar(usuarioDe(req), id, idImagen);
  res.status(204).end();
};
