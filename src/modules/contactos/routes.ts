import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './controller.js';
import {
  actualizarContactoSchema,
  crearContactoSchema,
  idContactoParamsSchema,
  listarContactosSchema,
} from './schemas.js';

// Prefijo /api/v1/contactos.
export const contactosRouter = Router();

contactosRouter.get(
  '/',
  authenticate,
  validate({ query: listarContactosSchema }),
  controller.listar,
);

contactosRouter.post('/', authenticate, validate({ body: crearContactoSchema }), controller.crear);

contactosRouter.get(
  '/:id',
  authenticate,
  validate({ params: idContactoParamsSchema }),
  controller.obtener,
);

// PATCH/DELETE solo admin: un contacto lo comparten muchos inmuebles.
contactosRouter.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idContactoParamsSchema, body: actualizarContactoSchema }),
  controller.actualizar,
);

contactosRouter.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idContactoParamsSchema }),
  controller.eliminar,
);
