import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { limitadorSubidas } from '../../middlewares/rateLimiters.js';
import { subirImagenes } from '../../middlewares/uploadImagenes.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './controller.js';
import {
  actualizarImagenSchema,
  idImagenParamsSchema,
  idInmuebleParamsSchema,
} from './schemas.js';

// Prefijo /api/v1/inmuebles/:id/imagenes. mergeParams deja leer :id.
export const imagenesRouter = Router({ mergeParams: true });

// Todas las rutas exigen sesion; la propiedad se valida en el service.
imagenesRouter.use(authenticate);

imagenesRouter.post(
  '/',
  validate({ params: idInmuebleParamsSchema }),
  limitadorSubidas,
  subirImagenes,
  controller.subir,
);

imagenesRouter.patch(
  '/:idImagen',
  validate({ params: idImagenParamsSchema, body: actualizarImagenSchema }),
  controller.actualizar,
);

imagenesRouter.delete(
  '/:idImagen',
  validate({ params: idImagenParamsSchema }),
  controller.eliminar,
);
