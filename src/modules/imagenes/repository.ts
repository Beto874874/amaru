import { and, asc, count, desc, eq } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { inmueble, inmuebleImagen } from '../../db/schema/index.js';
import { MAX_IMAGENES_POR_INMUEBLE } from './schemas.js';

export type ImagenFila = typeof inmuebleImagen.$inferSelect;

export interface NuevaImagen {
  ruta: string;
  rutaMiniatura: string;
  ancho: number;
  alto: number;
  bytes: number;
}

export interface CambiosImagen {
  es_principal?: true;
  orden?: number;
}

export type ResultadoCreacion =
  | { estado: 'ok'; filas: ImagenFila[] }
  | { estado: 'limite' }
  | { estado: 'inmueble-inexistente' };

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export async function contarPorInmueble(idInmueble: number): Promise<number> {
  const filas = await db
    .select({ total: count() })
    .from(inmuebleImagen)
    .where(eq(inmuebleImagen.id_inmueble, idInmueble));
  return filas[0]?.total ?? 0;
}

export async function listarPorInmueble(idInmueble: number): Promise<ImagenFila[]> {
  return db
    .select()
    .from(inmuebleImagen)
    .where(eq(inmuebleImagen.id_inmueble, idInmueble))
    .orderBy(asc(inmuebleImagen.orden), asc(inmuebleImagen.id_imagen));
}

/** Busca SOLO dentro del inmueble: una imagen de otro inmueble es un 404. */
export async function buscarPorIdEnInmueble(
  idInmueble: number,
  idImagen: number,
): Promise<ImagenFila | undefined> {
  const filas = await db
    .select()
    .from(inmuebleImagen)
    .where(
      and(
        eq(inmuebleImagen.id_inmueble, idInmueble),
        eq(inmuebleImagen.id_imagen, idImagen),
      ),
    )
    .limit(1);
  return filas[0];
}

/** Ambas rutas de cada foto, para limpiar Storage sin consultar dos veces. */
export async function listarRutasPorInmueble(idInmueble: number): Promise<string[]> {
  const filas = await db
    .select({
      ruta: inmuebleImagen.ruta,
      ruta_miniatura: inmuebleImagen.ruta_miniatura,
    })
    .from(inmuebleImagen)
    .where(eq(inmuebleImagen.id_inmueble, idInmueble));

  return filas.flatMap((fila) => [fila.ruta, fila.ruta_miniatura]);
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/**
 * Inserta las fotos en UNA transaccion y bloquea la fila del inmueble
 * (SELECT ... FOR UPDATE). Asi dos subidas simultaneas no pueden pasar del
 * limite de 10 ni calcular el mismo `orden`.
 */
export async function crearImagenes(
  idInmueble: number,
  nuevas: NuevaImagen[],
): Promise<ResultadoCreacion> {
  return db.transaction(async (tx): Promise<ResultadoCreacion> => {
    const bloqueado = await tx
      .select({ id: inmueble.id_inmueble })
      .from(inmueble)
      .where(eq(inmueble.id_inmueble, idInmueble))
      .for('update');

    if (!bloqueado[0]) return { estado: 'inmueble-inexistente' };

    const totalFilas = await tx
      .select({ total: count() })
      .from(inmuebleImagen)
      .where(eq(inmuebleImagen.id_inmueble, idInmueble));
    const total = totalFilas[0]?.total ?? 0;

    if (total + nuevas.length > MAX_IMAGENES_POR_INMUEBLE) {
      return { estado: 'limite' };
    }

    let siguienteOrden = 0;
    if (total > 0) {
      const ultima = await tx
        .select({ orden: inmuebleImagen.orden })
        .from(inmuebleImagen)
        .where(eq(inmuebleImagen.id_inmueble, idInmueble))
        .orderBy(desc(inmuebleImagen.orden), desc(inmuebleImagen.id_imagen))
        .limit(1);
      siguienteOrden = (ultima[0]?.orden ?? -1) + 1;
    }

    const filas = await tx
      .insert(inmuebleImagen)
      .values(
        nuevas.map((nueva, indice) => ({
          id_inmueble: idInmueble,
          ruta: nueva.ruta,
          ruta_miniatura: nueva.rutaMiniatura,
          ancho: nueva.ancho,
          alto: nueva.alto,
          bytes: nueva.bytes,
          orden: siguienteOrden + indice,
          // Solo la primera foto de un inmueble sin fotos es la principal.
          es_principal: total === 0 && indice === 0,
        })),
      )
      .returning();

    return { estado: 'ok', filas };
  });
}

/**
 * Cambia la principal y/o el orden. Para marcar la principal primero se
 * desmarcan TODAS: el indice unico parcial se comprueba fila a fila y fallaria
 * si se marca antes de desmarcar.
 */
export async function actualizarImagen(
  idInmueble: number,
  idImagen: number,
  cambios: CambiosImagen,
): Promise<ImagenFila | undefined> {
  return db.transaction(async (tx) => {
    if (cambios.es_principal) {
      await tx
        .update(inmuebleImagen)
        .set({ es_principal: false })
        .where(
          and(
            eq(inmuebleImagen.id_inmueble, idInmueble),
            eq(inmuebleImagen.es_principal, true),
          ),
        );
    }

    const valores: Partial<typeof inmuebleImagen.$inferInsert> = {};
    if (cambios.es_principal) valores.es_principal = true;
    if (cambios.orden !== undefined) valores.orden = cambios.orden;

    const filas = await tx
      .update(inmuebleImagen)
      .set(valores)
      .where(
        and(
          eq(inmuebleImagen.id_inmueble, idInmueble),
          eq(inmuebleImagen.id_imagen, idImagen),
        ),
      )
      .returning();

    return filas[0];
  });
}

/**
 * Borra la fila y, si era la principal, promueve la de menor orden (desempate
 * por id). Devuelve la fila borrada para que el service limpie Storage DESPUES
 * de confirmar la transaccion.
 */
export async function eliminarImagen(
  idInmueble: number,
  idImagen: number,
): Promise<ImagenFila | undefined> {
  return db.transaction(async (tx) => {
    const filas = await tx
      .select()
      .from(inmuebleImagen)
      .where(
        and(
          eq(inmuebleImagen.id_inmueble, idInmueble),
          eq(inmuebleImagen.id_imagen, idImagen),
        ),
      )
      .for('update');

    const fila = filas[0];
    if (!fila) return undefined;

    await tx
      .delete(inmuebleImagen)
      .where(
        and(
          eq(inmuebleImagen.id_inmueble, idInmueble),
          eq(inmuebleImagen.id_imagen, idImagen),
        ),
      );

    if (fila.es_principal) {
      const restantes = await tx
        .select({ id: inmuebleImagen.id_imagen })
        .from(inmuebleImagen)
        .where(eq(inmuebleImagen.id_inmueble, idInmueble))
        .orderBy(asc(inmuebleImagen.orden), asc(inmuebleImagen.id_imagen))
        .limit(1);

      const siguiente = restantes[0];
      if (siguiente) {
        await tx
          .update(inmuebleImagen)
          .set({ es_principal: true })
          .where(eq(inmuebleImagen.id_imagen, siguiente.id));
      }
    }

    return fila;
  });
}
