import { logger } from '../../config/logger.js';
import { comprobarBaseDeDatos } from './repository.js';

/** Devuelve true si la base responde; no propaga el error a la capa HTTP. */
export async function baseDeDatosDisponible(): Promise<boolean> {
  try {
    await comprobarBaseDeDatos();
    return true;
  } catch (error) {
    logger.error({ err: error }, 'La base de datos no responde al healthcheck');
    return false;
  }
}
