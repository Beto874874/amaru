import { app } from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const servidor = app.listen(env.PORT, () => {
  logger.info(
    { puerto: env.PORT, entorno: env.NODE_ENV, docs: env.DOCS_ENABLED },
    'API de Inmuebles escuchando',
  );
});

let cerrando = false;

// Apagado ordenado: deja de aceptar peticiones, espera a las en curso y cierra
// el pool. Un timeout evita quedarse colgado si algo no termina.
function apagar(senal: string): void {
  if (cerrando) return;
  cerrando = true;
  logger.info({ senal }, 'Cerrando el servidor...');

  servidor.close((error) => {
    void (async () => {
      try {
        await pool.end();
        logger.info('Pool de Postgres cerrado');
      } finally {
        process.exit(error ? 1 : 0);
      }
    })();
  });

  setTimeout(() => {
    logger.error('El apagado excedio 10 s; se fuerza la salida');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));

// Un error no controlado deja el proceso en estado desconocido: se loguea y se
// sale con codigo 1 para que la plataforma reinicie el servicio.
process.on('unhandledRejection', (motivo) => {
  logger.fatal({ err: motivo }, 'Promesa rechazada sin manejar');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Excepcion no capturada');
  process.exit(1);
});
