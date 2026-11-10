import type { Request, RequestHandler } from 'express';
import { validado } from '../../middlewares/validate.js';
import type {
  ActualizarContactoInput,
  CrearContactoInput,
  ListarContactosQuery,
} from './schemas.js';
import * as servicio from './service.js';

function idDe(req: Request): number {
  return validado<{ id: number }>(req, 'params').id;
}

/** GET /contactos (autenticado). Lista paginada con busqueda por nombre. */
export const listar: RequestHandler = async (req, res) => {
  const query = validado<ListarContactosQuery>(req, 'query');
  res.status(200).json(await servicio.listar(query));
};

/** GET /contactos/:id (autenticado). */
export const obtener: RequestHandler = async (req, res) => {
  const contacto = await servicio.obtener(idDe(req));
  res.status(200).json({ contacto });
};

/** POST /contactos (autenticado). "Buscar o crear": 201 si es nuevo, 200 si ya existia. */
export const crear: RequestHandler = async (req, res) => {
  const datos = validado<CrearContactoInput>(req, 'body');
  const { contacto, creado } = await servicio.crear(datos);
  res.status(creado ? 201 : 200).json({ contacto });
};

/** PATCH /contactos/:id (solo admin; es compartido por muchos inmuebles). */
export const actualizar: RequestHandler = async (req, res) => {
  const datos = validado<ActualizarContactoInput>(req, 'body');
  const contacto = await servicio.actualizar(idDe(req), datos);
  res.status(200).json({ contacto });
};

/** DELETE /contactos/:id (solo admin). Si esta en uso -> 409 REFERENCIA_INVALIDA. */
export const eliminar: RequestHandler = async (req, res) => {
  await servicio.eliminar(idDe(req));
  res.status(204).end();
};
