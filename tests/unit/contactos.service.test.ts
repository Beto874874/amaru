import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../src/modules/contactos/repository.js';
import * as servicio from '../../src/modules/contactos/service.js';

vi.mock('../../src/modules/contactos/repository.js', () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarOCrear: vi.fn(),
  actualizar: vi.fn(),
  eliminar: vi.fn(),
}));

const contacto = {
  id: 4,
  nombre: 'Inmobiliaria',
  telefono: '123',
  direccion: 'CL 1',
  correo: 'contacto@ejemplo.com',
};

function esperarError(codigo: string, statusCode: number) {
  return expect.objectContaining({ code: codigo, statusCode });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.buscarPorId).mockResolvedValue(contacto);
  vi.mocked(repo.buscarOCrear).mockResolvedValue({ contacto, creado: true });
  vi.mocked(repo.actualizar).mockResolvedValue(contacto);
  vi.mocked(repo.eliminar).mockResolvedValue(true);
  vi.mocked(repo.listar).mockResolvedValue({ filas: [contacto], total: 1 });
});

describe('contactos service', () => {
  it('lista con offset, limite y meta', async () => {
    const resultado = await servicio.listar({ page: 2, limit: 10, q: 'inmo' });
    expect(repo.listar).toHaveBeenCalledWith({ q: 'inmo' }, { offset: 10, limit: 10 });
    expect(resultado.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(resultado.data[0]).toEqual(contacto);
  });

  it('obtener 404 si no existe', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(undefined);
    await expect(servicio.obtener(1)).rejects.toMatchObject(
      esperarError('CONTACTO_NO_ENCONTRADO', 404),
    );
  });

  it('obtener devuelve el DTO', async () => {
    expect(await servicio.obtener(4)).toEqual(contacto);
  });

  it('crear busca o crea y conserva los nulos', async () => {
    vi.mocked(repo.buscarOCrear).mockResolvedValue({ contacto, creado: false });
    const resultado = await servicio.crear({ nombre: 'Inmobiliaria' });

    expect(repo.buscarOCrear).toHaveBeenCalledWith({
      nombre: 'Inmobiliaria',
      telefono: null,
      direccion: null,
      correo: null,
    });
    expect(resultado).toEqual({ contacto, creado: false });
  });

  it('actualizar 404 si no existe', async () => {
    vi.mocked(repo.actualizar).mockResolvedValue(undefined);
    await expect(servicio.actualizar(1, { nombre: 'X' })).rejects.toMatchObject(
      esperarError('CONTACTO_NO_ENCONTRADO', 404),
    );
  });

  it('actualizar delega los campos opcionales', async () => {
    await servicio.actualizar(4, { telefono: null });
    expect(repo.actualizar).toHaveBeenCalledWith(4, {
      nombre: undefined,
      telefono: null,
      direccion: undefined,
      correo: undefined,
    });
  });

  it('eliminar 404 si no borro nada y delega si borro', async () => {
    vi.mocked(repo.eliminar).mockResolvedValue(false);
    await expect(servicio.eliminar(1)).rejects.toMatchObject(
      esperarError('CONTACTO_NO_ENCONTRADO', 404),
    );

    vi.mocked(repo.eliminar).mockResolvedValue(true);
    await servicio.eliminar(4);
    expect(repo.eliminar).toHaveBeenCalledWith(4);
  });
});
