import { sql } from 'drizzle-orm';
import type { Express } from 'express';
import request, { type Response } from 'supertest';
import { db } from '../../src/config/db.js';

// Utilidades compartidas por las pruebas de integracion.
// Solo se importan desde archivos *.test.ts que ya verificaron
// HAY_BASE_DE_PRUEBAS (tests/setup.ts aborta si la base no es desechable).

export type Agente = ReturnType<typeof request.agent>;

export interface DatosRegistro {
  nombre: string;
  email: string;
  password: string;
}

export const PASSWORD = 'Password12345';

/**
 * Deja la base en un estado conocido: borra datos y catalogos y siembra los
 * minimos que usan las pruebas. RESTART IDENTITY hace predecibles los ids.
 */
export async function limpiarYSeed(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE inmueble, contacto, usuario, sesion, ciudad, departamento, tipo_inmueble
    RESTART IDENTITY CASCADE
  `);
  await db.execute(sql`
    INSERT INTO departamento (nombre) VALUES ('Bogotá D.C.'), ('Antioquia')
  `);
  await db.execute(sql`
    INSERT INTO ciudad (id_departamento, nombre)
    VALUES (1, 'Bogotá D.C.'), (2, 'Medellín')
  `);
  await db.execute(sql`
    INSERT INTO tipo_inmueble (nombre) VALUES ('Apartamento'), ('Casa'), ('Garaje')
  `);
}

export function agenteDe(app: Express): Agente {
  return request.agent(app);
}

/** Registra un usuario y devuelve el agente con sus cookies de sesion. */
export async function registrar(agente: Agente, datos: DatosRegistro): Promise<Response> {
  const respuesta = await agente.post('/api/v1/auth/register').send(datos);
  return respuesta;
}

export async function promoverAdmin(email: string): Promise<void> {
  await db.execute(sql`UPDATE usuario SET rol = 'admin' WHERE email = ${email}`);
}

/**
 * Crea un admin: se registra, se promueve por SQL (no hay endpoint para eso) y
 * vuelve a iniciar sesion para que el access token lleve el rol nuevo.
 */
export async function registrarAdmin(app: Express, datos: DatosRegistro): Promise<Agente> {
  const agente = request.agent(app);
  await registrar(agente, datos).then((respuesta) => {
    if (respuesta.status !== 201) {
      throw new Error(`No se pudo registrar el admin: ${respuesta.status}`);
    }
  });
  await promoverAdmin(datos.email);
  const login = await agente
    .post('/api/v1/auth/login')
    .send({ email: datos.email, password: datos.password });
  if (login.status !== 200) {
    throw new Error(`No se pudo iniciar sesion como admin: ${login.status}`);
  }
  return agente;
}

/** Todas las cabeceras Set-Cookie de una respuesta. */
export function cabecerasDeCookies(respuesta: Response): string[] {
  const valor = respuesta.headers['set-cookie'] as unknown;
  if (Array.isArray(valor)) return valor as string[];
  return typeof valor === 'string' ? [valor] : [];
}

/** La cabecera Set-Cookie completa de una cookie concreta. */
export function cookie(respuesta: Response, nombre: string): string | undefined {
  return cabecerasDeCookies(respuesta).find((linea) => linea.startsWith(`${nombre}=`));
}

/** Valor de una cookie concreta (sin atributos). */
export function valorDeCookie(respuesta: Response, nombre: string): string | undefined {
  const linea = cookie(respuesta, nombre);
  if (!linea) return undefined;
  return linea.slice(nombre.length + 1).split(';')[0];
}
