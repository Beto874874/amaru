import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import {
  duracionAMs,
  firmarAccessToken,
  firmarRefreshToken,
  hashDeToken,
  tokenCoincideConHash,
  verificarAccessToken,
  verificarRefreshToken,
  VIDA_ACCESS_MS,
  VIDA_REFRESH_MS,
} from '../../src/modules/auth/tokens.js';

describe('duracionAMs', () => {
  it('convierte todas las unidades soportadas', () => {
    expect(duracionAMs('500ms')).toBe(500);
    expect(duracionAMs('30s')).toBe(30_000);
    expect(duracionAMs('15m')).toBe(900_000);
    expect(duracionAMs('2h')).toBe(7_200_000);
    expect(duracionAMs('7d')).toBe(604_800_000);
  });

  it('rechaza formatos invalidos', () => {
    expect(() => duracionAMs('15')).toThrow('Duracion invalida');
    expect(() => duracionAMs('15 minutos')).toThrow('Duracion invalida');
    expect(() => duracionAMs('')).toThrow('Duracion invalida');
  });

  it('las vidas derivadas son coherentes con el entorno', () => {
    expect(VIDA_ACCESS_MS).toBe(duracionAMs(env.ACCESS_TOKEN_TTL));
    expect(VIDA_REFRESH_MS).toBe(duracionAMs(env.REFRESH_TOKEN_TTL));
  });
});

describe('access token', () => {
  it('firma y verifica el id y el rol', () => {
    const token = firmarAccessToken({ id: 42, rol: 'admin' });
    expect(verificarAccessToken(token)).toEqual({ idUsuario: 42, rol: 'admin' });
  });

  it('rechaza un token firmado con el otro secreto', () => {
    const token = jwt.sign({ rol: 'usuario' }, env.JWT_REFRESH_SECRET, {
      algorithm: 'HS256',
      subject: '1',
      expiresIn: '5m',
    });
    expect(() => verificarAccessToken(token)).toThrow(
      expect.objectContaining({ code: 'TOKEN_INVALIDO', statusCode: 401 }),
    );
  });

  it('detecta un token vencido con code TOKEN_EXPIRADO', () => {
    const token = jwt.sign({ rol: 'usuario' }, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      subject: '1',
      expiresIn: '-1s',
    });
    expect(() => verificarAccessToken(token)).toThrow(
      expect.objectContaining({ code: 'TOKEN_EXPIRADO', statusCode: 401 }),
    );
  });

  it('rechaza payloads sin sub, con rol desconocido o con id invalido', () => {
    const sinSub = jwt.sign({ rol: 'usuario' }, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: '5m',
    });
    const rolMalo = jwt.sign({ rol: 'superadmin' }, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      subject: '1',
      expiresIn: '5m',
    });
    const idMalo = jwt.sign({ rol: 'usuario' }, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      subject: 'abc',
      expiresIn: '5m',
    });
    const idCero = jwt.sign({ rol: 'usuario' }, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      subject: '0',
      expiresIn: '5m',
    });

    for (const token of [sinSub, rolMalo, idMalo, idCero]) {
      expect(() => verificarAccessToken(token)).toThrow(
        expect.objectContaining({ code: 'TOKEN_INVALIDO' }),
      );
    }
  });
});

describe('refresh token', () => {
  it('firma y verifica el usuario y el id de sesion', () => {
    const token = firmarRefreshToken(7, 'sesion-abc');
    expect(verificarRefreshToken(token)).toEqual({ idUsuario: 7, idSesion: 'sesion-abc' });
  });

  it('rechaza un access token usado como refresh', () => {
    const token = firmarAccessToken({ id: 7, rol: 'usuario' });
    expect(() => verificarRefreshToken(token)).toThrow(
      expect.objectContaining({ code: 'TOKEN_INVALIDO' }),
    );
  });

  it('exige el claim sid', () => {
    const token = jwt.sign({}, env.JWT_REFRESH_SECRET, {
      algorithm: 'HS256',
      subject: '7',
      expiresIn: '5m',
    });
    expect(() => verificarRefreshToken(token)).toThrow(
      expect.objectContaining({ code: 'TOKEN_INVALIDO' }),
    );
  });

  it('detecta un refresh vencido', () => {
    const token = jwt.sign({ sid: 's' }, env.JWT_REFRESH_SECRET, {
      algorithm: 'HS256',
      subject: '7',
      expiresIn: '-1s',
    });
    expect(() => verificarRefreshToken(token)).toThrow(
      expect.objectContaining({ code: 'TOKEN_EXPIRADO' }),
    );
  });
});

describe('hash de token', () => {
  it('guarda solo el sha256 en hex (64 caracteres)', () => {
    const hash = hashDeToken('un-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('un-token');
    expect(hashDeToken('un-token')).toBe(hash);
    expect(hashDeToken('otro-token')).not.toBe(hash);
  });

  it('compara en tiempo constante y tolera hashes mal formados', () => {
    const hash = hashDeToken('un-token');
    expect(tokenCoincideConHash('un-token', hash)).toBe(true);
    expect(tokenCoincideConHash('otro-token', hash)).toBe(false);
    expect(tokenCoincideConHash('un-token', 'abc')).toBe(false);
    expect(tokenCoincideConHash('un-token', '')).toBe(false);
  });
});
