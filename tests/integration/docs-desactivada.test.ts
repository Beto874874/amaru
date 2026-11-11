import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HAY_BASE_DE_PRUEBAS } from '../setup.js';

// Se desactiva la documentacion ANTES de importar la app: env.ts se evalua una
// sola vez y app.ts monta (o no) el router de docs segun DOCS_ENABLED.
process.env.DOCS_ENABLED = 'false';

describe.skipIf(!HAY_BASE_DE_PRUEBAS)('integracion: documentacion desactivada', () => {
  let app: Express;
  let cerrar: () => Promise<void>;

  beforeAll(async () => {
    const [{ crearApp }, { pool }] = await Promise.all([
      import('../../src/app.js'),
      import('../../src/config/db.js'),
    ]);
    app = crearApp();
    cerrar = () => pool.end();
  });

  afterAll(async () => {
    await cerrar();
  });

  it('con DOCS_ENABLED=false responde 404 en /openapi.json y /docs', async () => {
    const contrato = await request(app).get('/api/openapi.json');
    expect(contrato.status).toBe(404);
    expect(contrato.body.error).toMatchObject({ code: 'RUTA_NO_ENCONTRADA' });

    const docs = await request(app).get('/api/docs/');
    expect(docs.status).toBe(404);
  });
});
