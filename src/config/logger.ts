import pino from 'pino';
import { env, isProduction } from './env.js';

// Logs estructurados en JSON (faciles de parsear en produccion) y legibles en
// desarrollo con pino-pretty.
export const logger = pino({
  level: env.LOG_LEVEL,
  // Defensa en profundidad: aunque el logger de peticiones ya redacta, aqui se
  // evita que cualquier log accidental filtre credenciales.
  redact: {
    paths: [
      'password',
      'password_hash',
      'passwordActual',
      'passwordNueva',
      'token',
      'token_hash',
      'cookie',
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTADO]',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});
