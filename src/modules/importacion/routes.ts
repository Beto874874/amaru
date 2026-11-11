import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { subirArchivoCsv } from '../../middlewares/uploadCsv.js';
import * as controller from './controller.js';

// Prefijo /api/v1. La importacion masiva es exclusiva de admin.
export const importacionRouter = Router();

importacionRouter.post(
  '/inmuebles',
  authenticate,
  requireRole('admin'),
  subirArchivoCsv,
  controller.importarInmuebles,
);
