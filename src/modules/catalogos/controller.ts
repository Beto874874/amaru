import type { Request, RequestHandler } from 'express';
import { validado } from '../../middlewares/validate.js';
import type {
  ActualizarCiudadInput,
  ActualizarNombreInput,
  CrearCiudadInput,
  CrearNombreInput,
  ListarCiudadesQuery,
} from './schemas.js';
import * as servicio from './service.js';

// Los catalogos son casi estaticos: se permite cache publico corto.
const CACHE_CATALOGOS = 'public, max-age=300';

function idDe(req: Request): number {
  return validado<{ id: number }>(req, 'params').id;
}

// ---------------------------------------------------------------------------
// Departamentos
// ---------------------------------------------------------------------------

export const listarDepartamentos: RequestHandler = async (_req, res) => {
  const data = await servicio.listarDepartamentos();
  res.set('Cache-Control', CACHE_CATALOGOS).status(200).json({ data });
};

export const crearDepartamento: RequestHandler = async (req, res) => {
  const datos = validado<CrearNombreInput>(req, 'body');
  const departamento = await servicio.crearDepartamento(datos);
  res.status(201).json({ departamento });
};

export const actualizarDepartamento: RequestHandler = async (req, res) => {
  const datos = validado<ActualizarNombreInput>(req, 'body');
  const departamento = await servicio.actualizarDepartamento(idDe(req), datos);
  res.status(200).json({ departamento });
};

export const eliminarDepartamento: RequestHandler = async (req, res) => {
  await servicio.eliminarDepartamento(idDe(req));
  res.status(204).end();
};

// ---------------------------------------------------------------------------
// Ciudades
// ---------------------------------------------------------------------------

export const listarCiudades: RequestHandler = async (req, res) => {
  const query = validado<ListarCiudadesQuery>(req, 'query');
  const data = await servicio.listarCiudades(query);
  res.set('Cache-Control', CACHE_CATALOGOS).status(200).json({ data });
};

export const crearCiudad: RequestHandler = async (req, res) => {
  const datos = validado<CrearCiudadInput>(req, 'body');
  const ciudad = await servicio.crearCiudad(datos);
  res.status(201).json({ ciudad });
};

export const actualizarCiudad: RequestHandler = async (req, res) => {
  const datos = validado<ActualizarCiudadInput>(req, 'body');
  const ciudad = await servicio.actualizarCiudad(idDe(req), datos);
  res.status(200).json({ ciudad });
};

export const eliminarCiudad: RequestHandler = async (req, res) => {
  await servicio.eliminarCiudad(idDe(req));
  res.status(204).end();
};

// ---------------------------------------------------------------------------
// Tipos de inmueble
// ---------------------------------------------------------------------------

export const listarTipos: RequestHandler = async (_req, res) => {
  const data = await servicio.listarTipos();
  res.set('Cache-Control', CACHE_CATALOGOS).status(200).json({ data });
};

export const crearTipo: RequestHandler = async (req, res) => {
  const datos = validado<CrearNombreInput>(req, 'body');
  const tipo = await servicio.crearTipo(datos);
  res.status(201).json({ tipo });
};

export const actualizarTipo: RequestHandler = async (req, res) => {
  const datos = validado<ActualizarNombreInput>(req, 'body');
  const tipo = await servicio.actualizarTipo(idDe(req), datos);
  res.status(200).json({ tipo });
};

export const eliminarTipo: RequestHandler = async (req, res) => {
  await servicio.eliminarTipo(idDe(req));
  res.status(204).end();
};
