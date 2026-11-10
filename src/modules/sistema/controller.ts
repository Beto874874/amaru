import type { RequestHandler } from 'express';
import { baseDeDatosDisponible } from './service.js';

// GET /api/v1/health (publico). Express 5 envia solo los errores async al
// middleware de errores; aqui se responde explicitamente 503 si la base falla.
export const obtenerSalud: RequestHandler = async (_req, res) => {
  const disponible = await baseDeDatosDisponible();
  if (!disponible) {
    res.status(503).json({
      error: {
        code: 'BASE_DE_DATOS_NO_DISPONIBLE',
        message: 'La base de datos no responde en este momento',
      },
    });
    return;
  }
  res.status(200).json({ status: 'ok', db: 'ok' });
};
