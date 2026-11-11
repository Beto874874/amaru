import type { Express } from 'express';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { HAY_BASE_DE_PRUEBAS } from '../setup.js';
import { agenteDe, limpiarYSeed, PASSWORD, registrar, registrarAdmin } from './apoyo.js';

const BASE = '/api/v1/importacion/inmuebles';

const CABECERA = [
  'codigo_sae',
  'tipo_inmueble',
  'departamento',
  'ciudad',
  'direccion',
  'estrato',
  'valor_arriendo',
  'nombre_contacto',
  'correo_contacto',
];

const FILAS = [
  ['IMP-1', 'Apartamento', 'Bogotá D.C.', 'Bogotá D.C.', 'CL 1', '3', '1000000', 'Inmo', 'inmo@ejemplo.com'],
  ['IMP-2', 'Casa', 'Antioquia', 'Medellín', 'CL 2', '', '', '', ''],
];

function csv(filas: string[][], cabecera: string[] = CABECERA): string {
  const lineas = [cabecera.join(',')];
  for (const fila of filas) lineas.push(fila.map((valor) => valor.replaceAll('"', '""')).join(','));
  return `${lineas.join('\n')}\n`;
}

function subir(agente: ReturnType<typeof agenteDe>, contenido: string, nombre = 'inmuebles.csv') {
  return agente
    .post(BASE)
    .attach('archivo', Buffer.from(contenido, 'utf8'), {
      filename: nombre,
      contentType: 'text/csv',
    });
}

async function contarInmuebles(): Promise<number> {
  const resultado = await pool.query<{ total: string }>('SELECT count(*) AS total FROM inmueble');
  return Number(resultado.rows[0]?.total ?? 0);
}

describe.skipIf(!HAY_BASE_DE_PRUEBAS)('integracion: importacion CSV', () => {
  let app: Express;

  beforeEach(async () => {
    await limpiarYSeed();
    app = crearApp();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('un admin importa un archivo valido (201) y las filas quedan visibles', async () => {
    const admin = await registrarAdmin(app, {
      nombre: 'Admin',
      email: 'admin@ejemplo.com',
      password: PASSWORD,
    });

    const respuesta = await subir(admin, csv(FILAS));
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ insertados: 2, omitidos: 0 });
    expect(await contarInmuebles()).toBe(2);

    const lista = await agenteDe(app).get('/api/v1/inmuebles');
    expect(lista.status).toBe(200);
    expect(lista.body.meta.total).toBe(2);
    const codigos = (lista.body.data as Array<{ codigo_sae: string }>).map(
      (fila) => fila.codigo_sae,
    );
    expect(codigos.sort()).toEqual(['IMP-1', 'IMP-2']);
    // Importados por este endpoint: quedan a nombre del admin que importo
    // (guia 11.4). El id del dueno nunca se expone.
    expect(
      (lista.body.data as Array<{ publicado_por_usuario: boolean }>).every(
        (fila) => fila.publicado_por_usuario === true,
      ),
    ).toBe(true);
    expect(JSON.stringify(lista.body)).not.toContain('id_usuario');
  });

  it('una fila invalida devuelve 422 y NO inserta nada (todo o nada)', async () => {
    const admin = await registrarAdmin(app, {
      nombre: 'Admin',
      email: 'admin@ejemplo.com',
      password: PASSWORD,
    });

    const filasMalas = [...FILAS, ['IMP-3', 'Castillo', 'Bogotá D.C.', '', 'CL 3', '', '', '', '']];
    const respuesta = await subir(admin, csv(filasMalas));

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error).toMatchObject({ code: 'IMPORTACION_INVALIDA' });
    expect(respuesta.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fila: 4, campo: 'tipo_inmueble' }),
      ]),
    );
    expect(await contarInmuebles()).toBe(0);
  });

  it('un usuario normal no puede importar (403) y un anonimo recibe 401', async () => {
    const usuario = agenteDe(app);
    await registrar(usuario, {
      nombre: 'Usuario',
      email: 'usuario@ejemplo.com',
      password: PASSWORD,
    }).then((r) => expect(r.status).toBe(201));

    const prohibido = await subir(usuario, csv(FILAS));
    expect(prohibido.status).toBe(403);
    expect(prohibido.body.error).toMatchObject({ code: 'PROHIBIDO' });

    const anonimo = await subir(agenteDe(app), csv(FILAS));
    expect(anonimo.status).toBe(401);
    expect(anonimo.body.error).toMatchObject({ code: 'NO_AUTENTICADO' });
  });

  it('exige el archivo y rechaza un tipo que no es CSV', async () => {
    const admin = await registrarAdmin(app, {
      nombre: 'Admin',
      email: 'admin@ejemplo.com',
      password: PASSWORD,
    });

    const sinArchivo = await admin.post(BASE).field('otro', 'valor');
    expect(sinArchivo.status).toBe(400);
    expect(sinArchivo.body.error).toMatchObject({ code: 'ARCHIVO_REQUERIDO' });

    const tipoMalo = await admin
      .post(BASE)
      .attach('archivo', Buffer.from('no soy csv'), {
        filename: 'datos.txt',
        contentType: 'text/plain',
      });
    expect(tipoMalo.status).toBe(400);
    expect(tipoMalo.body.error).toMatchObject({ code: 'ARCHIVO_INVALIDO' });
  });

  it('rechaza un archivo de mas de 5 MB (413)', async () => {
    const admin = await registrarAdmin(app, {
      nombre: 'Admin',
      email: 'admin@ejemplo.com',
      password: PASSWORD,
    });

    const enorme = Buffer.alloc(5 * 1024 * 1024 + 1024, 'a');
    const respuesta = await admin
      .post(BASE)
      .attach('archivo', enorme, { filename: 'enorme.csv', contentType: 'text/csv' });

    expect(respuesta.status).toBe(413);
    expect(respuesta.body.error).toMatchObject({ code: 'PAYLOAD_DEMASIADO_GRANDE' });
  });
});
