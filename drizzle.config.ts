// Configuracion de drizzle-kit. Solo se usa `drizzle-kit pull` para ESPEJAR
// la base en src/db/schema. No se usan generate/migrate/push: el origen de
// verdad del esquema son los archivos SQL de /sql (seccion 2.8).
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  throw new Error('Falta DIRECT_URL en .env: drizzle-kit la necesita para hacer pull.');
}

export default defineConfig({
  dialect: 'postgresql',
  // Carpeta temporal: el resultado se revisa y se reparte en src/db/schema.
  out: './.drizzle-pull',
  dbCredentials: {
    url: directUrl,
    ssl: 'require',
  },
  schemaFilter: ['public'],
  // Preserva los nombres snake_case de la base (no los convierte a camelCase),
  // para que el codigo TypeScript hable el mismo idioma que el SQL.
  introspect: { casing: 'preserve' },
  verbose: true,
  strict: true,
});
