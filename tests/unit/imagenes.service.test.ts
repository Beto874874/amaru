import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as storage from '../../src/infra/storage.js';
import * as repoInmuebles from '../../src/modules/inmuebles/repository.js';
import * as repo from '../../src/modules/imagenes/repository.js';
import { procesarImagen } from '../../src/modules/imagenes/procesar.js';
import * as servicio from '../../src/modules/imagenes/service.js';

vi.mock('../../src/modules/imagenes/repository.js', () => ({
  contarPorInmueble: vi.fn(),
  listarPorInmueble: vi.fn(),
  buscarPorIdEnInmueble: vi.fn(),
  listarRutasPorInmueble: vi.fn(),
  crearImagenes: vi.fn(),
  actualizarImagen: vi.fn(),
  eliminarImagen: vi.fn(),
}));

vi.mock('../../src/infra/storage.js', () => ({
  subir: vi.fn(),
  eliminar: vi.fn(),
  urlPublica: vi.fn((ruta: string) => `https://cdn.test/${ruta}`),
}));

vi.mock('../../src/modules/imagenes/procesar.js', () => ({
  procesarImagen: vi.fn(),
}));

// Se mockea el repository de inmuebles para poder ejecutar la autorizacion
// REAL de su service (asegurarPuedeModificar) sin base de datos.
vi.mock('../../src/modules/inmuebles/repository.js', () => ({
  buscarTipoPorNombre: vi.fn(),
  buscarDepartamentoPorNombre: vi.fn(),
  buscarCiudadPorNombre: vi.fn(),
  buscarCiudadPorId: vi.fn(),
  listarNombresTipos: vi.fn(),
  listarNombresDepartamentos: vi.fn(),
  crearInmueble: vi.fn(),
  buscarPorId: vi.fn(),
  actualizarInmueble: vi.fn(),
  eliminarInmueble: vi.fn(),
  listar: vi.fn(),
}));

const USUARIO = { id: 1, rol: 'usuario' as const };
const ID_INMUEBLE = 10;

function filaImagen(overrides: Partial<repo.ImagenFila> = {}): repo.ImagenFila {
  return {
    id_imagen: 1,
    id_inmueble: ID_INMUEBLE,
    ruta: `inmuebles/${ID_INMUEBLE}/a.webp`,
    ruta_miniatura: `inmuebles/${ID_INMUEBLE}/a_m.webp`,
    ancho: 1600,
    alto: 1000,
    bytes: 12_345,
    orden: 0,
    es_principal: true,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function archivo(indice: number): Express.Multer.File {
  return {
    originalname: `foto-${indice}.jpg`,
    mimetype: 'image/jpeg',
    buffer: Buffer.from(`foto-${indice}`),
  } as unknown as Express.Multer.File;
}

function inmuebleDe(usuarioId: number | null) {
  return { id_usuario: usuarioId } as unknown as repoInmuebles.InmuebleConRelaciones;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repoInmuebles.buscarPorId).mockResolvedValue(inmuebleDe(USUARIO.id));
  vi.mocked(repo.contarPorInmueble).mockResolvedValue(0);
  vi.mocked(procesarImagen).mockResolvedValue({
    grande: Buffer.from('grande'),
    miniatura: Buffer.from('miniatura'),
    ancho: 1600,
    alto: 1000,
    bytes: 10,
  });
  vi.mocked(storage.subir).mockResolvedValue();
  vi.mocked(storage.eliminar).mockResolvedValue();
});

describe('imagenes.service.subir', () => {
  it('rechaza con 400 IMAGEN_REQUERIDA si no llego ningun archivo', async () => {
    await expect(servicio.subir(USUARIO, ID_INMUEBLE, [])).rejects.toMatchObject({
      statusCode: 400,
      code: 'IMAGEN_REQUERIDA',
    });
    expect(repoInmuebles.buscarPorId).not.toHaveBeenCalled();
  });

  it('un usuario que no es dueno ni admin recibe 403', async () => {
    vi.mocked(repoInmuebles.buscarPorId).mockResolvedValue(inmuebleDe(999));

    await expect(servicio.subir(USUARIO, ID_INMUEBLE, [archivo(1)])).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROHIBIDO',
    });
    expect(procesarImagen).not.toHaveBeenCalled();
  });

  it('superar el maximo de 10 fotos da 409 LIMITE_IMAGENES', async () => {
    vi.mocked(repo.contarPorInmueble).mockResolvedValue(10);

    await expect(servicio.subir(USUARIO, ID_INMUEBLE, [archivo(1)])).rejects.toMatchObject({
      statusCode: 409,
      code: 'LIMITE_IMAGENES',
    });
    expect(procesarImagen).not.toHaveBeenCalled();
    expect(storage.subir).not.toHaveBeenCalled();
  });

  it('si falla la transaccion borra de Storage los archivos recien subidos', async () => {
    vi.mocked(repo.crearImagenes).mockRejectedValue(new Error('fallo de transaccion'));

    await expect(
      servicio.subir(USUARIO, ID_INMUEBLE, [archivo(1), archivo(2)]),
    ).rejects.toThrow('fallo de transaccion');

    expect(storage.subir).toHaveBeenCalledTimes(4);
    expect(storage.eliminar).toHaveBeenCalledTimes(1);

    const rutas = vi.mocked(storage.eliminar).mock.calls[0]?.[0] ?? [];
    expect(rutas).toHaveLength(4);
    for (const ruta of rutas) {
      expect(ruta).toMatch(new RegExp(`^inmuebles/${ID_INMUEBLE}/[0-9a-f-]+(_m)?\\.webp$`));
    }
  });

  it('devuelve las fotos creadas ordenadas y con URLs publicas', async () => {
    vi.mocked(repo.crearImagenes).mockResolvedValue({
      estado: 'ok',
      filas: [
        filaImagen({ id_imagen: 2, orden: 1, es_principal: false }),
        filaImagen({ id_imagen: 1, orden: 0, es_principal: true }),
      ],
    });

    const resultado = await servicio.subir(USUARIO, ID_INMUEBLE, [archivo(1)]);

    expect(resultado.map((imagen) => imagen.id)).toEqual([1, 2]);
    expect(resultado[0]).toMatchObject({
      id: 1,
      url: `https://cdn.test/inmuebles/${ID_INMUEBLE}/a.webp`,
      miniatura_url: `https://cdn.test/inmuebles/${ID_INMUEBLE}/a_m.webp`,
      es_principal: true,
    });
  });
});
