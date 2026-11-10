import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { logger } from '../../config/logger.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../shared/errors.js';
import { hashDeToken, firmarAccessToken, firmarRefreshToken, tokenCoincideConHash, verificarRefreshToken, VIDA_REFRESH_MS } from './tokens.js';
import * as repo from './repository.js';
import type {
  ActualizarPerfilInput,
  CambiarPasswordInput,
  LoginInput,
  RegistroInput,
  UsuarioPublico,
} from './schemas.js';

// Hash argon2id valido de un valor aleatorio descartado. Se usa cuando el email
// NO existe para verificar igualmente una contrasena y que el tiempo de
// respuesta no revele si la cuenta existe (evita enumerar emails).
const HASH_FALSO =
  '$argon2id$v=19$m=65536,t=3,p=4$Z19JqMVi2TPmD/RoRXhpiQ$3dtdbzEfkQ/y//PpbDYAPrGqvTnvnzBiEnfYgfsatdc';

// Ventana para tolerar la carrera legitima de dos pestanas refrescando a la vez.
const VENTANA_CARRERA_MS = 10_000;

export interface MetaSesion {
  userAgent?: string;
  ip?: string;
}

export interface ResultadoSesion {
  usuario: UsuarioPublico;
  accessToken: string;
  refreshToken: string;
}

/** DTO de lista blanca: NUNCA se hace spread de la fila (tiene password_hash). */
function aUsuarioPublico(fila: repo.UsuarioFila): UsuarioPublico {
  return {
    id: fila.id_usuario,
    nombre: fila.nombre,
    email: fila.email,
    rol: fila.rol,
  };
}

/**
 * Crea la fila de sesion y emite los dos tokens. El id_sesion se genera ANTES
 * de firmar el refresh porque va en su payload (sid).
 */
async function abrirSesion(
  usuarioFila: repo.UsuarioFila,
  familia: string,
  meta: MetaSesion,
): Promise<ResultadoSesion> {
  const idSesion = randomUUID();
  const refreshToken = firmarRefreshToken(usuarioFila.id_usuario, idSesion);
  const accessToken = firmarAccessToken({ id: usuarioFila.id_usuario, rol: usuarioFila.rol });
  const expiraEn = new Date(Date.now() + VIDA_REFRESH_MS);

  await repo.crearSesion({
    idSesion,
    idUsuario: usuarioFila.id_usuario,
    familia,
    tokenHash: hashDeToken(refreshToken),
    expiraEn,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  return { usuario: aUsuarioPublico(usuarioFila), accessToken, refreshToken };
}

export async function registrar(
  datos: RegistroInput,
  meta: MetaSesion,
): Promise<ResultadoSesion> {
  // Pre-chequeo para dar un mensaje claro; la UNIQUE sigue protegiendo ante una
  // carrera (pgErrors lo traduce a EMAIL_EN_USO).
  const existente = await repo.buscarUsuarioPorEmail(datos.email);
  if (existente) {
    throw new ConflictError('EMAIL_EN_USO', 'Ya existe una cuenta con ese correo');
  }

  const passwordHash = await argon2.hash(datos.password, { type: argon2.argon2id });
  const usuarioFila = await repo.crearUsuario({
    nombre: datos.nombre,
    email: datos.email,
    passwordHash,
  });

  // Auto-login: el registro devuelve cookies de sesion.
  return abrirSesion(usuarioFila, randomUUID(), meta);
}

export async function iniciarSesion(
  datos: LoginInput,
  meta: MetaSesion,
): Promise<ResultadoSesion> {
  const usuarioFila = await repo.buscarUsuarioPorEmail(datos.email);

  // Si el usuario no existe se verifica igual contra un hash falso para que el
  // tiempo sea similar. Mismo error en ambos casos: no se revela cual fallo.
  const hashAVerificar = usuarioFila?.password_hash ?? HASH_FALSO;
  const passwordValida = await argon2.verify(hashAVerificar, datos.password).catch(() => false);

  if (!usuarioFila || !passwordValida) {
    throw new UnauthorizedError(
      'CREDENCIALES_INVALIDAS',
      'Correo o contrasena incorrectos',
    );
  }

  // La desactivacion solo se informa DESPUES de comprobar la contrasena.
  if (!usuarioFila.activo) {
    throw new ForbiddenError('USUARIO_DESACTIVADO', 'La cuenta esta desactivada');
  }

  // Limpieza oportunista: si falla, no debe impedir el login.
  try {
    await repo.borrarSesionesVencidasDeUsuario(usuarioFila.id_usuario);
  } catch (error) {
    logger.warn({ err: error }, 'No se pudieron limpiar sesiones vencidas en el login');
  }

  // Familia nueva en cada login.
  return abrirSesion(usuarioFila, randomUUID(), meta);
}

export async function refrescar(
  refreshToken: string | undefined,
  meta: MetaSesion,
): Promise<ResultadoSesion> {
  if (!refreshToken) {
    throw new UnauthorizedError('NO_AUTENTICADO', 'No hay una sesion activa');
  }

  // Si el JWT es invalido o esta vencido, el controller limpia las cookies.
  const { idUsuario, idSesion } = verificarRefreshToken(refreshToken);

  const sesionFila = await repo.buscarSesion(idSesion);
  if (!sesionFila) {
    throw new UnauthorizedError('SESION_INVALIDA', 'La sesion no existe o fue revocada');
  }

  // Comparacion en tiempo constante contra el hash guardado.
  if (!tokenCoincideConHash(refreshToken, sesionFila.token_hash)) {
    throw new UnauthorizedError('SESION_INVALIDA', 'La sesion no es valida');
  }

  if (sesionFila.revocada_en) {
    const haceMs = Date.now() - sesionFila.revocada_en.getTime();
    if (haceMs > VENTANA_CARRERA_MS) {
      // Token viejo reutilizado: se asume robo y se revoca la familia completa.
      logger.warn(
        { idUsuario: sesionFila.id_usuario, familia: sesionFila.familia },
        'Reutilizacion de refresh token detectada: se revoca la familia',
      );
      await repo.revocarFamilia(sesionFila.familia);
    }
    throw new UnauthorizedError('SESION_INVALIDA', 'La sesion no es valida');
  }

  const ahora = new Date();
  if (sesionFila.expira_en <= ahora) {
    throw new UnauthorizedError('SESION_INVALIDA', 'La sesion expiro');
  }

  const usuarioFila = await repo.buscarUsuarioPorId(idUsuario);
  if (!usuarioFila || !usuarioFila.activo || usuarioFila.id_usuario !== sesionFila.id_usuario) {
    throw new UnauthorizedError('SESION_INVALIDA', 'La sesion no es valida');
  }

  // Rotacion: la sesion actual se revoca y se crea otra con la MISMA familia,
  // todo en una transaccion (ver repository.rotarSesion).
  const idSesionNueva = randomUUID();
  const refreshNuevo = firmarRefreshToken(usuarioFila.id_usuario, idSesionNueva);
  await repo.rotarSesion({
    idSesionVieja: sesionFila.id_sesion,
    nueva: {
      idSesion: idSesionNueva,
      idUsuario: usuarioFila.id_usuario,
      familia: sesionFila.familia,
      tokenHash: hashDeToken(refreshNuevo),
      expiraEn: new Date(ahora.getTime() + VIDA_REFRESH_MS),
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  });

  // El rol se lee de la base en cada refresh: si cambio, se aplica en <= 15 min.
  const accessToken = firmarAccessToken({ id: usuarioFila.id_usuario, rol: usuarioFila.rol });

  return { usuario: aUsuarioPublico(usuarioFila), accessToken, refreshToken: refreshNuevo };
}

/** Logout idempotente: aunque el token falte o sea invalido, no falla. */
export async function cerrarSesion(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    const { idSesion } = verificarRefreshToken(refreshToken);
    await repo.revocarSesion(idSesion);
  } catch (error) {
    // Token vencido o invalido: no hay nada que revocar y el logout sigue siendo
    // exitoso (el cliente borra las cookies igual).
    logger.debug({ err: error }, 'Logout con token de refresco invalido o ausente');
  }
}

export async function cerrarTodasLasSesiones(idUsuario: number): Promise<void> {
  await repo.revocarSesionesDeUsuario(idUsuario);
}

export async function obtenerPerfil(idUsuario: number): Promise<UsuarioPublico> {
  const usuarioFila = await repo.buscarUsuarioPorId(idUsuario);
  if (!usuarioFila) {
    throw new UnauthorizedError('SESION_INVALIDA', 'El usuario de la sesion ya no existe');
  }
  return aUsuarioPublico(usuarioFila);
}

export async function actualizarPerfil(
  idUsuario: number,
  datos: ActualizarPerfilInput,
): Promise<UsuarioPublico> {
  const usuarioFila = await repo.actualizarNombre(idUsuario, datos.nombre);
  return aUsuarioPublico(usuarioFila);
}

/**
 * Cambio de contrasena: verifica la actual, guarda la nueva, revoca TODAS las
 * sesiones (incluida la actual) y abre una nueva para que quien cambio la clave
 * siga dentro. El controller reemite las cookies.
 */
export async function cambiarPassword(
  idUsuario: number,
  datos: CambiarPasswordInput,
  meta: MetaSesion,
): Promise<ResultadoSesion> {
  const usuarioFila = await repo.buscarUsuarioPorId(idUsuario);
  if (!usuarioFila) {
    throw new UnauthorizedError('SESION_INVALIDA', 'El usuario de la sesion ya no existe');
  }

  const actualValida = await argon2
    .verify(usuarioFila.password_hash, datos.passwordActual)
    .catch(() => false);
  if (!actualValida) {
    throw new UnauthorizedError('CREDENCIALES_INVALIDAS', 'La contrasena actual es incorrecta');
  }

  const nuevoHash = await argon2.hash(datos.passwordNueva, { type: argon2.argon2id });
  await repo.actualizarPasswordHash(idUsuario, nuevoHash);
  await repo.revocarSesionesDeUsuario(idUsuario);

  // Familia nueva tras el cambio de clave.
  return abrirSesion(usuarioFila, randomUUID(), meta);
}
