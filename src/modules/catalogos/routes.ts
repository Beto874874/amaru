import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './controller.js';
import {
  actualizarCiudadSchema,
  actualizarNombreSchema,
  crearCiudadSchema,
  crearNombreSchema,
  idCatalogoParamsSchema,
  listarCiudadesQuerySchema,
} from './schemas.js';

// Prefijo /api/v1. Lectura publica; escritura solo admin.
export const catalogosRouter = Router();

// ---------------------------------------------------------------------------
// Departamentos
// ---------------------------------------------------------------------------

catalogosRouter.get('/departamentos', controller.listarDepartamentos);

catalogosRouter.post(
  '/departamentos',
  authenticate,
  requireRole('admin'),
  validate({ body: crearNombreSchema }),
  controller.crearDepartamento,
);

catalogosRouter.patch(
  '/departamentos/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idCatalogoParamsSchema, body: actualizarNombreSchema }),
  controller.actualizarDepartamento,
);

catalogosRouter.delete(
  '/departamentos/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idCatalogoParamsSchema }),
  controller.eliminarDepartamento,
);

// ---------------------------------------------------------------------------
// Ciudades
// ---------------------------------------------------------------------------

catalogosRouter.get(
  '/ciudades',
  validate({ query: listarCiudadesQuerySchema }),
  controller.listarCiudades,
);

catalogosRouter.post(
  '/ciudades',
  authenticate,
  requireRole('admin'),
  validate({ body: crearCiudadSchema }),
  controller.crearCiudad,
);

catalogosRouter.patch(
  '/ciudades/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idCatalogoParamsSchema, body: actualizarCiudadSchema }),
  controller.actualizarCiudad,
);

catalogosRouter.delete(
  '/ciudades/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idCatalogoParamsSchema }),
  controller.eliminarCiudad,
);

// ---------------------------------------------------------------------------
// Tipos de inmueble
// ---------------------------------------------------------------------------

catalogosRouter.get('/tipos-inmueble', controller.listarTipos);

catalogosRouter.post(
  '/tipos-inmueble',
  authenticate,
  requireRole('admin'),
  validate({ body: crearNombreSchema }),
  controller.crearTipo,
);

catalogosRouter.patch(
  '/tipos-inmueble/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idCatalogoParamsSchema, body: actualizarNombreSchema }),
  controller.actualizarTipo,
);

catalogosRouter.delete(
  '/tipos-inmueble/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idCatalogoParamsSchema }),
  controller.eliminarTipo,
);
