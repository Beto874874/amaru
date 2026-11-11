import { randomUUID } from 'node:crypto';
import * as storage from '../../infra/storage.js';
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/errors.js';
import { asegurarPuedeModificar, type UsuarioSolicitante } from '../inmuebles/service.js';
import { aImagenPublica } from './mapper.js';
import { procesarImagen } from './procesar.js';
import * as repo from './repository.js';
import type { ActualizarImagenInput, ImagenPublica } from './schemas.js';
import { MAX_IMAGENES_POR_INMUEBLE } from './schemas.js';

function imagenNoEncontrada(): NotFoundError {
  return new NotFoundError('IMAGEN_NO_ENCONTRADA', 'La imagen no existe en este inmueble');
}

function mensajeLimite(actuales: number): string {
  const disponibles = Math.max(0, MAX_IMAGENES_POR_INMUEBLE - actuales);
  return `El inmueble ya tiene ${actuales} imagenes y el maximo es ${MAX_IMAGENES_POR_INMUEBLE}. Puedes agregar ${disponibles} mas.`;
}

/**
 * POST: todo o nada. Primero procesa TODAS las imagenes en memoria; solo si
 * todas son validas sube archivos. Si algo falla despues, borra lo subido.
 */
export async function subir(
  usuario: UsuarioSolicitante,
  idInmueble: number,
  archivos: Express.Multer.File[],
): Promise<ImagenPublica[]> {
  if (archivos.length === 0) {
    throw new BadRequestError('IMAGEN_REQUERIDA', 'No se envio ningun archivo en el campo "imagenes"');
  }

  await asegurarPuedeModificar(usuario, idInmueble);

  const actuales = await repo.contarPorInmueble(idInmueble);
  if (actuales + archivos.length > MAX_IMAGENES_POR_INMUEBLE) {
    throw new ConflictError('LIMITE_IMAGENES', mensajeLimite(actuales));
  }

  // 1) Procesar todo antes de tocar Storage.
  const procesadas: Awaited<ReturnType<typeof procesarImagen>>[] = [];
  for (const [indice, archivo] of archivos.entries()) {
    try {
      procesadas.push(await procesarImagen(archivo.buffer));
    } catch (error) {
      if (error instanceof AppError && error.code === 'IMAGEN_INVALIDA') {
        throw new BadRequestError(
          'IMAGEN_INVALIDA',
          `La imagen en la posicion ${indice + 1} no es un JPEG, PNG o WebP valido`,
        );
      }
      throw error;
    }
  }

  // 2) Subir grande + miniatura de cada foto. La ruta la arma SOLO el servidor
  //    con un uuid: nunca se usa el nombre ni el texto que envio el cliente.
  const nuevas: repo.NuevaImagen[] = [];
  const subidas: string[] = [];

  try {
    for (const procesada of procesadas) {
      const base = randomUUID();
      const ruta = `inmuebles/${idInmueble}/${base}.webp`;
      const rutaMiniatura = `inmuebles/${idInmueble}/${base}_m.webp`;

      await storage.subir(ruta, procesada.grande);
      subidas.push(ruta);
      await storage.subir(rutaMiniatura, procesada.miniatura);
      subidas.push(rutaMiniatura);

      nuevas.push({
        ruta,
        rutaMiniatura,
        ancho: procesada.ancho,
        alto: procesada.alto,
        bytes: procesada.bytes,
      });
    }
  } catch (error) {
    // Compensacion: no dejar archivos subidos si la peticion no prospera.
    await storage.eliminar(subidas);
    throw error;
  }

  // 3) Una transaccion revalida el limite (evita carreras) e inserta las filas.
  let resultado: repo.ResultadoCreacion;
  try {
    resultado = await repo.crearImagenes(idInmueble, nuevas);
  } catch (error) {
    await storage.eliminar(subidas);
    throw error;
  }

  if (resultado.estado === 'limite') {
    await storage.eliminar(subidas);
    throw new ConflictError('LIMITE_IMAGENES', mensajeLimite(actuales));
  }
  if (resultado.estado === 'inmueble-inexistente') {
    await storage.eliminar(subidas);
    throw new NotFoundError('INMUEBLE_NO_ENCONTRADO', 'El inmueble no existe');
  }

  return resultado.filas
    .slice()
    .sort((a, b) => a.orden - b.orden || a.id_imagen - b.id_imagen)
    .map(aImagenPublica);
}

/** PATCH: cambiar la principal o el orden. */
export async function actualizar(
  usuario: UsuarioSolicitante,
  idInmueble: number,
  idImagen: number,
  cambios: ActualizarImagenInput,
): Promise<ImagenPublica> {
  await asegurarPuedeModificar(usuario, idInmueble);

  const existente = await repo.buscarPorIdEnInmueble(idInmueble, idImagen);
  if (!existente) throw imagenNoEncontrada();

  const actualizada = await repo.actualizarImagen(idInmueble, idImagen, cambios);
  if (!actualizada) throw imagenNoEncontrada();
  return aImagenPublica(actualizada);
}

/** DELETE: primero la base (dentro de la transaccion) y luego Storage. */
export async function eliminar(
  usuario: UsuarioSolicitante,
  idInmueble: number,
  idImagen: number,
): Promise<void> {
  await asegurarPuedeModificar(usuario, idInmueble);

  const eliminada = await repo.eliminarImagen(idInmueble, idImagen);
  if (!eliminada) throw imagenNoEncontrada();

  // Best effort: si falla, storage.eliminar solo lo registra en el log.
  await storage.eliminar([eliminada.ruta, eliminada.ruta_miniatura]);
}
