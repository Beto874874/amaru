import type { Express } from 'express';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { HAY_BASE_DE_PRUEBAS } from '../setup.js';
import { agenteDe, limpiarYSeed, PASSWORD, registrar } from './apoyo.js';

const BASE = '/api/v1/inmuebles';

const DATOS_INMUEBLE = {
  codigo_sae: 'WEB-1',
  tipo_inmueble: 'Apartamento',
  departamento: 'Bogotá D.C.',
  ciudad: 'Bogotá D.C.',
  direccion: 'CL 119 A 57 60',
  estrato: '3',
  valor_arriendo: '1500000',
  area_construida: '60.5',
  nombre_contacto: 'Inmobiliaria Uno',
  telefono_contacto: '3001234567',
  correo_contacto: '  INMO@EJEMPLO.COM ',
};

describe.skipIf(!HAY_BASE_DE_PRUEBAS)('integracion: inmuebles', () => {
  let app: Express;

  beforeEach(async () => {
    await limpiarYSeed();
    app = crearApp();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('flujo completo: crear, ver publico, editar como dueno, 403 ajeno y borrar', async () => {
    const dueno = agenteDe(app);
    await registrar(dueno, {
      nombre: 'Dueno',
      email: 'dueno@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));

    const creado = await dueno.post(BASE).send(DATOS_INMUEBLE);
    expect(creado.status).toBe(201);

    const inmueble = creado.body.inmueble;
    expect(inmueble).toMatchObject({
      id: expect.any(Number),
      codigo_sae: 'WEB-1',
      nombre: 'Apartamento - WEB-1',
      tipo: 'Apartamento',
      departamento: 'Bogotá D.C.',
      ciudad: 'Bogotá D.C.',
      estrato: 3,
      valor_arriendo: 1500000,
      area_construida: 60.5,
      estado: 'Disponible',
      publicado_por_usuario: true,
      es_mio: true,
      contacto: {
        nombre: 'Inmobiliaria Uno',
        telefono: '3001234567',
        correo: 'inmo@ejemplo.com',
      },
    });
    // El DTO no debe filtrar datos del dueno.
    expect(inmueble).not.toHaveProperty('id_usuario');
    expect(inmueble).not.toHaveProperty('email');

    const id = inmueble.id as number;

    // Publico sin cookie: lista y detalle 200, es_mio false.
    const detallePublico = await agenteDe(app).get(`${BASE}/${id}`);
    expect(detallePublico.status).toBe(200);
    expect(detallePublico.body.inmueble.es_mio).toBe(false);

    const listaPublica = await agenteDe(app).get(BASE);
    expect(listaPublica.status).toBe(200);
    expect(listaPublica.body.meta).toMatchObject({ total: 1, totalPages: 1, page: 1 });
    expect(listaPublica.body.data[0].es_mio).toBe(false);

    // El dueno ve es_mio=true y puede editar (incluido vaciar con null).
    const detalleDueno = await dueno.get(`${BASE}/${id}`);
    expect(detalleDueno.body.inmueble.es_mio).toBe(true);

    const editado = await dueno
      .patch(`${BASE}/${id}`)
      .send({ nombre_inmueble: 'Mi apartamento', estrato: null });
    expect(editado.status).toBe(200);
    expect(editado.body.inmueble).toMatchObject({
      nombre: 'Mi apartamento',
      estrato: null,
      contacto: { nombre: 'Inmobiliaria Uno' },
    });

    // Otro usuario no puede editar ni borrar.
    const otro = agenteDe(app);
    await registrar(otro, {
      nombre: 'Otro',
      email: 'otro@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));

    const patchAjeno = await otro.patch(`${BASE}/${id}`).send({ nombre_inmueble: 'Robado' });
    expect(patchAjeno.status).toBe(403);
    expect(patchAjeno.body.error).toMatchObject({ code: 'PROHIBIDO' });

    const deleteAjeno = await otro.delete(`${BASE}/${id}`);
    expect(deleteAjeno.status).toBe(403);

    // El dueno borra: 204 y luego 404.
    expect((await dueno.delete(`${BASE}/${id}`)).status).toBe(204);
    expect((await agenteDe(app).get(`${BASE}/${id}`)).status).toBe(404);
  });

  it('sin cookie: GET lista y detalle 200; POST/PATCH/DELETE 401', async () => {
    const anonimo = agenteDe(app);
    expect((await anonimo.get(BASE)).status).toBe(200);

    const crear = await anonimo.post(BASE).send(DATOS_INMUEBLE);
    expect(crear.status).toBe(401);
    expect(crear.body.error).toMatchObject({ code: 'NO_AUTENTICADO' });

    const patch = await anonimo.patch(`${BASE}/1`).send({ nombre_inmueble: 'X' });
    expect(patch.status).toBe(401);
    expect((await anonimo.delete(`${BASE}/1`)).status).toBe(401);
  });

  it('mias=true exige sesion y filtra por dueno', async () => {
    const dueno = agenteDe(app);
    await registrar(dueno, {
      nombre: 'Dueno',
      email: 'dueno@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));
    await dueno.post(BASE).send(DATOS_INMUEBLE).then((r) => expect(r.status).toBe(201));

    const sinSesion = await agenteDe(app).get(BASE).query({ mias: 'true' });
    expect(sinSesion.status).toBe(401);
    expect(sinSesion.body.error).toMatchObject({ code: 'NO_AUTENTICADO' });

    const conSesion = await dueno.get(BASE).query({ mias: 'true' });
    expect(conSesion.status).toBe(200);
    expect(conSesion.body.meta.total).toBe(1);
    expect(conSesion.body.data[0].es_mio).toBe(true);
  });

  it('filtros, paginacion y orden estable', async () => {
    const dueno = agenteDe(app);
    await registrar(dueno, {
      nombre: 'Dueno',
      email: 'dueno@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));

    for (let i = 1; i <= 5; i += 1) {
      const respuesta = await dueno.post(BASE).send({
        ...DATOS_INMUEBLE,
        codigo_sae: `WEB-${i}`,
        valor_arriendo: String(i * 100_000),
      });
      expect(respuesta.status).toBe(201);
    }

    const porValor = await agenteDe(app)
      .get(BASE)
      .query({ valor_min: '200000', valor_max: '400000' });
    expect(porValor.status).toBe(200);
    expect(porValor.body.meta.total).toBe(3);

    const pagina = await agenteDe(app)
      .get(BASE)
      .query({ sort: 'valor_arriendo', order: 'asc', page: '2', limit: '2' });
    expect(pagina.status).toBe(200);
    expect(pagina.body.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(pagina.body.data.map((fila: { valor_arriendo: number }) => fila.valor_arriendo)).toEqual([
      300_000, 400_000,
    ]);

    // Misma consulta dos veces: mismo orden (desempate por id).
    const idsDe = (cuerpo: { data: Array<{ id: number }> }) => cuerpo.data.map((fila) => fila.id);
    const primera = await agenteDe(app).get(BASE).query({ limit: '5' });
    const segunda = await agenteDe(app).get(BASE).query({ limit: '5' });
    expect(idsDe(primera.body)).toEqual(idsDe(segunda.body));

    // Filtros por id de catalogo.
    const porCatalogo = await agenteDe(app)
      .get(BASE)
      .query({ departamento: '1', ciudad: '1', tipo: '1' });
    expect(porCatalogo.body.meta.total).toBe(5);

    const otroDepartamento = await agenteDe(app).get(BASE).query({ departamento: '2' });
    expect(otroDepartamento.body.meta.total).toBe(0);
  });

  it('valida el cuerpo, el id y la query (400) y responde 404 si no existe', async () => {
    const dueno = agenteDe(app);
    await registrar(dueno, {
      nombre: 'Dueno',
      email: 'dueno@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));

    const incompleto = await dueno.post(BASE).send({ codigo_sae: 'X' });
    expect(incompleto.status).toBe(400);
    expect(incompleto.body.error).toMatchObject({ code: 'VALIDACION_FALLIDA' });
    expect(incompleto.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: 'tipo_inmueble' }),
        expect.objectContaining({ campo: 'departamento' }),
        expect.objectContaining({ campo: 'direccion' }),
      ]),
    );

    const extra = await dueno.post(BASE).send({ ...DATOS_INMUEBLE, id_usuario: 99 });
    expect(extra.status).toBe(400);

    const idInvalido = await agenteDe(app).get(`${BASE}/abc`);
    expect(idInvalido.status).toBe(400);

    const queryInvalida = await agenteDe(app).get(BASE).query({ limit: '101' });
    expect(queryInvalida.status).toBe(400);

    const inexistente = await agenteDe(app).get(`${BASE}/999`);
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error).toMatchObject({ code: 'INMUEBLE_NO_ENCONTRADO' });
  });

  it('rechaza un tipo, departamento o ciudad inexistente (400)', async () => {
    const dueno = agenteDe(app);
    await registrar(dueno, {
      nombre: 'Dueno',
      email: 'dueno@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));

    const tipo = await dueno.post(BASE).send({ ...DATOS_INMUEBLE, tipo_inmueble: 'Castillo' });
    expect(tipo.status).toBe(400);
    expect(tipo.body.error).toMatchObject({ code: 'TIPO_INVALIDO' });

    const departamento = await dueno
      .post(BASE)
      .send({ ...DATOS_INMUEBLE, departamento: 'Marte' });
    expect(departamento.status).toBe(400);
    expect(departamento.body.error).toMatchObject({ code: 'DEPARTAMENTO_INVALIDO' });

    const ciudad = await dueno
      .post(BASE)
      .send({ ...DATOS_INMUEBLE, ciudad: 'Medellín' });
    expect(ciudad.status).toBe(400);
    expect(ciudad.body.error).toMatchObject({ code: 'CIUDAD_INVALIDA' });
  });

  it('un admin puede editar y borrar inmuebles importados sin dueno', async () => {
    // El inmueble importado se crea directo por SQL (id_usuario NULL).
    await pool.query(
      `INSERT INTO inmueble (codigo_sae, nombre_inmueble, id_tipo, id_departamento, direccion)
       VALUES ('CSV-1', 'Casa - CSV-1', 2, 1, 'CL 1')`,
    );
    const fila = await pool.query<{ id_inmueble: number }>(
      `SELECT id_inmueble FROM inmueble WHERE codigo_sae = 'CSV-1'`,
    );
    const id = fila.rows[0]?.id_inmueble;
    expect(id).toBeDefined();

    const admin = await import('./apoyo.js').then(({ registrarAdmin }) =>
      registrarAdmin(app, {
        nombre: 'Admin',
        email: 'admin@ejemplo.com',
        password: PASSWORD,
      }),
    );

    const editado = await admin
      .patch(`${BASE}/${id}`)
      .send({ estado_inmueble: 'Arrendado' });
    expect(editado.status).toBe(200);
    expect(editado.body.inmueble).toMatchObject({
      estado: 'Arrendado',
      publicado_por_usuario: false,
      es_mio: false,
    });

    expect((await admin.delete(`${BASE}/${id}`)).status).toBe(204);
  });
});
