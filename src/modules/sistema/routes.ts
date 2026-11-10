import { Router } from 'express';
import { obtenerSalud } from './controller.js';

export const sistemaRouter = Router();

sistemaRouter.get('/health', obtenerSalud);
