import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { optionalAuth } from '../../middlewares/optionalAuth.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './controller.js';
import {
  actualizarInmuebleSchema,
  crearInmuebleSchema,
  idInmuebleParamsSchema,
  listarInmueblesSchema,
} from './schemas.js';

// Prefijo /api/v1/inmuebles.
export const inmueblesRouter = Router();

// Publico: optionalAuth permite que el DTO marque `es_mio` y que `mias=true`
// exija sesion dentro del service (401 si no hay usuario).
inmueblesRouter.get('/', optionalAuth, validate({ query: listarInmueblesSchema }), controller.listar);

inmueblesRouter.get(
  '/:id',
  optionalAuth,
  validate({ params: idInmuebleParamsSchema }),
  controller.obtener,
);

inmueblesRouter.post('/', authenticate, validate({ body: crearInmuebleSchema }), controller.crear);

inmueblesRouter.patch(
  '/:id',
  authenticate,
  validate({ params: idInmuebleParamsSchema, body: actualizarInmuebleSchema }),
  controller.actualizar,
);

inmueblesRouter.delete(
  '/:id',
  authenticate,
  validate({ params: idInmuebleParamsSchema }),
  controller.eliminar,
);
