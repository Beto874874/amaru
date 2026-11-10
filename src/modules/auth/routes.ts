import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { limitadorAuth, limitadorRefresh } from '../../middlewares/rateLimiters.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './controller.js';
import {
  actualizarPerfilSchema,
  cambiarPasswordSchema,
  loginSchema,
  registroSchema,
} from './schemas.js';

// Prefijo /api/v1/auth. Los limitadores especificos se suman al general.
export const authRouter = Router();

authRouter.post('/register', limitadorAuth, validate({ body: registroSchema }), controller.registrar);

authRouter.post('/login', limitadorAuth, validate({ body: loginSchema }), controller.iniciarSesion);

// Refresh puede llamarse mas a menudo (varias pestanas): limite mas holgado.
authRouter.post('/refresh', limitadorRefresh, controller.refrescar);

// Logout es publico e idempotente: funciona aunque el access ya haya vencido.
authRouter.post('/logout', controller.cerrarSesion);

authRouter.post('/logout-all', authenticate, controller.cerrarTodasLasSesiones);

authRouter.get('/me', authenticate, controller.obtenerPerfil);

authRouter.patch(
  '/me',
  authenticate,
  validate({ body: actualizarPerfilSchema }),
  controller.actualizarPerfil,
);

authRouter.patch(
  '/password',
  authenticate,
  validate({ body: cambiarPasswordSchema }),
  controller.cambiarPassword,
);
