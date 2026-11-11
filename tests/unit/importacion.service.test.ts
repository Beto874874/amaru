import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../src/modules/importacion/repository.js';
import { importarInmuebles } from '../../src/modules/importacion/service.js';

vi.mock('../../src/modules/importacion/repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof repo>();
  return {
    ...actual,
    cargarCatalogos: vi.fn(),
    listarCodigosSaeExistentes: vi.fn(),
    insertarInmuebles: vi.fn(),
  };
});

const CABECERA = [
  'id_categoria',
  'codigo_sae',
  'nombre_inmueble',
  'tipo_inmueble',
  'ciudad',
  'departamento',
  'direccion',
  'estrato',
  'valor_arriendo',
  'mas_admon',
  'en_home',
  'area_terreno',
  'area_construida',
  'iva',
  'nombre_contacto',
  'telefono_contacto',
  'direccion_contacto',
  'correo_contacto',
  'matricula_inmobiliaria',
  'estado_inmueble',
  'fecha_publicacion',
  'ubicacion_inferida',
  'alertas',
] as const;

type FilaCsv = Partial<Record<(typeof CABECERA)[number], string>>;

function fila(extra: FilaCsv = {}): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const columna of CABECERA) valores[columna] = '';
  return { ...valores, ...extra };
}

function celda(valor: string): string {
  return /[",\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor;
}

function armarCsv(filas: Record<string, string>[], columnas: readonly string[] = CABECERA): string {
  const lineas = [columnas.join(',')];
  for (const datos of filas) {
    lineas.push(columnas.map((columna) => celda(datos[columna] ?? '')).join(','));
  }
  return `${lineas.join('\n')}\n`;
}

const filaValida: FilaCsv = {
  id_categoria: '999',
  codigo_sae: 'SMOKE-1',
  tipo_inmueble: 'Garaje',
  ciudad: 'Bogotá D.C.',
  departamento: 'Bogotá D.C.',
  direccion: 'CL 119 A 57 60',
  estrato: '5',
  valor_arriendo: '3220000',
  mas_admon: 'true',
  en_home: 'false',
  area_construida: '12.5',
  iva: 'true',
  nombre_contacto: 'Contacto Uno',
  telefono_contacto: '2219023',
  direccion_contacto: 'KR 1',
  correo_contacto: 'CONTACTO@EJEMPLO.COM',
  matricula_inmobiliaria: 'MAT-IGNORADA',
  estado_inmueble: '',
  fecha_publicacion: '2021-05-14 22:51:16',
  ubicacion_inferida: 'true',
  alertas: 'garaje_con_precio_alto; otra; ',
};

const filaSinContacto: FilaCsv = {
  codigo_sae: 'SMOKE-2',
  tipo_inmueble: 'Apartamento',
  departamento: 'Bogotá D.C.',
  direccion: 'CL 2',
  estado_inmueble: 'Arrendado',
  fecha_publicacion: '',
  alertas: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.cargarCatalogos).mockResolvedValue({
    tipos: new Map([
      ['Garaje', 7],
      ['Apartamento', 8],
    ]),
    departamentos: new Map([
      ['Bogotá D.C.', 3],
      ['Antioquia', 2],
    ]),
    ciudades: new Map([
      [repo.claveCiudad(3, 'Bogotá D.C.'), 4],
      [repo.claveCiudad(2, 'Medellín'), 5],
    ]),
  });
  vi.mocked(repo.listarCodigosSaeExistentes).mockResolvedValue(new Set());
  vi.mocked(repo.insertarInmuebles).mockResolvedValue(1);
});

describe('importarInmuebles: archivo valido', () => {
  it('mapea las filas, transforma fechas/booleanos y no inserta nada de mas', async () => {
    vi.mocked(repo.insertarInmuebles).mockResolvedValue(2);
    const csv = armarCsv([fila(filaValida), fila(filaSinContacto)]);

    const resultado = await importarInmuebles(5, Buffer.from(`\uFEFF${csv}`, 'utf8'));

    expect(resultado).toEqual({ insertados: 2, omitidos: 0 });
    expect(repo.cargarCatalogos).toHaveBeenCalledTimes(1);
    expect(repo.listarCodigosSaeExistentes).toHaveBeenCalledWith(['SMOKE-1', 'SMOKE-2']);

    const llamada = vi.mocked(repo.insertarInmuebles).mock.calls[0];
    expect(llamada?.[0]).toBe(5);
    const filas = llamada?.[1] ?? [];
    expect(filas).toHaveLength(2);

    const [uno, dos] = filas;
    expect(uno).toMatchObject({
      codigoSae: 'SMOKE-1',
      nombreInmueble: 'Garaje - SMOKE-1',
      idTipo: 7,
      idDepartamento: 3,
      idCiudad: 4,
      direccion: 'CL 119 A 57 60',
      estrato: 5,
      valorArriendo: 3_220_000,
      areaTerreno: null,
      areaConstruida: 12.5,
      masAdmon: true,
      enHome: false,
      iva: true,
      estado: 'Disponible',
      ubicacionInferida: true,
      alertas: ['garaje_con_precio_alto', 'otra'],
      contacto: {
        nombre: 'Contacto Uno',
        telefono: '2219023',
        direccion: 'KR 1',
        correo: 'contacto@ejemplo.com',
      },
    });
    expect(uno?.fechaPublicacion.toISOString()).toBe('2021-05-15T03:51:16.000Z');
    expect(uno).not.toHaveProperty('matriculaInmobiliaria');
    expect(uno).not.toHaveProperty('id_categoria');

    expect(dos).toMatchObject({
      codigoSae: 'SMOKE-2',
      nombreInmueble: 'Apartamento - SMOKE-2',
      idTipo: 8,
      idDepartamento: 3,
      idCiudad: null,
      areaTerreno: null,
      areaConstruida: null,
      masAdmon: false,
      enHome: false,
      iva: false,
      estado: 'Arrendado',
      ubicacionInferida: false,
      alertas: [],
      contacto: null,
    });
    expect(dos?.fechaPublicacion).toBeInstanceOf(Date);
    expect(Math.abs((dos?.fechaPublicacion.getTime() ?? 0) - Date.now())).toBeLessThan(5_000);
  });

  it('ignora columnas desconocidas del CSV', async () => {
    const columnas = [...CABECERA, 'columna_extra'];
    const csv = armarCsv([{ ...fila(filaSinContacto), columna_extra: 'ignorar' }], columnas);

    await importarInmuebles(1, Buffer.from(csv));
    expect(repo.insertarInmuebles).toHaveBeenCalledTimes(1);
  });

  it('acepta un CSV con solo las columnas obligatorias', async () => {
    const columnas = ['codigo_sae', 'tipo_inmueble', 'departamento', 'direccion'];
    const csv = armarCsv(
      [
        {
          codigo_sae: 'MIN-1',
          tipo_inmueble: 'Garaje',
          departamento: 'Bogotá D.C.',
          direccion: 'CL 1',
        },
      ],
      columnas,
    );

    await importarInmuebles(1, Buffer.from(csv));
    expect(repo.insertarInmuebles).toHaveBeenCalledWith(
      1,
      [expect.objectContaining({ codigoSae: 'MIN-1', nombreInmueble: 'Garaje - MIN-1' })],
    );
  });
});

describe('importarInmuebles: errores del archivo (400)', () => {
  it('rechaza un CSV vacio (solo cabecera)', async () => {
    await expect(importarInmuebles(1, Buffer.from(`${CABECERA.join(',')}\n`))).rejects.toMatchObject(
      { code: 'CSV_VACIO', statusCode: 400 },
    );
  });

  it('rechaza un archivo que no es CSV', async () => {
    const roto = Buffer.from(
      'codigo_sae,tipo_inmueble,departamento,direccion\n"sin cerrar,x,y,z\n',
    );
    await expect(importarInmuebles(1, roto)).rejects.toMatchObject({
      code: 'CSV_INVALIDO',
      statusCode: 400,
    });
  });

  it('exige las cuatro columnas obligatorias', async () => {
    const csv = armarCsv([{ codigo_sae: 'X', direccion: 'CL 1' }], [
      'codigo_sae',
      'direccion',
    ]);
    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toThrow(
      'Faltan columnas obligatorias en el CSV: tipo_inmueble, departamento',
    );
  });
});

describe('importarInmuebles: politica todo o nada (422)', () => {
  it('una fila invalida impide insertar las validas', async () => {
    const csv = armarCsv([
      fila(filaValida),
      fila({ ...filaSinContacto, tipo_inmueble: 'TipoInexistente' }),
    ]);

    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toMatchObject({
      code: 'IMPORTACION_INVALIDA',
      statusCode: 422,
      details: [
        expect.objectContaining({
          fila: 3,
          campo: 'tipo_inmueble',
          mensaje: expect.stringContaining('TipoInexistente'),
        }),
      ],
    });
    expect(repo.insertarInmuebles).not.toHaveBeenCalled();
  });

  it('rechaza un tipo de inmueble desconocido', async () => {
    const csv = armarCsv([fila({ ...filaSinContacto, tipo_inmueble: 'Castillo' })]);
    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toMatchObject({
      details: [expect.objectContaining({ campo: 'tipo_inmueble' })],
    });
  });

  it('rechaza un departamento desconocido', async () => {
    const csv = armarCsv([fila({ ...filaSinContacto, departamento: 'Marte' })]);
    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toMatchObject({
      details: [expect.objectContaining({ campo: 'departamento' })],
    });
  });

  it('rechaza una ciudad que no pertenece al departamento', async () => {
    const csv = armarCsv([
      fila({ ...filaSinContacto, ciudad: 'Medellín', departamento: 'Bogotá D.C.' }),
    ]);
    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toMatchObject({
      details: [
        expect.objectContaining({
          campo: 'ciudad',
          mensaje: expect.stringContaining('no existe en el departamento'),
        }),
      ],
    });
  });

  it('rechaza un codigo_sae que ya existe en la base', async () => {
    vi.mocked(repo.listarCodigosSaeExistentes).mockResolvedValue(new Set(['SMOKE-1']));
    const csv = armarCsv([fila(filaValida)]);

    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toMatchObject({
      details: [
        expect.objectContaining({
          fila: 2,
          campo: 'codigo_sae',
          mensaje: expect.stringContaining('ya existe en la base'),
        }),
      ],
    });
    expect(repo.insertarInmuebles).not.toHaveBeenCalled();
  });

  it('rechaza un codigo_sae repetido dentro del archivo', async () => {
    const csv = armarCsv([
      fila({ ...filaSinContacto, codigo_sae: 'REP-1' }),
      fila({ ...filaSinContacto, codigo_sae: 'REP-1' }),
    ]);

    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toMatchObject({
      details: [
        expect.objectContaining({
          fila: 3,
          campo: 'codigo_sae',
          mensaje: expect.stringContaining('repetido en el archivo (fila 2)'),
        }),
      ],
    });
    expect(repo.insertarInmuebles).not.toHaveBeenCalled();
  });

  it('rechaza una fecha invalida', async () => {
    const csv = armarCsv([
      fila({ ...filaSinContacto, fecha_publicacion: '2021-02-30 10:00:00' }),
    ]);
    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toMatchObject({
      details: [
        expect.objectContaining({
          campo: 'fecha_publicacion',
          mensaje: expect.stringContaining('YYYY-MM-DD HH:mm:ss'),
        }),
      ],
    });
  });

  it('rechaza un booleano que no es true/false', async () => {
    const csv = armarCsv([fila({ ...filaSinContacto, mas_admon: 'si' })]);
    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toMatchObject({
      details: [expect.objectContaining({ campo: 'mas_admon' })],
    });
  });

  it('no consulta catalogos si todas las filas fallan por formato', async () => {
    const csv = armarCsv([fila({ departamento: '', direccion: '' })]);
    await expect(importarInmuebles(1, Buffer.from(csv))).rejects.toMatchObject({
      code: 'IMPORTACION_INVALIDA',
    });
    expect(repo.cargarCatalogos).not.toHaveBeenCalled();
    expect(repo.listarCodigosSaeExistentes).not.toHaveBeenCalled();
  });

  it('limita la lista a 100 errores pero informa todas las filas malas', async () => {
    const filas: Record<string, string>[] = [];
    for (let i = 0; i < 105; i += 1) {
      filas.push(
        fila({ ...filaSinContacto, codigo_sae: `MALO-${i}`, tipo_inmueble: 'NoExiste' }),
      );
    }
    const csv = armarCsv(filas);

    let capturado: unknown;
    try {
      await importarInmuebles(1, Buffer.from(csv));
    } catch (error) {
      capturado = error;
    }

    expect(capturado).toMatchObject({
      code: 'IMPORTACION_INVALIDA',
      statusCode: 422,
      message: expect.stringContaining('105 fila(s)'),
    });
    const detalles = (capturado as { details?: unknown[] }).details ?? [];
    expect(detalles).toHaveLength(100);
    expect(detalles[0]).toMatchObject({ fila: 2, campo: 'tipo_inmueble' });
    expect(detalles[99]).toMatchObject({ fila: 101, campo: 'tipo_inmueble' });
    expect(repo.insertarInmuebles).not.toHaveBeenCalled();
  });
});
