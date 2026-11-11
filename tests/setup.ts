import { existsSync } from 'node:fs';
import { config } from 'dotenv';

// Las pruebas de integracion usan SOLO .env.test (una base desechable, p. ej.
// un Postgres en Docker). Nunca se lee .env: la guia prohibe apuntar las
// pruebas a la base real.
const hayEnvTest = existsSync('.env.test');
if (hayEnvTest) {
  config({ path: '.env.test' });
}

// En pruebas los logs estructurados solo añaden ruido a la salida de vitest.
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

// Valores ficticios para que las pruebas UNITARIAS puedan importar modulos que
// validan el entorno, sin necesitar una base de datos.
if (!process.env.DATABASE_URL) {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/inmuebles_test';
  process.env.DIRECT_URL = 'postgresql://test:test@localhost:5432/inmuebles_test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.API_PUBLIC_URL = 'http://localhost:3000';
  process.env.DOCS_ENABLED = 'true';
}

// Guard de seguridad: si hay base de pruebas configurada, su host debe estar
// declarado en TEST_DB_HOST_ALLOWED. Asi un .env.test mal copiado (con la base
// real) aborta en vez de borrar datos de produccion.
if (hayEnvTest) {
  const permitidos = (process.env.TEST_DB_HOST_ALLOWED ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').hostname;
    } catch {
      return '';
    }
  })();

  if (!host) {
    throw new Error('Pruebas: DATABASE_URL de .env.test no es una URL valida');
  }
  if (permitidos.length === 0) {
    throw new Error(
      'Pruebas: define TEST_DB_HOST_ALLOWED en .env.test con el host de la base de pruebas',
    );
  }
  if (!permitidos.includes(host)) {
    throw new Error(
      `Pruebas ABORTADAS: DATABASE_URL apunta a "${host}", que no esta en TEST_DB_HOST_ALLOWED. ` +
        'Las pruebas borran datos: nunca las apuntes a la base real.',
    );
  }
}

export const HAY_BASE_DE_PRUEBAS = hayEnvTest;
