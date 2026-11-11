import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../src/modules/catalogos/repository.js';
import * as servicio from '../../src/modules/catalogos/service.js';

vi.mock('../../src/modules/catalogos/repository.js', () => ({
  listarDepartamentos: vi.fn(),
  crearDepartamento: vi.fn(),
  actualizarDepartamento: vi.fn(),
  eliminarDepartamento: vi.fn(),
  buscarDepartamento: vi.fn(),
  listarCiudades: vi.fn(),
  buscarCiudad: vi.fn(),
  crearCiudad: vi.fn(),
  actualizarCiudad: vi.fn(),
  eliminarCiudad: vi.fn(),
  listarTipos: vi.fn(),
  crearTipo: vi.fn(),
  actualizarTipo: vi.fn(),
  eliminarTipo: vi.fn(),
}));

const departamento = { id: 1, nombre: 'Bogotá D.C.' };
const ciudad = { id: 2, nombre: 'Bogotá D.C.', id_departamento: 1, departamento: 'Bogotá D.C.' };
const tipo = { id: 3, nombre: 'Apartamento' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.buscarDepartamento).mockResolvedValue({ id: 1, nombre: 'Bogotá D.C.' });
  vi.mocked(repo.buscarCiudad).mockResolvedValue(ciudad);
  vi.mocked(repo.crearDepartamento).mockResolvedValue(departamento);
  vi.mocked(repo.actualizarDepartamento).mockResolvedValue(departamento);
  vi.mocked(repo.eliminarDepartamento).mockResolvedValue(true);
  vi.mocked(repo.crearCiudad).mockResolvedValue(ciudad);
  vi.mocked(repo.actualizarCiudad).mockResolvedValue(ciudad);
  vi.mocked(repo.eliminarCiudad).mockResolvedValue(true);
  vi.mocked(repo.crearTipo).mockResolvedValue(tipo);
  vi.mocked(repo.actualizarTipo).mockResolvedValue(tipo);
  vi.mocked(repo.eliminarTipo).mockResolvedValue(true);
});

function esperarError(codigo: string, statusCode: number) {
  return expect.objectContaining({ code: codigo, statusCode });
}

describe('catalogos: departamentos', () => {
  it('lista y crea delegando en el repositorio', async () => {
    vi.mocked(repo.listarDepartamentos).mockResolvedValue([departamento]);
    expect(await servicio.listarDepartamentos()).toEqual([departamento]);
    expect(repo.listarDepartamentos).toHaveBeenCalled();

    await servicio.crearDepartamento({ nombre: 'Bogotá D.C.' });
    expect(repo.crearDepartamento).toHaveBeenCalledWith('Bogotá D.C.');
  });

  it('actualizar exige nombre y 404 si no existe', async () => {
    await expect(servicio.actualizarDepartamento(1, {})).rejects.toMatchObject(
      esperarError('SIN_CAMBIOS', 400),
    );

    vi.mocked(repo.actualizarDepartamento).mockResolvedValue(undefined);
    await expect(
      servicio.actualizarDepartamento(1, { nombre: 'Nuevo' }),
    ).rejects.toMatchObject(esperarError('DEPARTAMENTO_NO_ENCONTRADO', 404));

    vi.mocked(repo.actualizarDepartamento).mockResolvedValue(departamento);
    expect(await servicio.actualizarDepartamento(1, { nombre: 'Nuevo' })).toEqual(departamento);
  });

  it('eliminar 404 si no borro nada', async () => {
    vi.mocked(repo.eliminarDepartamento).mockResolvedValue(false);
    await expect(servicio.eliminarDepartamento(1)).rejects.toMatchObject(
      esperarError('DEPARTAMENTO_NO_ENCONTRADO', 404),
    );
    vi.mocked(repo.eliminarDepartamento).mockResolvedValue(true);
    await servicio.eliminarDepartamento(1);
    expect(repo.eliminarDepartamento).toHaveBeenCalledWith(1);
  });
});

describe('catalogos: ciudades', () => {
  it('lista con el filtro opcional de departamento', async () => {
    vi.mocked(repo.listarCiudades).mockResolvedValue([ciudad]);
    await servicio.listarCiudades({ departamento: 1 });
    expect(repo.listarCiudades).toHaveBeenCalledWith(1);
  });

  it('crear exige un departamento existente', async () => {
    vi.mocked(repo.buscarDepartamento).mockResolvedValue(undefined);
    await expect(
      servicio.crearCiudad({ nombre: 'X', id_departamento: 99 }),
    ).rejects.toMatchObject(esperarError('DEPARTAMENTO_INVALIDO', 400));
    expect(repo.crearCiudad).not.toHaveBeenCalled();
  });

  it('crear delega cuando el departamento existe', async () => {
    const resultado = await servicio.crearCiudad({ nombre: 'Bogotá D.C.', id_departamento: 1 });
    expect(repo.crearCiudad).toHaveBeenCalledWith({
      nombre: 'Bogotá D.C.',
      idDepartamento: 1,
    });
    expect(resultado).toEqual(ciudad);
  });

  it('actualizar 404 si la ciudad no existe', async () => {
    vi.mocked(repo.buscarCiudad).mockResolvedValue(undefined);
    await expect(servicio.actualizarCiudad(1, { nombre: 'X' })).rejects.toMatchObject(
      esperarError('CIUDAD_NO_ENCONTRADA', 404),
    );
  });

  it('actualizar valida el nuevo departamento y 404 si el update no devuelve fila', async () => {
    vi.mocked(repo.buscarDepartamento).mockResolvedValue(undefined);
    await expect(
      servicio.actualizarCiudad(1, { id_departamento: 9 }),
    ).rejects.toMatchObject(esperarError('DEPARTAMENTO_INVALIDO', 400));

    vi.mocked(repo.buscarDepartamento).mockResolvedValue({ id: 1, nombre: 'Bogotá D.C.' });
    vi.mocked(repo.actualizarCiudad).mockResolvedValue(undefined);
    await expect(
      servicio.actualizarCiudad(1, { id_departamento: 1 }),
    ).rejects.toMatchObject(esperarError('CIUDAD_NO_ENCONTRADA', 404));
  });

  it('eliminar 404 si no borro nada', async () => {
    vi.mocked(repo.eliminarCiudad).mockResolvedValue(false);
    await expect(servicio.eliminarCiudad(1)).rejects.toMatchObject(
      esperarError('CIUDAD_NO_ENCONTRADA', 404),
    );
    vi.mocked(repo.eliminarCiudad).mockResolvedValue(true);
    await servicio.eliminarCiudad(1);
    expect(repo.eliminarCiudad).toHaveBeenCalledWith(1);
  });
});

describe('catalogos: tipos de inmueble', () => {
  it('lista y crea delegando', async () => {
    vi.mocked(repo.listarTipos).mockResolvedValue([tipo]);
    expect(await servicio.listarTipos()).toEqual([tipo]);
    await servicio.crearTipo({ nombre: 'Apartamento' });
    expect(repo.crearTipo).toHaveBeenCalledWith('Apartamento');
  });

  it('actualizar exige nombre y 404 si no existe', async () => {
    await expect(servicio.actualizarTipo(1, {})).rejects.toMatchObject(
      esperarError('SIN_CAMBIOS', 400),
    );

    vi.mocked(repo.actualizarTipo).mockResolvedValue(undefined);
    await expect(servicio.actualizarTipo(1, { nombre: 'X' })).rejects.toMatchObject(
      esperarError('TIPO_NO_ENCONTRADO', 404),
    );
  });

  it('eliminar 404 si no borro nada', async () => {
    vi.mocked(repo.eliminarTipo).mockResolvedValue(false);
    await expect(servicio.eliminarTipo(1)).rejects.toMatchObject(
      esperarError('TIPO_NO_ENCONTRADO', 404),
    );
    vi.mocked(repo.eliminarTipo).mockResolvedValue(true);
    await servicio.eliminarTipo(1);
    expect(repo.eliminarTipo).toHaveBeenCalledWith(1);
  });
});
