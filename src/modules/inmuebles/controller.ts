import type { Request, RequestHandler } from 'express';
import { validado } from '../../middlewares/validate.js';
import { UnauthorizedError } from '../../shared/errors.js';
import type {
  ActualizarInmuebleInput,
  CrearInmuebleInput,
  ListarInmueblesQuery,
} from './schemas.js';
import * as servicio from './service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function usuarioDe(req: Request): servicio.UsuarioSolicitante {
  if (!req.user) {
    throw new UnauthorizedError('NO_AUTENTICADO', 'No hay una sesion activa');
  }
  return { id: req.user.id, rol: req.user.rol };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** GET /inmuebles (publico). Lista paginada; `mias=true` exige sesion. */
export const listar: RequestHandler = async (req, res) => {
  const query = validado<ListarInmueblesQuery>(req, 'query');
  const resultado = await servicio.listar(query, req.user?.id);
  res.status(200).json(resultado);
};

/** GET /inmuebles/:id (publico). 200 { inmueble }. */
export const obtener: RequestHandler = async (req, res) => {
  const { id } = validado<{ id: number }>(req, 'params');
  const inmueble = await servicio.obtener(id, req.user?.id);
  res.status(200).json({ inmueble });
};

/** POST /inmuebles (autenticado). 201 { inmueble }. */
export const crear: RequestHandler = async (req, res) => {
  const datos = validado<CrearInmuebleInput>(req, 'body');
  const inmueble = await servicio.crear(usuarioDe(req).id, datos);
  res.status(201).json({ inmueble });
};

/** PATCH /inmuebles/:id (autenticado; dueno o admin). 200 { inmueble }. */
export const actualizar: RequestHandler = async (req, res) => {
  const { id } = validado<{ id: number }>(req, 'params');
  const datos = validado<ActualizarInmuebleInput>(req, 'body');
  const inmueble = await servicio.actualizar(usuarioDe(req), id, datos);
  res.status(200).json({ inmueble });
};

/** DELETE /inmuebles/:id (autenticado; dueno o admin). 204. */
export const eliminar: RequestHandler = async (req, res) => {
  const { id } = validado<{ id: number }>(req, 'params');
  await servicio.eliminar(usuarioDe(req), id);
  res.status(204).end();
};
