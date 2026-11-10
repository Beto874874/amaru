import { z } from '../../shared/zod.js';

/** Respuesta de GET /health. */
export const healthRespuestaSchema = z.strictObject({
  status: z.literal('ok'),
  db: z.literal('ok'),
});
