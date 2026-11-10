import { and, eq, isNull, lt } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { sesion, usuario } from '../../db/schema/index.js';

export type UsuarioFila = typeof usuario.$inferSelect;
export type SesionFila = typeof sesion.$inferSelect;

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

export async function buscarUsuarioPorEmail(email: string): Promise<UsuarioFila | undefined> {
  const filas = await db.select().from(usuario).where(eq(usuario.email, email)).limit(1);
  return filas[0];
}

export async function buscarUsuarioPorId(idUsuario: number): Promise<UsuarioFila | undefined> {
  const filas = await db.select().from(usuario).where(eq(usuario.id_usuario, idUsuario)).limit(1);
  return filas[0];
}

export async function crearUsuario(datos: {
  nombre: string;
  email: string;
  passwordHash: string;
}): Promise<UsuarioFila> {
  const filas = await db
    .insert(usuario)
    .values({
      nombre: datos.nombre,
      email: datos.email,
      password_hash: datos.passwordHash,
      rol: 'usuario',
    })
    .returning();
  const fila = filas[0];
  if (!fila) throw new Error('No se pudo crear el usuario');
  return fila;
}

export async function actualizarNombre(idUsuario: number, nombre: string): Promise<UsuarioFila> {
  const filas = await db
    .update(usuario)
    .set({ nombre })
    .where(eq(usuario.id_usuario, idUsuario))
    .returning();
  const fila = filas[0];
  if (!fila) throw new Error('No se pudo actualizar el usuario');
  return fila;
}

export async function actualizarPasswordHash(
  idUsuario: number,
  passwordHash: string,
): Promise<void> {
  await db
    .update(usuario)
    .set({ password_hash: passwordHash })
    .where(eq(usuario.id_usuario, idUsuario));
}

// ---------------------------------------------------------------------------
// Sesiones
// ---------------------------------------------------------------------------

export interface NuevaSesion {
  idSesion: string;
  idUsuario: number;
  familia: string;
  tokenHash: string;
  expiraEn: Date;
  userAgent?: string;
  ip?: string;
}

export async function crearSesion(datos: NuevaSesion): Promise<void> {
  await db.insert(sesion).values({
    id_sesion: datos.idSesion,
    id_usuario: datos.idUsuario,
    familia: datos.familia,
    token_hash: datos.tokenHash,
    expira_en: datos.expiraEn,
    user_agent: datos.userAgent ?? null,
    ip: datos.ip ?? null,
  });
}

export async function buscarSesion(idSesion: string): Promise<SesionFila | undefined> {
  const filas = await db.select().from(sesion).where(eq(sesion.id_sesion, idSesion)).limit(1);
  return filas[0];
}

export async function revocarSesion(idSesion: string): Promise<void> {
  await db
    .update(sesion)
    .set({ revocada_en: new Date() })
    .where(and(eq(sesion.id_sesion, idSesion), isNull(sesion.revocada_en)));
}

export async function revocarFamilia(familia: string): Promise<void> {
  await db
    .update(sesion)
    .set({ revocada_en: new Date() })
    .where(and(eq(sesion.familia, familia), isNull(sesion.revocada_en)));
}

export async function revocarSesionesDeUsuario(idUsuario: number): Promise<void> {
  await db
    .update(sesion)
    .set({ revocada_en: new Date() })
    .where(and(eq(sesion.id_usuario, idUsuario), isNull(sesion.revocada_en)));
}

/** Limpieza oportunista: borra las sesiones ya expiradas de un usuario. */
export async function borrarSesionesVencidasDeUsuario(idUsuario: number): Promise<void> {
  await db
    .delete(sesion)
    .where(and(eq(sesion.id_usuario, idUsuario), lt(sesion.expira_en, new Date())));
}

/** Para el script `npm run sesiones:limpiar`. Devuelve cuantas borro. */
export async function borrarSesionesVencidasAntes(fecha: Date): Promise<number> {
  const filas = await db.delete(sesion).where(lt(sesion.expira_en, fecha)).returning({
    id_sesion: sesion.id_sesion,
  });
  return filas.length;
}

/**
 * Rotacion atomica: revoca la sesion actual e inserta la nueva en UNA
 * transaccion. Si algo falla, no queda una sesion revocada sin reemplazo.
 * La transaccion vive aqui (no en el service) para que el service no importe
 * Drizzle, respetando la regla de capas.
 */
export async function rotarSesion(datos: {
  idSesionVieja: string;
  nueva: NuevaSesion;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const ahora = new Date();
    await tx
      .update(sesion)
      .set({ revocada_en: ahora })
      .where(and(eq(sesion.id_sesion, datos.idSesionVieja), isNull(sesion.revocada_en)));

    await tx.insert(sesion).values({
      id_sesion: datos.nueva.idSesion,
      id_usuario: datos.nueva.idUsuario,
      familia: datos.nueva.familia,
      token_hash: datos.nueva.tokenHash,
      expira_en: datos.nueva.expiraEn,
      user_agent: datos.nueva.userAgent ?? null,
      ip: datos.nueva.ip ?? null,
    });
  });
}
