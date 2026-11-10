import { createHash, timingSafeEqual } from 'node:crypto';
import jwt, { type Algorithm, type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors.js';

export type Rol = 'usuario' | 'admin';

export interface SesionVerificada {
  idUsuario: number;
  rol: Rol;
}

export interface RefreshVerificado {
  idUsuario: number;
  idSesion: string;
}

// Algoritmo FIJADO en firma y verificacion: evita ataques de confusion de
// algoritmo (p. ej. que alguien intente "none" o RS256 con nuestra clave).
const ALGORITMO: Algorithm = 'HS256';

// jsonwebtoken tipa expiresIn con la union de `ms`; el valor ya viene validado
// por env.ts con una regex (15m, 7d, ...), asi que el cast es seguro.
const TTL_ACCESS = env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'];
const TTL_REFRESH = env.REFRESH_TOKEN_TTL as SignOptions['expiresIn'];

const PATRON_DURACION = /^(\d+)(ms|s|m|h|d)$/;

/** Convierte '15m', '7d'... a milisegundos (para maxAge de las cookies). */
export function duracionAMs(duracion: string): number {
  const coincidencia = PATRON_DURACION.exec(duracion);
  if (!coincidencia) throw new Error(`Duracion invalida: ${duracion}`);
  const cantidad = Number(coincidencia[1]);
  const unidad = coincidencia[2];
  const factores: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return cantidad * (factores[unidad ?? 'ms'] ?? 1);
}

export const VIDA_ACCESS_MS = duracionAMs(env.ACCESS_TOKEN_TTL);
export const VIDA_REFRESH_MS = duracionAMs(env.REFRESH_TOKEN_TTL);

/** Access token: payload minimo { sub, rol } y vida corta. */
export function firmarAccessToken(usuario: { id: number; rol: Rol }): string {
  return jwt.sign({ rol: usuario.rol }, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITMO,
    subject: String(usuario.id),
    expiresIn: TTL_ACCESS,
  });
}

/** Refresh token: { sub, sid } firmado con OTRO secreto y vida larga. */
export function firmarRefreshToken(idUsuario: number, idSesion: string): string {
  return jwt.sign({ sid: idSesion }, env.JWT_REFRESH_SECRET, {
    algorithm: ALGORITMO,
    subject: String(idUsuario),
    expiresIn: TTL_REFRESH,
  });
}

function esRol(valor: unknown): valor is Rol {
  return valor === 'usuario' || valor === 'admin';
}

export function verificarAccessToken(token: string): SesionVerificada {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [ALGORITMO] });
    if (typeof payload === 'string' || !payload.sub) {
      throw new UnauthorizedError('TOKEN_INVALIDO', 'El token no es valido');
    }
    const idUsuario = Number(payload.sub);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0 || !esRol(payload.rol)) {
      throw new UnauthorizedError('TOKEN_INVALIDO', 'El token no es valido');
    }
    return { idUsuario, rol: payload.rol };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('TOKEN_EXPIRADO', 'La sesion expiro; renueva con /auth/refresh');
    }
    throw new UnauthorizedError('TOKEN_INVALIDO', 'El token no es valido');
  }
}

export function verificarRefreshToken(token: string): RefreshVerificado {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [ALGORITMO] });
    if (typeof payload === 'string' || !payload.sub || typeof payload.sid !== 'string') {
      throw new UnauthorizedError('TOKEN_INVALIDO', 'El token de refresco no es valido');
    }
    const idUsuario = Number(payload.sub);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      throw new UnauthorizedError('TOKEN_INVALIDO', 'El token de refresco no es valido');
    }
    return { idUsuario, idSesion: payload.sid };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('TOKEN_EXPIRADO', 'La sesion expiro');
    }
    throw new UnauthorizedError('TOKEN_INVALIDO', 'El token de refresco no es valido');
  }
}

/** En la base se guarda SOLO sha256(token) en hex, nunca el token. */
export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Compara el token recibido con el hash guardado en tiempo constante, para no
 * filtrar informacion por diferencias de tiempo.
 */
export function tokenCoincideConHash(token: string, hashGuardado: string): boolean {
  const hashRecibido = Buffer.from(hashDeToken(token), 'hex');
  const hashEsperado = Buffer.from(hashGuardado, 'hex');
  if (hashRecibido.length !== hashEsperado.length) return false;
  return timingSafeEqual(hashRecibido, hashEsperado);
}
