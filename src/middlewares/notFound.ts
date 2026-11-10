import type { RequestHandler } from 'express';

// Cualquier URL que no coincida con una ruta conocida responde en el formato
// unico de error, no con el HTML de Express.
export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'RUTA_NO_ENCONTRADA',
      message: `La ruta ${req.method} ${req.originalUrl} no existe`,
    },
  });
};
