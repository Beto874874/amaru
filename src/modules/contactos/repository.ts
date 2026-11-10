import { and, asc, count, eq, ilike, isNull } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { contacto } from '../../db/schema/index.js';
import { escaparLike } from '../../shared/sql.js';

export interface DatosContacto {
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
}

export interface ContactoFila extends DatosContacto {
  id: number;
}

const seleccion = {
  id: contacto.id_contacto,
  nombre: contacto.nombre,
  telefono: contacto.telefono,
  direccion: contacto.direccion,
  correo: contacto.correo,
} as const;

/** Condiciones de igualdad exacta (NULL = NULL, como el UNIQUE de la base). */
function condicionesExactas(datos: DatosContacto) {
  return [
    eq(contacto.nombre, datos.nombre),
    datos.telefono === null ? isNull(contacto.telefono) : eq(contacto.telefono, datos.telefono),
    datos.direccion === null ? isNull(contacto.direccion) : eq(contacto.direccion, datos.direccion),
    datos.correo === null ? isNull(contacto.correo) : eq(contacto.correo, datos.correo),
  ];
}

export async function listar(
  filtros: { q?: string },
  paginacion: { offset: number; limit: number },
): Promise<{ filas: ContactoFila[]; total: number }> {
  const where = filtros.q
    ? ilike(contacto.nombre, `%${escaparLike(filtros.q)}%`)
    : undefined;

  const totalFilas = await db.select({ total: count() }).from(contacto).where(where);
  const total = totalFilas[0]?.total ?? 0;

  const filas = await db
    .select(seleccion)
    .from(contacto)
    .where(where)
    .orderBy(asc(contacto.nombre), asc(contacto.id_contacto))
    .limit(paginacion.limit)
    .offset(paginacion.offset);

  return { filas, total };
}

export async function buscarPorId(id: number): Promise<ContactoFila | undefined> {
  const filas = await db
    .select(seleccion)
    .from(contacto)
    .where(eq(contacto.id_contacto, id))
    .limit(1);
  return filas[0];
}

/**
 * "Buscar o crear": INSERT ... ON CONFLICT DO NOTHING + SELECT evita la carrera
 * entre dos peticiones simultaneas sin adivinar el id. `creado` permite al
 * controller responder 201 (nuevo) o 200 (ya existia).
 */
export async function buscarOCrear(
  datos: DatosContacto,
): Promise<{ contacto: ContactoFila; creado: boolean }> {
  const insertados = await db
    .insert(contacto)
    .values(datos)
    .onConflictDoNothing({
      target: [contacto.nombre, contacto.telefono, contacto.direccion, contacto.correo],
    })
    .returning({ id: contacto.id_contacto });

  const insertado = insertados[0];
  if (insertado) {
    const fila = await buscarPorId(insertado.id);
    if (!fila) throw new Error('No se pudo leer el contacto recien creado');
    return { contacto: fila, creado: true };
  }

  const filas = await db
    .select(seleccion)
    .from(contacto)
    .where(and(...condicionesExactas(datos)))
    .limit(1);
  const fila = filas[0];
  if (!fila) throw new Error('No se pudo resolver el contacto despues del conflicto');
  return { contacto: fila, creado: false };
}

export async function actualizar(
  id: number,
  cambios: { nombre?: string; telefono?: string | null; direccion?: string | null; correo?: string | null },
): Promise<ContactoFila | undefined> {
  const valores: Partial<typeof contacto.$inferInsert> = {};
  if (cambios.nombre !== undefined) valores.nombre = cambios.nombre;
  if (cambios.telefono !== undefined) valores.telefono = cambios.telefono;
  if (cambios.direccion !== undefined) valores.direccion = cambios.direccion;
  if (cambios.correo !== undefined) valores.correo = cambios.correo;

  const filas = await db
    .update(contacto)
    .set(valores)
    .where(eq(contacto.id_contacto, id))
    .returning(seleccion);
  return filas[0];
}

export async function eliminar(id: number): Promise<boolean> {
  const filas = await db
    .delete(contacto)
    .where(eq(contacto.id_contacto, id))
    .returning({ id: contacto.id_contacto });
  return filas.length > 0;
}
