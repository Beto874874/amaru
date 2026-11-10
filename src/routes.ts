import { Router } from 'express';
import { sistemaRouter } from './modules/sistema/routes.js';

// Montaje de todos los modulos bajo /api/v1. Los prefijos de recurso viven
// aqui para que app.ts solo conozca un router de API.
export const apiRouter = Router();

apiRouter.use(sistemaRouter);
