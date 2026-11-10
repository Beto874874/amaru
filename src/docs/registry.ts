import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from '../shared/zod.js';

// Habilita .openapi() en los esquemas Zod (metadatos de documentacion).
extendZodWithOpenApi(z);

// UN solo registro para toda la API. Cada modulo agrega sus paths y esquemas
// al importarse, y openapi.ts genera el documento a partir de el.
export const registry = new OpenAPIRegistry();
