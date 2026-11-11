import { describe, expect, it, vi } from 'vitest';
import { aInmuebleDetalle, aInmueblePublico } from '../../src/modules/inmuebles/mapper.js';
import type { ImagenDeInmueble, InmuebleConRelaciones } from '../../src/modules/inmuebles/repository.js';

vi.mock('../../src/infra/storage.js', () => ({
  subir: vi.fn(),
  eliminar: vi.fn(),
  urlPublica: vi.fn((ruta: string) => `https://cdn.test/${ruta}`),
}));

function fila(overrides: Partial<InmuebleConRelaciones> = {}): InmuebleConRelaciones {
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
    imagen_principal_ruta: null,
    imagen_principal_ruta_miniatura: null,
    ...overrides,
  };
}

const IMAGEN: ImagenDeInmueble = {
  id_imagen: 7,
  ruta: 'inmuebles/1/a.webp',
  ruta_miniatura: 'inmuebles/1/a_m.webp',
  ancho: 1600,
  alto: 1000,
  orden: 0,
  es_principal: true,
};

describe('mapper de inmuebles con imagenes', () => {
  it('imagen_principal es null si el inmueble no tiene fotos', () => {
    const dto = aInmueblePublico(fila());

    expect(dto.imagen_principal).toBeNull();
    expect(dto).not.toHaveProperty('imagenes');
    expect(dto).not.toHaveProperty('id_usuario');
  });

  it('imagen_principal usa las URLs publicas de la fila principal', () => {
    const dto = aInmueblePublico(
      fila({
        imagen_principal_ruta: 'inmuebles/1/a.webp',
        imagen_principal_ruta_miniatura: 'inmuebles/1/a_m.webp',
      }),
    );

    expect(dto.imagen_principal).toEqual({
      url: 'https://cdn.test/inmuebles/1/a.webp',
      miniatura_url: 'https://cdn.test/inmuebles/1/a_m.webp',
    });
  });

  it('el detalle agrega el arreglo de imagenes sin rutas internas', () => {
    const detalle = aInmuebleDetalle(
      fila({
        imagen_principal_ruta: 'inmuebles/1/a.webp',
        imagen_principal_ruta_miniatura: 'inmuebles/1/a_m.webp',
      }),
      [IMAGEN],
      1,
    );

    expect(detalle.imagenes).toEqual([
      {
        id: 7,
        url: 'https://cdn.test/inmuebles/1/a.webp',
        miniatura_url: 'https://cdn.test/inmuebles/1/a_m.webp',
        ancho: 1600,
        alto: 1000,
        orden: 0,
        es_principal: true,
      },
    ]);
    expect(JSON.stringify(detalle)).not.toContain('id_inmueble');
    expect(detalle.es_mio).toBe(true);
  });
});
