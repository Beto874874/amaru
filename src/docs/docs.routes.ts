import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './openapi.js';

// Se construye UNA sola vez al arrancar, no por peticion.
const documento = buildOpenApiDocument();

export const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(documento);
});

// CSP propia y relajada SOLO para la interfaz de Swagger UI. El router de docs
// se monta ANTES del helmet global, asi que la politica estricta del resto del
// API no se toca. Swagger UI necesita scripts y estilos en linea y fuentes/imagenes data:.
const cspSwagger = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
});

docsRouter.use(
  '/docs',
  cspSwagger,
  swaggerUi.serve,
  swaggerUi.setup(documento, {
    customSiteTitle: 'API de Inmuebles en Arriendo',
    swaggerOptions: { persistAuthorization: false, displayRequestDuration: true },
  }),
);
