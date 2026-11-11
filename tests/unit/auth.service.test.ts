import argon2 from 'argon2';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashDeToken, firmarRefreshToken, verificarAccessToken } from '../../src/modules/auth/tokens.js';
import * as repo from '../../src/modules/auth/repository.js';
import * as servicio from '../../src/modules/auth/service.js';

// Se envuelven las funciones reales de argon2 para poder comprobar las llamadas
// (p. ej. que un email inexistente tambien verifica una contrasena) sin perder
// el comportamiento real de hash/verify.
type ModuloArgon2 = typeof argon2;

vi.mock('argon2', async (importOriginal) => {
  const real = await importOriginal<ModuloArgon2>();
  const posible = real as unknown as { default?: ModuloArgon2 };
  const actual = posible.default ?? real;
  return {
    default: {
      argon2id: actual.argon2id,
      hash: vi.fn(actual.hash),
      verify: vi.fn(actual.verify),
    },
  };
});

vi.mock('../../src/modules/auth/repository.js', () => ({
  buscarUsuarioPorEmail: vi.fn(),
  buscarUsuarioPorId: vi.fn(),
  crearUsuario: vi.fn(),
  actualizarNombre: vi.fn(),
  actualizarPasswordHash: vi.fn(),
  crearSesion: vi.fn(),
  buscarSesion: vi.fn(),
  revocarSesion: vi.fn(),
  revocarFamilia: vi.fn(),
  revocarSesionesDeUsuario: vi.fn(),
  borrarSesionesVencidasDeUsuario: vi.fn(),
  rotarSesion: vi.fn(),
  borrarSesionesVencidasAntes: vi.fn(),
}));

const PASSWORD = 'Password12345';
const SID = '11111111-1111-4111-8111-111111111111';
const FAMILIA = '22222222-2222-4222-8222-222222222222';

let HASH = '';

function usuarioFila(overrides: Partial<repo.UsuarioFila> = {}): repo.UsuarioFila {
  return {
    id_usuario: 1,
    nombre: 'Ana Perez',
    email: 'ana@ejemplo.com',
    password_hash: HASH,
    rol: 'usuario',
    activo: true,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function sesionFila(
  token: string,
  overrides: Partial<repo.SesionFila> = {},
): repo.SesionFila {
  return {
    id_sesion: SID,
    id_usuario: 1,
    familia: FAMILIA,
    token_hash: hashDeToken(token),
    expira_en: new Date(Date.now() + 60_000),
    revocada_en: null,
    user_agent: null,
    ip: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function esperarError(codigo: string, statusCode: number) {
  return expect.objectContaining({ code: codigo, statusCode });
}

beforeAll(async () => {
  HASH = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.crearSesion).mockResolvedValue(undefined);
  vi.mocked(repo.borrarSesionesVencidasDeUsuario).mockResolvedValue(undefined);
  vi.mocked(repo.revocarSesion).mockResolvedValue(undefined);
  vi.mocked(repo.revocarFamilia).mockResolvedValue(undefined);
  vi.mocked(repo.revocarSesionesDeUsuario).mockResolvedValue(undefined);
  vi.mocked(repo.actualizarPasswordHash).mockResolvedValue(undefined);
  vi.mocked(repo.rotarSesion).mockResolvedValue(undefined);
  vi.mocked(repo.crearUsuario).mockResolvedValue(usuarioFila());
});

describe('registrar', () => {
  it('rechaza un email ya registrado sin hashear ni crear nada', async () => {
    vi.mocked(repo.buscarUsuarioPorEmail).mockResolvedValue(usuarioFila());

    await expect(
      servicio.registrar(
        { nombre: 'Ana', email: 'ana@ejemplo.com', password: PASSWORD },
        {},
      ),
    ).rejects.toMatchObject(esperarError('EMAIL_EN_USO', 409));

    expect(argon2.hash).not.toHaveBeenCalled();
    expect(repo.crearUsuario).not.toHaveBeenCalled();
    expect(repo.crearSesion).not.toHaveBeenCalled();
  });

  it('crea el usuario (hash argon2id) y abre una sesion con cookies', async () => {
    vi.mocked(repo.buscarUsuarioPorEmail).mockResolvedValue(undefined);

    const resultado = await servicio.registrar(
      { nombre: 'Ana', email: 'ana@ejemplo.com', password: PASSWORD },
      { userAgent: 'vitest', ip: '127.0.0.1' },
    );

    const datosUsuario = vi.mocked(repo.crearUsuario).mock.calls[0]?.[0];
    expect(datosUsuario).toMatchObject({
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
    });
    expect(datosUsuario?.passwordHash).not.toBe(PASSWORD);
    expect(datosUsuario?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(datosUsuario?.passwordHash ?? '', PASSWORD)).toBe(true);

    expect(resultado.usuario).toEqual({
      id: 1,
      nombre: 'Ana Perez',
      email: 'ana@ejemplo.com',
      rol: 'usuario',
    });
    expect(resultado.usuario).not.toHaveProperty('password_hash');

    expect(verificarAccessToken(resultado.accessToken)).toEqual({
      idUsuario: 1,
      rol: 'usuario',
    });

    const sesion = vi.mocked(repo.crearSesion).mock.calls[0]?.[0];
    expect(sesion?.idUsuario).toBe(1);
    expect(sesion?.tokenHash).toBe(hashDeToken(resultado.refreshToken));
    expect(sesion?.tokenHash).not.toBe(resultado.refreshToken);
    expect(sesion?.userAgent).toBe('vitest');
    expect(sesion?.ip).toBe('127.0.0.1');
    expect(sesion?.familia).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('iniciarSesion', () => {
  it('con email inexistente verifica igualmente un hash falso (mismo tiempo)', async () => {
    vi.mocked(repo.buscarUsuarioPorEmail).mockResolvedValue(undefined);

    await expect(
      servicio.iniciarSesion({ email: 'nadie@ejemplo.com', password: PASSWORD }, {}),
    ).rejects.toMatchObject(esperarError('CREDENCIALES_INVALIDAS', 401));

    expect(argon2.verify).toHaveBeenCalledTimes(1);
    const hashUsado = vi.mocked(argon2.verify).mock.calls[0]?.[0];
    expect(hashUsado).toMatch(/^\$argon2id\$/);
    expect(repo.crearSesion).not.toHaveBeenCalled();
  });

  it('con contrasena incorrecta responde el mismo 401', async () => {
    vi.mocked(repo.buscarUsuarioPorEmail).mockResolvedValue(usuarioFila());

    await expect(
      servicio.iniciarSesion({ email: 'ana@ejemplo.com', password: 'OtraPassword123' }, {}),
    ).rejects.toMatchObject(esperarError('CREDENCIALES_INVALIDAS', 401));

    expect(argon2.verify).toHaveBeenCalledTimes(1);
    expect(repo.crearSesion).not.toHaveBeenCalled();
  });

  it('informa cuenta desactivada solo despues de verificar la contrasena', async () => {
    vi.mocked(repo.buscarUsuarioPorEmail).mockResolvedValue(usuarioFila({ activo: false }));

    await expect(
      servicio.iniciarSesion({ email: 'ana@ejemplo.com', password: PASSWORD }, {}),
    ).rejects.toMatchObject(esperarError('USUARIO_DESACTIVADO', 403));

    expect(argon2.verify).toHaveBeenCalledTimes(1);
    expect(repo.crearSesion).not.toHaveBeenCalled();
  });

  it('abre una sesion nueva y limpia las vencidas del usuario', async () => {
    vi.mocked(repo.buscarUsuarioPorEmail).mockResolvedValue(usuarioFila());

    const resultado = await servicio.iniciarSesion(
      { email: 'ana@ejemplo.com', password: PASSWORD },
      { ip: '10.0.0.1' },
    );

    expect(resultado.usuario).not.toHaveProperty('password_hash');
    expect(repo.borrarSesionesVencidasDeUsuario).toHaveBeenCalledWith(1);
    expect(repo.crearSesion).toHaveBeenCalledTimes(1);
    const sesion = vi.mocked(repo.crearSesion).mock.calls[0]?.[0];
    expect(sesion?.tokenHash).toBe(hashDeToken(resultado.refreshToken));
  });

  it('si la limpieza oportunista falla, el login continua', async () => {
    vi.mocked(repo.buscarUsuarioPorEmail).mockResolvedValue(usuarioFila());
    vi.mocked(repo.borrarSesionesVencidasDeUsuario).mockRejectedValueOnce(
      new Error('base ocupada'),
    );

    const resultado = await servicio.iniciarSesion(
      { email: 'ana@ejemplo.com', password: PASSWORD },
      {},
    );
    expect(resultado.usuario.id).toBe(1);
    expect(repo.crearSesion).toHaveBeenCalledTimes(1);
  });
});

describe('refrescar', () => {
  it('sin cookie responde 401 NO_AUTENTICADO', async () => {
    await expect(servicio.refrescar(undefined, {})).rejects.toMatchObject(
      esperarError('NO_AUTENTICADO', 401),
    );
    expect(repo.buscarSesion).not.toHaveBeenCalled();
  });

  it('con un JWT invalido responde 401 TOKEN_INVALIDO', async () => {
    await expect(servicio.refrescar('no-es-un-jwt', {})).rejects.toMatchObject(
      esperarError('TOKEN_INVALIDO', 401),
    );
  });

  it('si la sesion no existe responde SESION_INVALIDA', async () => {
    const token = firmarRefreshToken(1, SID);
    vi.mocked(repo.buscarSesion).mockResolvedValue(undefined);

    await expect(servicio.refrescar(token, {})).rejects.toMatchObject(
      esperarError('SESION_INVALIDA', 401),
    );
  });

  it('si el token no coincide con el hash responde SESION_INVALIDA', async () => {
    const token = firmarRefreshToken(1, SID);
    vi.mocked(repo.buscarSesion).mockResolvedValue(
      sesionFila(token, { token_hash: hashDeToken('otro-token') }),
    );

    await expect(servicio.refrescar(token, {})).rejects.toMatchObject(
      esperarError('SESION_INVALIDA', 401),
    );
    expect(repo.rotarSesion).not.toHaveBeenCalled();
  });

  it('detecta reutilizacion fuera de la ventana y revoca la familia', async () => {
    const token = firmarRefreshToken(1, SID);
    vi.mocked(repo.buscarSesion).mockResolvedValue(
      sesionFila(token, { revocada_en: new Date(Date.now() - 60_000) }),
    );

    await expect(servicio.refrescar(token, {})).rejects.toMatchObject(
      esperarError('SESION_INVALIDA', 401),
    );
    expect(repo.revocarFamilia).toHaveBeenCalledWith(FAMILIA);
    expect(repo.rotarSesion).not.toHaveBeenCalled();
  });

  it('tolera la carrera de dos pestañas dentro de la ventana (no revoca la familia)', async () => {
    const token = firmarRefreshToken(1, SID);
    vi.mocked(repo.buscarSesion).mockResolvedValue(
      sesionFila(token, { revocada_en: new Date() }),
    );

    await expect(servicio.refrescar(token, {})).rejects.toMatchObject(
      esperarError('SESION_INVALIDA', 401),
    );
    expect(repo.revocarFamilia).not.toHaveBeenCalled();
  });

  it('rechaza una sesion expirada', async () => {
    const token = firmarRefreshToken(1, SID);
    vi.mocked(repo.buscarSesion).mockResolvedValue(
      sesionFila(token, { expira_en: new Date(Date.now() - 1_000) }),
    );

    await expect(servicio.refrescar(token, {})).rejects.toMatchObject(
      esperarError('SESION_INVALIDA', 401),
    );
    expect(repo.rotarSesion).not.toHaveBeenCalled();
  });

  it('rechaza si el usuario ya no existe, esta inactivo o no coincide', async () => {
    const token = firmarRefreshToken(1, SID);
    vi.mocked(repo.buscarSesion).mockResolvedValue(sesionFila(token));

    vi.mocked(repo.buscarUsuarioPorId).mockResolvedValueOnce(undefined);
    await expect(servicio.refrescar(token, {})).rejects.toMatchObject(
      esperarError('SESION_INVALIDA', 401),
    );

    vi.mocked(repo.buscarUsuarioPorId).mockResolvedValueOnce(
      usuarioFila({ activo: false }),
    );
    await expect(servicio.refrescar(token, {})).rejects.toMatchObject(
      esperarError('SESION_INVALIDA', 401),
    );

    vi.mocked(repo.buscarUsuarioPorId).mockResolvedValueOnce(
      usuarioFila({ id_usuario: 99 }),
    );
    await expect(servicio.refrescar(token, {})).rejects.toMatchObject(
      esperarError('SESION_INVALIDA', 401),
    );

    expect(repo.rotarSesion).not.toHaveBeenCalled();
  });

  it('rota la sesion: mismo familia, token nuevo y hash nuevo', async () => {
    const token = firmarRefreshToken(1, SID);
    vi.mocked(repo.buscarSesion).mockResolvedValue(sesionFila(token));
    vi.mocked(repo.buscarUsuarioPorId).mockResolvedValue(usuarioFila());

    const resultado = await servicio.refrescar(token, {
      userAgent: 'vitest',
      ip: '10.0.0.9',
    });

    expect(resultado.refreshToken).not.toBe(token);
    const rotacion = vi.mocked(repo.rotarSesion).mock.calls[0]?.[0];
    expect(rotacion?.idSesionVieja).toBe(SID);
    expect(rotacion?.nueva.familia).toBe(FAMILIA);
    expect(rotacion?.nueva.idSesion).not.toBe(SID);
    expect(rotacion?.nueva.tokenHash).toBe(hashDeToken(resultado.refreshToken));
    expect(rotacion?.nueva.userAgent).toBe('vitest');
    expect(rotacion?.nueva.ip).toBe('10.0.0.9');
    expect(verificarAccessToken(resultado.accessToken)).toEqual({
      idUsuario: 1,
      rol: 'usuario',
    });
  });
});

describe('logout', () => {
  it('sin token es idempotente y no toca la base', async () => {
    await expect(servicio.cerrarSesion(undefined)).resolves.toBeUndefined();
    expect(repo.revocarSesion).not.toHaveBeenCalled();
  });

  it('con token invalido no falla', async () => {
    await expect(servicio.cerrarSesion('basura')).resolves.toBeUndefined();
    expect(repo.revocarSesion).not.toHaveBeenCalled();
  });

  it('con token valido revoca la sesion', async () => {
    const token = firmarRefreshToken(1, SID);
    await servicio.cerrarSesion(token);
    expect(repo.revocarSesion).toHaveBeenCalledWith(SID);
  });

  it('cerrarTodasLasSesiones revoca las del usuario', async () => {
    await servicio.cerrarTodasLasSesiones(7);
    expect(repo.revocarSesionesDeUsuario).toHaveBeenCalledWith(7);
  });
});

describe('perfil y cambio de contrasena', () => {
  it('obtenerPerfil devuelve solo campos publicos', async () => {
    vi.mocked(repo.buscarUsuarioPorId).mockResolvedValue(usuarioFila({ rol: 'admin' }));

    const perfil = await servicio.obtenerPerfil(1);
    expect(perfil).toEqual({
      id: 1,
      nombre: 'Ana Perez',
      email: 'ana@ejemplo.com',
      rol: 'admin',
    });
    expect(perfil).not.toHaveProperty('password_hash');
  });

  it('obtenerPerfil falla si el usuario ya no existe', async () => {
    vi.mocked(repo.buscarUsuarioPorId).mockResolvedValue(undefined);
    await expect(servicio.obtenerPerfil(1)).rejects.toMatchObject(
      esperarError('SESION_INVALIDA', 401),
    );
  });

  it('actualizarPerfil delega y devuelve el DTO publico', async () => {
    vi.mocked(repo.actualizarNombre).mockResolvedValue(usuarioFila({ nombre: 'Ana Maria' }));
    const perfil = await servicio.actualizarPerfil(1, { nombre: 'Ana Maria' });
    expect(repo.actualizarNombre).toHaveBeenCalledWith(1, 'Ana Maria');
    expect(perfil.nombre).toBe('Ana Maria');
    expect(perfil).not.toHaveProperty('password_hash');
  });

  it('cambiarPassword rechaza si el usuario no existe', async () => {
    vi.mocked(repo.buscarUsuarioPorId).mockResolvedValue(undefined);
    await expect(
      servicio.cambiarPassword(
        1,
        { passwordActual: PASSWORD, passwordNueva: 'NuevaPassword123' },
        {},
      ),
    ).rejects.toMatchObject(esperarError('SESION_INVALIDA', 401));
  });

  it('cambiarPassword rechaza si la contrasena actual es incorrecta', async () => {
    vi.mocked(repo.buscarUsuarioPorId).mockResolvedValue(usuarioFila());
    await expect(
      servicio.cambiarPassword(
        1,
        { passwordActual: 'Incorrecta123', passwordNueva: 'NuevaPassword123' },
        {},
      ),
    ).rejects.toMatchObject(esperarError('CREDENCIALES_INVALIDAS', 401));

    expect(repo.actualizarPasswordHash).not.toHaveBeenCalled();
  });

  it('cambiarPassword guarda el hash nuevo, revoca todas y abre una sesion', async () => {
    vi.mocked(repo.buscarUsuarioPorId).mockResolvedValue(usuarioFila());

    const resultado = await servicio.cambiarPassword(
      1,
      { passwordActual: PASSWORD, passwordNueva: 'NuevaPassword123' },
      {},
    );

    const nuevoHash = vi.mocked(repo.actualizarPasswordHash).mock.calls[0]?.[1];
    expect(nuevoHash).toMatch(/^\$argon2id\$/);
    expect(nuevoHash).not.toBe(HASH);
    expect(await argon2.verify(nuevoHash ?? '', 'NuevaPassword123')).toBe(true);
    expect(repo.revocarSesionesDeUsuario).toHaveBeenCalledWith(1);
    expect(repo.crearSesion).toHaveBeenCalledTimes(1);
    expect(resultado.usuario).not.toHaveProperty('password_hash');
  });
});
