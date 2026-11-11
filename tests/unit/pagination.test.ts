import { describe, expect, it } from 'vitest';
import {
  calcularOffset,
  construirMeta,
  paginacionSchema,
} from '../../src/shared/pagination.js';

describe('paginacion', () => {
  it('aplica valores por defecto', () => {
    expect(paginacionSchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('convierte strings de query a numeros', () => {
    expect(paginacionSchema.parse({ page: '3', limit: '50' })).toEqual({
      page: 3,
      limit: 50,
    });
  });

  it('rechaza page < 1, limit < 1 y limit > 100', () => {
    expect(paginacionSchema.safeParse({ page: '0' }).success).toBe(false);
    expect(paginacionSchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(paginacionSchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(paginacionSchema.safeParse({ page: '1.5' }).success).toBe(false);
  });

  it('calcula el offset', () => {
    expect(calcularOffset({ page: 1, limit: 20 })).toBe(0);
    expect(calcularOffset({ page: 3, limit: 20 })).toBe(40);
  });

  it('construye la meta con redondeo hacia arriba', () => {
    expect(construirMeta({ page: 2, limit: 10 }, 25)).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it('total 0 produce totalPages 0', () => {
    expect(construirMeta({ page: 1, limit: 20 }, 0)).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });
});
