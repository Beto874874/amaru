import { describe, expect, it } from 'vitest';
import {
  BadRequestError,
  ConflictError,
} from '../../src/shared/errors.js';
import { traducirErrorPg } from '../../src/shared/pgErrors.js';

function errorPg(campos: Record<string, unknown>): Error {
  return Object.assign(new Error('error de postgres'), campos);
}

describe('traducirErrorPg', () => {
  it('devuelve null para errores que no vienen de Postgres', () => {
    expect(traducirErrorPg(new Error('boom'))).toBeNull();
    expect(traducirErrorPg(null)).toBeNull();
    expect(traducirErrorPg('texto')).toBeNull();
    expect(traducirErrorPg({ code: 'NO_ES_PG' })).toBeNull();
  });

  it('traduce 23505 de unicidad con un constraint conocido', () => {
    const resultado = traducirErrorPg(
      errorPg({ code: '23505', constraint: 'inmueble_codigo_sae_key' }),
    );
    expect(resultado).toBeInstanceOf(ConflictError);
    expect(resultado).toMatchObject({
      statusCode: 409,
      code: 'CODIGO_SAE_DUPLICADO',
      message: 'Ya existe un inmueble con ese codigo SAE',
    });
  });

  it('traduce 23505 de email y de contacto compartido', () => {
    expect(
      traducirErrorPg(errorPg({ code: '23505', constraint: 'usuario_email_key' })),
    ).toMatchObject({ statusCode: 409, code: 'EMAIL_EN_USO' });

    expect(
      traducirErrorPg(errorPg({ code: '23505', constraint: 'contacto_unico' })),
    ).toMatchObject({ statusCode: 409, code: 'CONTACTO_DUPLICADO' });
  });

  it('usa un mensaje generico para un 23505 con constraint desconocido o ausente', () => {
    for (const error of [
      errorPg({ code: '23505', constraint: 'otra_tabla_key' }),
      errorPg({ code: '23505' }),
    ]) {
      expect(traducirErrorPg(error)).toMatchObject({
        statusCode: 409,
        code: 'REGISTRO_DUPLICADO',
        message: 'Ya existe un registro con esos datos',
      });
    }
  });

  it('traduce 23503 (FK) a 409 REFERENCIA_INVALIDA', () => {
    expect(traducirErrorPg(errorPg({ code: '23503' }))).toMatchObject({
      statusCode: 409,
      code: 'REFERENCIA_INVALIDA',
    });
  });

  it('traduce 23514 con constraint conocido y desconocido', () => {
    expect(
      traducirErrorPg(errorPg({ code: '23514', constraint: 'inmueble_estrato_check' })),
    ).toMatchObject({
      statusCode: 400,
      code: 'DATO_INVALIDO',
      message: 'El estrato debe estar entre 1 y 6',
    });

    expect(
      traducirErrorPg(errorPg({ code: '23514', constraint: 'check_desconocido' })),
    ).toMatchObject({
      statusCode: 400,
      code: 'DATO_INVALIDO',
      message: 'Algun dato no cumple las reglas de la base',
    });
  });

  it('traduce 23502 (NOT NULL) e incluye el detalle de la columna', () => {
    const resultado = traducirErrorPg(errorPg({ code: '23502', column: 'direccion' }));
    expect(resultado).toBeInstanceOf(BadRequestError);
    expect(resultado).toMatchObject({
      statusCode: 400,
      code: 'DATO_INVALIDO',
      message: 'Falta un dato obligatorio (direccion)',
      details: [{ campo: 'direccion', mensaje: 'Este campo es obligatorio' }],
    });

    expect(traducirErrorPg(errorPg({ code: '23502' }))).toMatchObject({
      statusCode: 400,
      message: 'Falta un dato obligatorio',
    });
  });

  it('traduce 22P02 (formato invalido)', () => {
    expect(traducirErrorPg(errorPg({ code: '22P02' }))).toMatchObject({
      statusCode: 400,
      code: 'DATO_INVALIDO',
      message: 'Algun dato tiene un formato invalido',
    });
  });

  it('encuentra el codigo en la cadena de causas (Drizzle lo envuelve)', () => {
    const envuelto = new Error('DrizzleQueryError', {
      cause: errorPg({ code: '23505', constraint: 'usuario_email_key' }),
    });
    expect(traducirErrorPg(envuelto)).toMatchObject({ code: 'EMAIL_EN_USO' });
  });

  it('no entra en bucles si una causa se referencia a si misma', () => {
    const ciclico = errorPg({ code: 'NO_PG' });
    (ciclico as { cause?: unknown }).cause = ciclico;
    expect(traducirErrorPg(ciclico)).toBeNull();
  });

  it('ignora un codigo que no tiene forma de SQLSTATE', () => {
    expect(traducirErrorPg(errorPg({ code: '23505 ' }))).toBeNull();
  });
});
