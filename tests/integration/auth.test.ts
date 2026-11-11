import type { Express } from 'express';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { HAY_BASE_DE_PRUEBAS } from '../setup.js';
import {
  agenteDe,
  cabecerasDeCookies,
  cookie,
  limpiarYSeed,
  PASSWORD,
  registrar,
  valorDeCookie,
} from './apoyo.js';

const BASE = '/api/v1/auth';

describe.skipIf(!HAY_BASE_DE_PRUEBAS)('integracion: auth y cookies', () => {
  let app: Express;

  beforeEach(async () => {
    await limpiarYSeed();
    app = crearApp();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('registra, deja cookies httpOnly y devuelve solo el DTO publico', async () => {
    const agente = agenteDe(app);
    const respuesta = await agente.post(`${BASE}/register`).send({
      nombre: '  Ana Perez  ',
      email: '  ANA@EJEMPLO.COM ',
      password: PASSWORD,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.usuario).toEqual({
      id: expect.any(Number),
      nombre: 'Ana Perez',
      email: 'ana@ejemplo.com',
      rol: 'usuario',
    });
    expect(JSON.stringify(respuesta.body)).not.toContain('password');

    const access = cookie(respuesta, 'access_token');
    const refresh = cookie(respuesta, 'refresh_token');
    expect(access).toBeDefined();
    expect(refresh).toBeDefined();

    // Cookies de sesion: no legibles por JS y con SameSite explicito.
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Lax/i);
    expect(access).toMatch(/Path=\//);
    // El refresh solo viaja a las rutas de auth.
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    // En pruebas (sin HTTPS) no se marca Secure; en produccion si.
    expect(access).not.toMatch(/Secure/i);

    // Los tokens nunca aparecen en el cuerpo.
    expect(JSON.stringify(respuesta.body)).not.toContain(valorDeCookie(respuesta, 'access_token'));

    const perfil = await agente.get(`${BASE}/me`);
    expect(perfil.status).toBe(200);
    expect(perfil.body.usuario.email).toBe('ana@ejemplo.com');
    expect(perfil.body.usuario).not.toHaveProperty('password_hash');
  });

  it('no permite registrar dos veces el mismo email (409)', async () => {
    const datos = { nombre: 'Ana', email: 'ana@ejemplo.com', password: PASSWORD };
    await registrar(agenteDe(app), datos).then((r) => expect(r.status).toBe(201));

    const repetido = await registrar(agenteDe(app), datos);
    expect(repetido.status).toBe(409);
    expect(repetido.body.error).toMatchObject({ code: 'EMAIL_EN_USO' });
  });

  it('login con contrasena incorrecta responde 401 generico', async () => {
    await registrar(agenteDe(app), {
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));

    const respuesta = await agenteDe(app)
      .post(`${BASE}/login`)
      .send({ email: 'ana@ejemplo.com', password: 'OtraPassword123' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error).toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
    expect(cabecerasDeCookies(respuesta)).toHaveLength(0);
  });

  it('refresh rota el token y logout limpia ambas cookies', async () => {
    const agente = agenteDe(app);
    const registro = await registrar(agente, {
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      password: PASSWORD,
    });
    const refreshOriginal = valorDeCookie(registro, 'refresh_token');

    const refresco = await agente.post(`${BASE}/refresh`);
    expect(refresco.status).toBe(200);
    expect(refresco.body.usuario.email).toBe('ana@ejemplo.com');
    const refreshNuevo = valorDeCookie(refresco, 'refresh_token');
    expect(refreshNuevo).toBeDefined();
    expect(refreshNuevo).not.toBe(refreshOriginal);

    const salida = await agente.post(`${BASE}/logout`);
    expect(salida.status).toBe(204);
    for (const nombre of ['access_token', 'refresh_token']) {
      const linea = cookie(salida, nombre);
      expect(linea).toBeDefined();
      // clearCookie usa Expires en el pasado (o Max-Age=0) y el mismo Path.
      expect(linea).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
    }

    const despues = await agente.get(`${BASE}/me`);
    expect(despues.status).toBe(401);
    expect(despues.body.error).toMatchObject({ code: 'NO_AUTENTICADO' });
  });

  it('refresh sin cookie y con cookie invalida responde 401 y limpia cookies', async () => {
    const sinCookie = await agenteDe(app).post(`${BASE}/refresh`);
    expect(sinCookie.status).toBe(401);
    expect(sinCookie.body.error).toMatchObject({ code: 'NO_AUTENTICADO' });

    const invalida = await agenteDe(app)
      .post(`${BASE}/refresh`)
      .set('Cookie', 'refresh_token=no-es-un-jwt');
    expect(invalida.status).toBe(401);
    expect(invalida.body.error).toMatchObject({ code: 'TOKEN_INVALIDO' });
    expect(cookie(invalida, 'refresh_token')).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  });

  it('logout es idempotente aunque no haya sesion', async () => {
    const respuesta = await agenteDe(app).post(`${BASE}/logout`);
    expect(respuesta.status).toBe(204);
    expect(cookie(respuesta, 'access_token')).toMatch(
      /Expires=Thu, 01 Jan 1970|Max-Age=0/i,
    );
  });

  it('logout-all revoca todas las sesiones del usuario', async () => {
    const agente = agenteDe(app);
    await registrar(agente, {
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));

    expect((await agente.post(`${BASE}/logout-all`)).status).toBe(204);

    const despues = await agente.get(`${BASE}/me`);
    expect(despues.status).toBe(401);
  });

  it('PATCH /me actualiza el nombre y nunca expone datos privados', async () => {
    const agente = agenteDe(app);
    await registrar(agente, {
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));

    const respuesta = await agente.patch(`${BASE}/me`).send({ nombre: 'Ana Maria' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario).toMatchObject({ nombre: 'Ana Maria' });
    expect(JSON.stringify(respuesta.body)).not.toContain('password_hash');
  });

  it('protege las rutas autenticadas sin cookie (401)', async () => {
    for (const peticion of [
      agenteDe(app).get(`${BASE}/me`),
      agenteDe(app).patch(`${BASE}/me`).send({ nombre: 'X' }),
      agenteDe(app).post(`${BASE}/logout-all`),
    ]) {
      const respuesta = await peticion;
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error).toMatchObject({ code: 'NO_AUTENTICADO' });
    }
  });
});
