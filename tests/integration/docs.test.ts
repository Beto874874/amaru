import type { Express } from 'express';
import { afterAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { HAY_BASE_DE_PRUEBAS } from '../setup.js';
import { agenteDe } from './apoyo.js';

describe.skipIf(!HAY_BASE_DE_PRUEBAS)('integracion: documentacion', () => {
  let app: Express;

  afterAll(async () => {
    await pool.end();
  });

  it('sirve el contrato OpenAPI 3.1 y la interfaz de Swagger', async () => {
    app = crearApp();

    const contrato = await agenteDe(app).get('/api/openapi.json');
    expect(contrato.status).toBe(200);
    expect(contrato.body.openapi).toMatch(/^3\.1/);
    expect(Object.keys(contrato.body.paths)).toEqual(
      expect.arrayContaining(['/inmuebles', '/auth/login', '/importacion/inmuebles']),
    );

    const swagger = await agenteDe(app).get('/api/docs/');
    expect(swagger.status).toBe(200);
    expect(swagger.text).toContain('swagger-ui');
  });
});
