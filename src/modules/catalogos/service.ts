import { BadRequestError, NotFoundError } from '../../shared/errors.js';
import * as repo from './repository.js';
import type {
  ActualizarCiudadInput,
  ActualizarNombreInput,
  CiudadDTO,
  CrearCiudadInput,
  CrearNombreInput,
  DepartamentoDTO,
  ListarCiudadesQuery,
  TipoInmuebleDTO,
} from './schemas.js';

// ---------------------------------------------------------------------------
// Departamentos
// ---------------------------------------------------------------------------

export async function listarDepartamentos(): Promise<DepartamentoDTO[]> {
  return repo.listarDepartamentos();
}

export async function crearDepartamento(input: CrearNombreInput): Promise<DepartamentoDTO> {
  // Los duplicados los detecta el UNIQUE (23505 -> 409 via pgErrors).
  return repo.crearDepartamento(input.nombre);
}

export async function actualizarDepartamento(
  id: number,
  input: ActualizarNombreInput,
): Promise<DepartamentoDTO> {
  if (input.nombre === undefined) {
    throw new BadRequestError('SIN_CAMBIOS', 'Debes enviar al menos un campo para actualizar');
  }
  const actualizado = await repo.actualizarDepartamento(id, input.nombre);
  if (!actualizado) {
    throw new NotFoundError('DEPARTAMENTO_NO_ENCONTRADO', 'El departamento no existe');
  }
  return actualizado;
}

export async function eliminarDepartamento(id: number): Promise<void> {
  const eliminado = await repo.eliminarDepartamento(id);
  if (!eliminado) {
    throw new NotFoundError('DEPARTAMENTO_NO_ENCONTRADO', 'El departamento no existe');
  }
}

// ---------------------------------------------------------------------------
// Ciudades
// ---------------------------------------------------------------------------

export async function listarCiudades(query: ListarCiudadesQuery): Promise<CiudadDTO[]> {
  return repo.listarCiudades(query.departamento);
}

async function exigirDepartamento(idDepartamento: number): Promise<void> {
  const departamento = await repo.buscarDepartamento(idDepartamento);
  if (!departamento) {
    throw new BadRequestError(
      'DEPARTAMENTO_INVALIDO',
      'El departamento indicado no existe',
    );
  }
}

export async function crearCiudad(input: CrearCiudadInput): Promise<CiudadDTO> {
  await exigirDepartamento(input.id_departamento);
  // Los duplicados dentro del departamento los detecta el UNIQUE (409).
  return repo.crearCiudad({
    nombre: input.nombre,
    idDepartamento: input.id_departamento,
  });
}

export async function actualizarCiudad(
  id: number,
  input: ActualizarCiudadInput,
): Promise<CiudadDTO> {
  const actual = await repo.buscarCiudad(id);
  if (!actual) {
    throw new NotFoundError('CIUDAD_NO_ENCONTRADA', 'La ciudad no existe');
  }
  if (input.id_departamento !== undefined) {
    await exigirDepartamento(input.id_departamento);
  }

  const actualizado = await repo.actualizarCiudad(id, {
    nombre: input.nombre,
    idDepartamento: input.id_departamento,
  });
  if (!actualizado) {
    throw new NotFoundError('CIUDAD_NO_ENCONTRADA', 'La ciudad no existe');
  }
  return actualizado;
}

export async function eliminarCiudad(id: number): Promise<void> {
  const eliminado = await repo.eliminarCiudad(id);
  if (!eliminado) {
    throw new NotFoundError('CIUDAD_NO_ENCONTRADA', 'La ciudad no existe');
  }
}

// ---------------------------------------------------------------------------
// Tipos de inmueble
// ---------------------------------------------------------------------------

export async function listarTipos(): Promise<TipoInmuebleDTO[]> {
  return repo.listarTipos();
}

export async function crearTipo(input: CrearNombreInput): Promise<TipoInmuebleDTO> {
  return repo.crearTipo(input.nombre);
}

export async function actualizarTipo(
  id: number,
  input: ActualizarNombreInput,
): Promise<TipoInmuebleDTO> {
  if (input.nombre === undefined) {
    throw new BadRequestError('SIN_CAMBIOS', 'Debes enviar al menos un campo para actualizar');
  }
  const actualizado = await repo.actualizarTipo(id, input.nombre);
  if (!actualizado) {
    throw new NotFoundError('TIPO_NO_ENCONTRADO', 'El tipo de inmueble no existe');
  }
  return actualizado;
}

export async function eliminarTipo(id: number): Promise<void> {
  const eliminado = await repo.eliminarTipo(id);
  if (!eliminado) {
    throw new NotFoundError('TIPO_NO_ENCONTRADO', 'El tipo de inmueble no existe');
  }
}
