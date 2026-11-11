import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../src/modules/sistema/repository.js';
import { baseDeDatosDisponible } from '../../src/modules/sistema/service.js';

vi.mock('../../src/modules/sistema/repository.js', () => ({
  comprobarBaseDeDatos: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sistema service', () => {
  it('devuelve true si la base responde', async () => {
    vi.mocked(repo.comprobarBaseDeDatos).mockResolvedValue(undefined);
    await expect(baseDeDatosDisponible()).resolves.toBe(true);
  });

  it('devuelve false si la base falla (sin propagar el error)', async () => {
    vi.mocked(repo.comprobarBaseDeDatos).mockRejectedValue(new Error('caida'));
    await expect(baseDeDatosDisponible()).resolves.toBe(false);
  });
});
