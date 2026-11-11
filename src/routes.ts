import { Router } from 'express';
import { authRouter } from './modules/auth/routes.js';
import { catalogosRouter } from './modules/catalogos/routes.js';
import { contactosRouter } from './modules/contactos/routes.js';
import { importacionRouter } from './modules/importacion/routes.js';
import { inmueblesRouter } from './modules/inmuebles/routes.js';
import { sistemaRouter } from './modules/sistema/routes.js';

// Montaje de todos los modulos bajo /api/v1. Los prefijos de recurso viven
// aqui para que app.ts solo conozca un router de API.
export const apiRouter = Router();

apiRouter.use(sistemaRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use(catalogosRouter);
apiRouter.use('/contactos', contactosRouter);
apiRouter.use('/importacion', importacionRouter);
apiRouter.use('/inmuebles', inmueblesRouter);
