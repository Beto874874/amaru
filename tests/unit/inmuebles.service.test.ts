import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../src/modules/inmuebles/repository.js';
import {
  actualizarInmuebleSchema,
  crearInmuebleSchema,
  listarInmueblesSchema,
} from '../../src/modules/inmuebles/schemas.js';
import * as servicio from '../../src/modules/inmuebles/service.js';

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

function fila(overrides: Partial<repo.InmuebleConRelaciones> = {}): repo.InmuebleConRelaciones {
  return {
    id_inmueble: 1,
    codigo_sae: 'X-1',
    nombre_inmueble: 'Casa - X-1',
    direccion: 'CL 1',
    estrato: 3,
    valor_arriendo: 1_000_000,
    area_terreno: null,
    area_construida: 50,
    mas_admon: false,
    en_home: false,
    iva: false,
    pagina_web: null,
    estado: 'Disponible',
    ubicacion_inferida: false,
    alertas: [],
    fecha_publicacion: new Date('2024-01-01T00:00:00.000Z'),
    id_departamento: 1,
    id_ciudad: 1,
    id_tipo: 1,
    id_usuario: 1,
    tipo: 'Casa',
    departamento: 'Bogotá D.C.',
    ciudad: 'Bogotá D.C.',
    contacto_nombre: null,
    contacto_telefono: null,
    contacto_direccion: null,
    contacto_correo: null,
    ...overrides,
  };
}

const baseCrear = {
  codigo_sae: 'X-1',
  tipo_inmueble: 'Casa',
  departamento: 'Bogotá D.C.',
  direccion: 'CL 1',
};

function inputCrear(extra: Record<string, unknown> = {}) {
  return crearInmuebleSchema.parse({ ...baseCrear, ...extra });
}

function esperarError(codigo: string, statusCode: number) {
  return expect.objectContaining({ code: codigo, statusCode });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.buscarTipoPorNombre).mockResolvedValue({ id: 2, nombre: 'Casa' });
  vi.mocked(repo.buscarDepartamentoPorNombre).mockResolvedValue({
    id: 3,
    nombre: 'Bogotá D.C.',
  });
  vi.mocked(repo.buscarCiudadPorNombre).mockResolvedValue({
    id: 4,
    nombre: 'Bogotá D.C.',
    idDepartamento: 3,
  });
  vi.mocked(repo.crearInmueble).mockResolvedValue(fila());
  vi.mocked(repo.actualizarInmueble).mockResolvedValue(fila());
  vi.mocked(repo.eliminarInmueble).mockResolvedValue(true);
  vi.mocked(repo.listar).mockResolvedValue({ filas: [fila()], total: 1 });
});

describe('crear inmueble', () => {
  it('resuelve los nombres del catalogo a ids y genera el nombre por defecto', async () => {
    vi.mocked(repo.crearInmueble).mockResolvedValue(fila({ id_usuario: 10 }));
    const resultado = await servicio.crear(10, inputCrear());

    expect(repo.buscarTipoPorNombre).toHaveBeenCalledWith('Casa');
    expect(repo.buscarDepartamentoPorNombre).toHaveBeenCalledWith('Bogotá D.C.');
    expect(repo.crearInmueble).toHaveBeenCalledWith(
      expect.objectContaining({
        codigoSae: 'X-1',
        nombreInmueble: 'Casa - X-1',
        idTipo: 2,
        idDepartamento: 3,
        idCiudad: null,
        idUsuario: 10,
        estrato: null,
        valorArriendo: null,
        masAdmon: false,
        enHome: false,
        iva: false,
        estado: 'Disponible',
        contacto: null,
      }),
    );

    expect(resultado).not.toHaveProperty('id_usuario');
    expect(resultado.publicado_por_usuario).toBe(true);
    expect(resultado.es_mio).toBe(true);
  });

  it('respeta el nombre enviado y crea el contacto con sus datos', async () => {
    await servicio.crear(
      10,
      inputCrear({
        nombre_inmueble: 'Mi casa',
        nombre_contacto: '  Inmobiliaria  ',
        telefono_contacto: ' 123 ',
        correo_contacto: '  CONTACTO@EJEMPLO.COM ',
      }),
    );

    expect(repo.crearInmueble).toHaveBeenCalledWith(
      expect.objectContaining({
        nombreInmueble: 'Mi casa',
        contacto: {
          nombre: 'Inmobiliaria',
          telefono: '123',
          direccion: null,
          correo: 'contacto@ejemplo.com',
        },
      }),
    );
  });

  it('sin ciudad no consulta ciudades y envia idCiudad null', async () => {
    await servicio.crear(10, inputCrear());
    expect(repo.buscarCiudadPorNombre).not.toHaveBeenCalled();
    expect(repo.crearInmueble).toHaveBeenCalledWith(
      expect.objectContaining({ idCiudad: null }),
    );
  });

  it('con ciudad la resuelve dentro del departamento', async () => {
    await servicio.crear(10, inputCrear({ ciudad: 'Bogotá D.C.' }));
    expect(repo.buscarCiudadPorNombre).toHaveBeenCalledWith(3, 'Bogotá D.C.');
    expect(repo.crearInmueble).toHaveBeenCalledWith(
      expect.objectContaining({ idCiudad: 4 }),
    );
  });

  it('devuelve 400 TIPO_INVALIDO con la lista de tipos validos', async () => {
    vi.mocked(repo.buscarTipoPorNombre).mockResolvedValue(undefined);
    vi.mocked(repo.listarNombresTipos).mockResolvedValue(['Casa', 'Oficina']);

    await expect(servicio.crear(10, inputCrear())).rejects.toMatchObject(
      esperarError('TIPO_INVALIDO', 400),
    );
    await expect(servicio.crear(10, inputCrear())).rejects.toThrow(
      'Tipos validos: Casa, Oficina',
    );
    expect(repo.crearInmueble).not.toHaveBeenCalled();
  });

  it('devuelve 400 DEPARTAMENTO_INVALIDO con la lista de departamentos', async () => {
    vi.mocked(repo.buscarDepartamentoPorNombre).mockResolvedValue(undefined);
    vi.mocked(repo.listarNombresDepartamentos).mockResolvedValue(['Antioquia', 'Cundinamarca']);

    await expect(servicio.crear(10, inputCrear())).rejects.toMatchObject(
      esperarError('DEPARTAMENTO_INVALIDO', 400),
    );
    expect(repo.crearInmueble).not.toHaveBeenCalled();
  });

  it('devuelve 400 CIUDAD_INVALIDA si la ciudad no existe en el departamento', async () => {
    vi.mocked(repo.buscarCiudadPorNombre).mockResolvedValue(undefined);

    await expect(
      servicio.crear(10, inputCrear({ ciudad: 'Medellín' })),
    ).rejects.toMatchObject(esperarError('CIUDAD_INVALIDA', 400));
    expect(repo.buscarCiudadPorNombre).toHaveBeenCalledWith(3, 'Medellín');
    expect(repo.crearInmueble).not.toHaveBeenCalled();
  });
});

describe('actualizar inmueble: regla dueno/admin', () => {
  it('404 si el inmueble no existe', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(undefined);
    await expect(
      servicio.actualizar({ id: 1, rol: 'usuario' }, 1, { codigo_sae: 'X' }),
    ).rejects.toMatchObject(esperarError('INMUEBLE_NO_ENCONTRADO', 404));
  });

  it('403 si el usuario no es el dueno ni admin', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(fila({ id_usuario: 2 }));
    await expect(
      servicio.actualizar({ id: 1, rol: 'usuario' }, 1, { codigo_sae: 'X' }),
    ).rejects.toMatchObject(esperarError('PROHIBIDO', 403));
    expect(repo.actualizarInmueble).not.toHaveBeenCalled();
  });

  it('403 para un inmueble importado (id_usuario NULL) si no es admin', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(fila({ id_usuario: null }));
    await expect(
      servicio.actualizar({ id: 1, rol: 'usuario' }, 1, { codigo_sae: 'X' }),
    ).rejects.toMatchObject(esperarError('PROHIBIDO', 403));
  });

  it('el dueno puede actualizar', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(fila({ id_usuario: 5 }));
    await servicio.actualizar({ id: 5, rol: 'usuario' }, 1, { nombre_inmueble: 'Nuevo' });
    expect(repo.actualizarInmueble).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nombreInmueble: 'Nuevo' }),
    );
  });

  it('un admin puede actualizar inmuebles del CSV y de otros', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(fila({ id_usuario: null }));
    vi.mocked(repo.actualizarInmueble).mockResolvedValue(fila({ id_usuario: null }));
    const resultado = await servicio.actualizar(
      { id: 1, rol: 'admin' },
      1,
      { nombre_inmueble: 'Nuevo' },
    );
    expect(resultado).not.toHaveProperty('id_usuario');
    expect(resultado.es_mio).toBe(false);
  });
});

describe('actualizar inmueble: semantica de PATCH', () => {
  it('null vacia los campos opcionales y quita el contacto', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(
      fila({
        contacto_nombre: 'Viejo',
        contacto_telefono: '111',
        contacto_direccion: 'Dir',
        contacto_correo: 'viejo@ejemplo.com',
      }),
    );

    await servicio.actualizar(
      { id: 1, rol: 'usuario' },
      1,
      actualizarInmuebleSchema.parse({
        ciudad: null,
        estrato: null,
        valor_arriendo: null,
        area_construida: null,
        pagina_web: null,
        nombre_contacto: null,
      }),
    );

    expect(repo.actualizarInmueble).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        idCiudad: null,
        estrato: null,
        valorArriendo: null,
        areaConstruida: null,
        paginaWeb: null,
        contacto: null,
      }),
    );
  });

  it('al cambiar de ciudad la valida contra el departamento final', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(fila({ id_departamento: 3 }));
    vi.mocked(repo.buscarCiudadPorNombre).mockResolvedValue({
      id: 9,
      nombre: 'Medellín',
      idDepartamento: 3,
    });

    await servicio.actualizar(
      { id: 1, rol: 'usuario' },
      1,
      actualizarInmuebleSchema.parse({ ciudad: 'Medellín' }),
    );

    expect(repo.buscarCiudadPorNombre).toHaveBeenCalledWith(3, 'Medellín');
    expect(repo.actualizarInmueble).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ idCiudad: 9 }),
    );
  });

  it('si solo cambia el departamento y la ciudad actual no pertenece, 400', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(
      fila({ id_departamento: 1, id_ciudad: 1 }),
    );
    vi.mocked(repo.buscarDepartamentoPorNombre).mockResolvedValue({
      id: 2,
      nombre: 'Antioquia',
    });
    vi.mocked(repo.buscarCiudadPorId).mockResolvedValue({
      id: 1,
      nombre: 'Bogotá D.C.',
      idDepartamento: 1,
    });

    await expect(
      servicio.actualizar(
        { id: 1, rol: 'usuario' },
        1,
        actualizarInmuebleSchema.parse({ departamento: 'Antioquia' }),
      ),
    ).rejects.toMatchObject(esperarError('CIUDAD_INVALIDA', 400));
    expect(repo.actualizarInmueble).not.toHaveBeenCalled();
  });

  it('si solo cambia el departamento y la ciudad sigue siendo valida, no la toca', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(
      fila({ id_departamento: 1, id_ciudad: 1 }),
    );
    vi.mocked(repo.buscarDepartamentoPorNombre).mockResolvedValue({
      id: 2,
      nombre: 'Antioquia',
    });
    vi.mocked(repo.buscarCiudadPorId).mockResolvedValue({
      id: 1,
      nombre: 'Medellín',
      idDepartamento: 2,
    });

    await servicio.actualizar(
      { id: 1, rol: 'usuario' },
      1,
      actualizarInmuebleSchema.parse({ departamento: 'Antioquia' }),
    );

    const cambios = vi.mocked(repo.actualizarInmueble).mock.calls[0]?.[1];
    expect(cambios?.idDepartamento).toBe(2);
    expect(cambios?.idCiudad).toBeUndefined();
  });

  it('completa los datos del contacto con los actuales y crea uno nuevo', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(
      fila({
        contacto_nombre: 'Viejo',
        contacto_telefono: '111',
        contacto_direccion: 'Dir',
        contacto_correo: 'viejo@ejemplo.com',
      }),
    );

    await servicio.actualizar(
      { id: 1, rol: 'usuario' },
      1,
      actualizarInmuebleSchema.parse({ telefono_contacto: '222' }),
    );

    expect(repo.actualizarInmueble).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        contacto: {
          nombre: 'Viejo',
          telefono: '222',
          direccion: 'Dir',
          correo: 'viejo@ejemplo.com',
        },
      }),
    );
  });

  it('no permite datos de contacto sin nombre si el inmueble no tenia contacto', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(fila());

    await expect(
      servicio.actualizar(
        { id: 1, rol: 'usuario' },
        1,
        actualizarInmuebleSchema.parse({ telefono_contacto: '222' }),
      ),
    ).rejects.toMatchObject(esperarError('DATOS_INCOMPLETOS', 400));
    expect(repo.actualizarInmueble).not.toHaveBeenCalled();
  });
});

describe('obtener y eliminar', () => {
  it('obtener devuelve es_mio segun el solicitante y nunca id_usuario', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(fila({ id_usuario: 5 }));

    const mio = await servicio.obtener(1, 5);
    expect(mio.es_mio).toBe(true);
    expect(mio.publicado_por_usuario).toBe(true);
    expect(mio).not.toHaveProperty('id_usuario');

    const ajeno = await servicio.obtener(1, 6);
    expect(ajeno.es_mio).toBe(false);

    const publico = await servicio.obtener(1);
    expect(publico.es_mio).toBe(false);
  });

  it('obtener 404 si no existe', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(undefined);
    await expect(servicio.obtener(1)).rejects.toMatchObject(
      esperarError('INMUEBLE_NO_ENCONTRADO', 404),
    );
  });

  it('eliminar respeta dueno/admin y borra', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(fila({ id_usuario: 2 }));

    await expect(servicio.eliminar({ id: 1, rol: 'usuario' }, 1)).rejects.toMatchObject(
      esperarError('PROHIBIDO', 403),
    );
    expect(repo.eliminarInmueble).not.toHaveBeenCalled();

    await servicio.eliminar({ id: 2, rol: 'usuario' }, 1);
    expect(repo.eliminarInmueble).toHaveBeenCalledWith(1);

    vi.mocked(repo.eliminarInmueble).mockClear();
    await servicio.eliminar({ id: 99, rol: 'admin' }, 1);
    expect(repo.eliminarInmueble).toHaveBeenCalledWith(1);
  });

  it('eliminar 404 si no existe', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(undefined);
    await expect(servicio.eliminar({ id: 1, rol: 'admin' }, 1)).rejects.toMatchObject(
      esperarError('INMUEBLE_NO_ENCONTRADO', 404),
    );
  });
});

describe('listar inmuebles', () => {
  it('mias sin sesion responde 401', async () => {
    await expect(
      servicio.listar(listarInmueblesSchema.parse({ mias: 'true' })),
    ).rejects.toMatchObject(esperarError('NO_AUTENTICADO', 401));
    expect(repo.listar).not.toHaveBeenCalled();
  });

  it('mapea filtros, offset y meta de paginacion', async () => {
    vi.mocked(repo.listar).mockResolvedValue({
      filas: [fila({ id_inmueble: 1 }), fila({ id_inmueble: 2 })],
      total: 25,
    });

    const resultado = await servicio.listar(
      listarInmueblesSchema.parse({
        page: '2',
        limit: '10',
        departamento: '3',
        ciudad: '4',
        tipo: '2',
        estrato: '4',
        valor_min: '100',
        valor_max: '200',
        area_min: '10',
        area_max: '90',
        q: 'bogota',
        mias: 'true',
      }),
      7,
    );

    expect(repo.listar).toHaveBeenCalledWith(
      {
        departamento: 3,
        ciudad: 4,
        tipo: 2,
        estrato: 4,
        valorMin: 100,
        valorMax: 200,
        areaMin: 10,
        areaMax: 90,
        estado: 'Disponible',
        q: 'bogota',
        miasDe: 7,
      },
      { offset: 10, limit: 10 },
      { campo: 'fecha_publicacion', direccion: 'desc' },
    );

    expect(resultado.meta).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
    expect(resultado.data).toHaveLength(2);
    expect(resultado.data[0]).not.toHaveProperty('id_usuario');
  });

  it('sin sesion y sin mias es publico', async () => {
    const resultado = await servicio.listar(listarInmueblesSchema.parse({}));
    expect(resultado.meta.total).toBe(1);
    expect(repo.listar).toHaveBeenCalledWith(
      expect.objectContaining({ miasDe: undefined }),
      { offset: 0, limit: 20 },
      { campo: 'fecha_publicacion', direccion: 'desc' },
    );
  });
});
