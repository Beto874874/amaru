import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { docsRouter } from './docs/docs.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { originCheck } from './middlewares/originCheck.js';
import { limitadorGeneral } from './middlewares/rateLimiters.js';
import { apiRouter } from './routes.js';

/**
 * Crea y configura Express SIN abrir un puerto. server.ts se encarga de eso;
 * separarlo permite que supertest importe `app` sin levantar un servidor real.
 */
export function crearApp(): Express {
  const app = express();

  // Detras de un proxy (Render, Railway, Fly) hay que confiar en el primer proxy
  // para que req.ip y el rate limit vean la IP real del cliente.
  app.set('trust proxy', env.TRUST_PROXY ? 1 : false);
  app.disable('x-powered-by');

  // 1) Logs de peticiones. Redacta cookies y cabeceras de autorizacion para que
  //    nunca aparezcan en los logs.
  app.use(
    pinoHttp({
      logger,
      redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
      ],
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // 2) Documentacion: ANTES del helmet global y con su propia CSP relajada.
  if (env.DOCS_ENABLED) {
    app.use('/api', docsRouter);
  }

  // 3) Cabeceras de seguridad para el resto del API (CSP estricta por defecto).
  app.use(helmet());

  // 4) CORS con lista explicita y cookies. Nunca '*' con credentials.
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));

  // 5) Body JSON con limite (evita payloads gigantes).
  app.use(express.json({ limit: '100kb' }));

  // 6) cookie-parser sin secreto: los JWT ya estan firmados; el secreto solo
  //    haria falta para cookies firmadas, que no se usan.
  app.use(cookieParser());

  // 7) Rate limit general.
  app.use(limitadorGeneral);

  // 8) Defensa CSRF para metodos que modifican estado.
  app.use(originCheck);

  // 9-11) Rutas, 404 y manejador de errores.
  app.use('/api/v1', apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = crearApp();
