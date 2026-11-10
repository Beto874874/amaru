import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema/index.js';
import { env, isProduction } from './env.js';
import { logger } from './logger.js';

// Supabase exige conexion cifrada. Si hay certificado CA configurado se verifica
// contra el; en produccion sin CA se exige verificacion (fallara si el host no
// tiene un certificado valido, que es lo correcto). Solo en desarrollo se
// tolera rejectUnauthorized: false, como excepcion documentada por la guia.
function construirSsl(): pg.PoolConfig['ssl'] {
  if (env.DB_SSL_CA_PATH) {
    return {
      ca: readFileSync(env.DB_SSL_CA_PATH, 'utf8'),
      rejectUnauthorized: true,
    };
  }
  if (isProduction) {
    return { rejectUnauthorized: true };
  }
  // EXCEPCION SOLO DESARROLLO: el pooler de Supabase presenta una cadena que
  // Node no valida sin el CA descargado del dashboard.
  return { rejectUnauthorized: false };
}

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: construirSsl(),
  max: 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

// Sin este manejador, un error de una conexion inactiva (p. ej. el pooler corta
// la conexion) se convierte en un unhandled 'error' y tumba el proceso.
pool.on('error', (error) => {
  logger.error({ err: error }, 'Error en una conexion inactiva del pool de Postgres');
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;
