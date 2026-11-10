import { NotFoundError } from '../../shared/errors.js';
import {
  calcularOffset,
  construirMeta,
  type RespuestaPaginada,
} from '../../shared/pagination.js';
import * as repo from './repository.js';
import type {
  ActualizarContactoInput,
  ContactoPublico,
  CrearContactoInput,
  ListarContactosQuery,
} from './schemas.js';

function aContactoPublico(fila: repo.ContactoFila): ContactoPublico {
  return {
    id: fila.id,
    nombre: fila.nombre,
    telefono: fila.telefono,
    direccion: fila.direccion,
    correo: fila.correo,
  };
}

export async function listar(
  query: ListarContactosQuery,
): Promise<RespuestaPaginada<ContactoPublico>> {
  const { filas, total } = await repo.listar(
    { q: query.q },
    { offset: calcularOffset(query), limit: query.limit },
  );
  return {
    data: filas.map(aContactoPublico),
    meta: construirMeta(query, total),
  };
}

export async function obtener(id: number): Promise<ContactoPublico> {
  const fila = await repo.buscarPorId(id);
  if (!fila) {
    throw new NotFoundError('CONTACTO_NO_ENCONTRADO', 'El contacto no existe');
  }
  return aContactoPublico(fila);
}

export async function crear(
  input: CrearContactoInput,
): Promise<{ contacto: ContactoPublico; creado: boolean }> {
  const resultado = await repo.buscarOCrear({
    nombre: input.nombre,
    telefono: input.telefono ?? null,
    direccion: input.direccion ?? null,
    correo: input.correo ?? null,
  });
  return { contacto: aContactoPublico(resultado.contacto), creado: resultado.creado };
}

export async function actualizar(
  id: number,
  input: ActualizarContactoInput,
): Promise<ContactoPublico> {
  const actualizado = await repo.actualizar(id, {
    nombre: input.nombre,
    telefono: input.telefono,
    direccion: input.direccion,
    correo: input.correo,
  });
  if (!actualizado) {
    throw new NotFoundError('CONTACTO_NO_ENCONTRADO', 'El contacto no existe');
  }
  return aContactoPublico(actualizado);
}

export async function eliminar(id: number): Promise<void> {
  const eliminado = await repo.eliminar(id);
  if (!eliminado) {
    throw new NotFoundError('CONTACTO_NO_ENCONTRADO', 'El contacto no existe');
  }
}
