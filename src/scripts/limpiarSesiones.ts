import { pool } from '../config/db.js';
import { logger } from '../config/logger.js';
import { borrarSesionesVencidasAntes } from '../modules/auth/repository.js';

// Borra las sesiones expiradas hace mas de un dia. Se deja ese margen para no
// borrar filas recien vencidas que todavia sirven para auditar reutilizaciones.
// Uso: npm run sesiones:limpiar (idealmente programado a diario).
const UN_DIA_MS = 24 * 60 * 60 * 1000;
const limite = new Date(Date.now() - UN_DIA_MS);

try {
  const borradas = await borrarSesionesVencidasAntes(limite);
  logger.info({ borradas }, 'Limpieza de sesiones vencidas completada');
} catch (error) {
  logger.error({ err: error }, 'Fallo la limpieza de sesiones vencidas');
  process.exitCode = 1;
} finally {
  await pool.end();
}
