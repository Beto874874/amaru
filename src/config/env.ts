import { z } from 'zod';

// Un unico lugar lee process.env. Todo lo demas importa `env`.
// Si algo falta o no es valido, el proceso NO arranca: es mejor fallar al
// inicio que descubrir una variable mal puesta en medio de una peticion.
// Nunca se imprimen valores, solo los nombres de las variables que fallan.

const duracion = z
  .string()
  .regex(/^\d+(ms|s|m|h|d)$/, 'Formato de duracion invalido (ej: 15m, 7d)');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
    DIRECT_URL: z.string().min(1, 'DIRECT_URL es obligatoria'),
    // Supabase exige SSL. Se puede desactivar SOLO para una base local de
    // pruebas (Postgres en Docker no habla SSL).
    DB_SSL: z
      .string()
      .default('true')
      .transform((value) => value !== 'false'),
    DB_SSL_CA_PATH: z
      .string()
      .optional()
      .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined)),

    // --- Supabase Storage (solo fotos de inmuebles) ---
    // La clave secreta JAMAS se imprime: los errores de validacion muestran
    // solo el nombre del campo, nunca su valor.
    SUPABASE_URL: z.url('SUPABASE_URL debe ser una URL valida'),
    SUPABASE_SECRET_KEY: z
      .string()
      .min(20, 'SUPABASE_SECRET_KEY debe tener al menos 20 caracteres'),
    SUPABASE_BUCKET: z.string().min(1).default('inmuebles'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
    ACCESS_TOKEN_TTL: duracion.default('15m'),
    REFRESH_TOKEN_TTL: duracion.default('7d'),

    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined)),

    // Lista explicita separada por comas. Se valida que cada origen sea una URL.
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origen) => origen.trim())
          .filter((origen) => origen.length > 0),
      )
      .pipe(z.array(z.url()).min(1, 'CORS_ORIGINS debe tener al menos un origen')),

    TRUST_PROXY: z
      .string()
      .default('false')
      .transform((value) => value === 'true' || value === '1'),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    API_PUBLIC_URL: z.url().default('http://localhost:3000'),
    DOCS_ENABLED: z
      .string()
      .default('true')
      .transform((value) => value !== 'false'),
  })
  .superRefine((value, ctx) => {
    // Dos secretos distintos: si se filtra uno, el otro sigue protegiendo.
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'Debe ser distinto de JWT_ACCESS_SECRET',
      });
    }
    // SameSite=None exige cookies Secure, y Secure exige HTTPS/produccion.
    if (value.COOKIE_SAMESITE === 'none' && value.NODE_ENV !== 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SAMESITE'],
        message: "COOKIE_SAMESITE='none' solo se permite con NODE_ENV=production",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fallos = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('\n');
  // console.error es la unica salida posible aqui: el logger aun no existe.
  // eslint-disable-next-line no-console
  console.error(`Configuracion de entorno invalida:\n${fallos}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
