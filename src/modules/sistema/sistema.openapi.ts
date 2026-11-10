import { registry } from '../../docs/registry.js';
import { respuestasError } from '../../docs/components.js';
import { healthRespuestaSchema } from './schemas.js';

// La ruta documentada es relativa al servidor '/api/v1'.
registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Sistema'],
  summary: 'Comprueba que el API y la base de datos responden',
  description: 'Publico. Ejecuta `select 1` contra Supabase. Util para el healthcheck del despliegue.',
  security: [],
  responses: {
    200: {
      description: 'El API y la base de datos responden',
      content: {
        'application/json': {
          schema: healthRespuestaSchema,
          example: { status: 'ok', db: 'ok' },
        },
      },
    },
    429: respuestasError[429],
    500: respuestasError[500],
  },
});
