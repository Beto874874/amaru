import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from '../shared/errors.js';

// express-rate-limit v8 usa `limit` (no `max`) y `standardHeaders: 'draft-8'`.
// El handler reenvia un AppError para que la respuesta 429 salga en el formato
// unico de error.
const opcionesComunes = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (
    _req: unknown,
    _res: unknown,
    next: (error?: unknown) => void,
  ): void => {
    next(new TooManyRequestsError());
  },
} as const;

/** Limite general de la API: 300 peticiones / 15 min / IP. */
export const limitadorGeneral = rateLimit({
  ...opcionesComunes,
  windowMs: 15 * 60 * 1000,
  limit: 300,
});

/** Login y registro son los endpoints mas atacados: 10 / 15 min / IP. */
export const limitadorAuth = rateLimit({
  ...opcionesComunes,
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

/** Refresh puede llamarse mas a menudo (varias pestanas): 60 / 15 min / IP. */
export const limitadorRefresh = rateLimit({
  ...opcionesComunes,
  windowMs: 15 * 60 * 1000,
  limit: 60,
});
