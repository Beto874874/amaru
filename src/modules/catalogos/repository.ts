import { asc, eq } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { ciudad, departamento, tipoInmueble } from '../../db/schema/index.js';

// ---------------------------------------------------------------------------
// Departamentos
// ---------------------------------------------------------------------------

export async function listarDepartamentos(): Promise<{ id: number; nombre: string }[]> {
  return db
    .select({ id: departamento.id_departamento, nombre: departamento.nombre })
    .from(departamento)
    .orderBy(asc(departamento.nombre));
}

export async function buscarDepartamento(
  id: number,
): Promise<{ id: number; nombre: string } | undefined> {
  const filas = await db
    .select({ id: departamento.id_departamento, nombre: departamento.nombre })
    .from(departamento)
    .where(eq(departamento.id_departamento, id))
    .limit(1);
  return filas[0];
}

export async function crearDepartamento(nombre: string): Promise<{ id: number; nombre: string }> {
  const filas = await db
    .insert(departamento)
    .values({ nombre })
    .returning({ id: departamento.id_departamento, nombre: departamento.nombre });
  const fila = filas[0];
  if (!fila) throw new Error('No se pudo crear el departamento');
  return fila;
}

export async function actualizarDepartamento(
  id: number,
  nombre: string,
): Promise<{ id: number; nombre: string } | undefined> {
  const filas = await db
    .update(departamento)
    .set({ nombre })
    .where(eq(departamento.id_departamento, id))
    .returning({ id: departamento.id_departamento, nombre: departamento.nombre });
  return filas[0];
}

export async function eliminarDepartamento(id: number): Promise<boolean> {
  const filas = await db
    .delete(departamento)
    .where(eq(departamento.id_departamento, id))
    .returning({ id: departamento.id_departamento });
  return filas.length > 0;
}

// ---------------------------------------------------------------------------
// Ciudades
// ---------------------------------------------------------------------------

export async function listarCiudades(
  idDepartamento?: number,
): Promise<{ id: number; nombre: string; id_departamento: number }[]> {
  const consulta = db
    .select({
      id: ciudad.id_ciudad,
      nombre: ciudad.nombre,
      id_departamento: ciudad.id_departamento,
    })
    .from(ciudad);

  const filas = idDepartamento
    ? await consulta
        .where(eq(ciudad.id_departamento, idDepartamento))
        .orderBy(asc(ciudad.nombre), asc(ciudad.id_ciudad))
    : await consulta.orderBy(asc(ciudad.nombre), asc(ciudad.id_ciudad));
  return filas;
}

export async function buscarCiudad(
  id: number,
): Promise<{ id: number; nombre: string; id_departamento: number } | undefined> {
  const filas = await db
    .select({
      id: ciudad.id_ciudad,
      nombre: ciudad.nombre,
      id_departamento: ciudad.id_departamento,
    })
    .from(ciudad)
    .where(eq(ciudad.id_ciudad, id))
    .limit(1);
  return filas[0];
}

export async function crearCiudad(datos: {
  nombre: string;
  idDepartamento: number;
}): Promise<{ id: number; nombre: string; id_departamento: number }> {
  const filas = await db
    .insert(ciudad)
    .values({ nombre: datos.nombre, id_departamento: datos.idDepartamento })
    .returning({
      id: ciudad.id_ciudad,
      nombre: ciudad.nombre,
      id_departamento: ciudad.id_departamento,
    });
  const fila = filas[0];
  if (!fila) throw new Error('No se pudo crear la ciudad');
  return fila;
}

export async function actualizarCiudad(
  id: number,
  cambios: { nombre?: string; idDepartamento?: number },
): Promise<{ id: number; nombre: string; id_departamento: number } | undefined> {
  const valores: Partial<typeof ciudad.$inferInsert> = {};
  if (cambios.nombre !== undefined) valores.nombre = cambios.nombre;
  if (cambios.idDepartamento !== undefined) valores.id_departamento = cambios.idDepartamento;

  const filas = await db
    .update(ciudad)
    .set(valores)
    .where(eq(ciudad.id_ciudad, id))
    .returning({
      id: ciudad.id_ciudad,
      nombre: ciudad.nombre,
      id_departamento: ciudad.id_departamento,
    });
  return filas[0];
}

export async function eliminarCiudad(id: number): Promise<boolean> {
  const filas = await db
    .delete(ciudad)
    .where(eq(ciudad.id_ciudad, id))
    .returning({ id: ciudad.id_ciudad });
  return filas.length > 0;
}

// ---------------------------------------------------------------------------
// Tipos de inmueble
// ---------------------------------------------------------------------------

export async function listarTipos(): Promise<{ id: number; nombre: string }[]> {
  return db
    .select({ id: tipoInmueble.id_tipo, nombre: tipoInmueble.nombre })
    .from(tipoInmueble)
    .orderBy(asc(tipoInmueble.nombre));
}

export async function buscarTipo(id: number): Promise<{ id: number; nombre: string } | undefined> {
  const filas = await db
    .select({ id: tipoInmueble.id_tipo, nombre: tipoInmueble.nombre })
    .from(tipoInmueble)
    .where(eq(tipoInmueble.id_tipo, id))
    .limit(1);
  return filas[0];
}

export async function crearTipo(nombre: string): Promise<{ id: number; nombre: string }> {
  const filas = await db
    .insert(tipoInmueble)
    .values({ nombre })
    .returning({ id: tipoInmueble.id_tipo, nombre: tipoInmueble.nombre });
  const fila = filas[0];
  if (!fila) throw new Error('No se pudo crear el tipo de inmueble');
  return fila;
}

export async function actualizarTipo(
  id: number,
  nombre: string,
): Promise<{ id: number; nombre: string } | undefined> {
  const filas = await db
    .update(tipoInmueble)
    .set({ nombre })
    .where(eq(tipoInmueble.id_tipo, id))
    .returning({ id: tipoInmueble.id_tipo, nombre: tipoInmueble.nombre });
  return filas[0];
}

export async function eliminarTipo(id: number): Promise<boolean> {
  const filas = await db
    .delete(tipoInmueble)
    .where(eq(tipoInmueble.id_tipo, id))
    .returning({ id: tipoInmueble.id_tipo });
  return filas.length > 0;
}
