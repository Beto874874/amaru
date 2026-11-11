import { MulterError } from 'multer';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from '../../src/shared/zod.js';
import { authenticate } from '../../src/middlewares/authenticate.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { notFound } from '../../src/middlewares/notFound.js';
import { optionalAuth } from '../../src/middlewares/optionalAuth.js';
import { originCheck } from '../../src/middlewares/originCheck.js';
import { requireRole } from '../../src/middlewares/requireRole.js';
import { validate, validado } from '../../src/middlewares/validate.js';
import { firmarAccessToken } from '../../src/modules/auth/tokens.js';
import { BadRequestError } from '../../src/shared/errors.js';

// ---------------------------------------------------------------------------
// Dobles de req/res: los middlewares solo usan unas pocas propiedades.
// ---------------------------------------------------------------------------

function respuestaFalsa() {
  return {
    statusCode: 0,
    cuerpo: undefined as unknown,
    status(codigo: number) {
      this.statusCode = codigo;
      return this;
    },
    json(datos: unknown) {
      this.cuerpo = datos;
      return this;
    },
  };
}

function peticion(extra: Record<string, unknown> = {}): Request {
  return { cookies: {}, ...extra } as unknown as Request;
}

describe('authenticate', () => {
  it('sin cookie responde NO_AUTENTICADO', () => {
    const next = vi.fn();
    authenticate(peticion(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NO_AUTENTICADO', statusCode: 401 }),
    );
  });

  it('con token valido deja req.user y continua', () => {
    const next = vi.fn();
    const req = peticion({
      cookies: { access_token: firmarAccessToken({ id: 5, rol: 'admin' }) },
    });

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 5, rol: 'admin' });
  });

  it('con token invalido propaga el error', () => {
    const next = vi.fn();
    const req = peticion({ cookies: { access_token: 'no-es-un-jwt' } });

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_INVALIDO' }));
    expect(req.user).toBeUndefined();
  });
});

describe('optionalAuth', () => {
  it('sin cookie sigue como visitante', () => {
    const next = vi.fn();
    const req = peticion();
    optionalAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('con token valido identifica al usuario', () => {
    const next = vi.fn();
    const req = peticion({
      cookies: { access_token: firmarAccessToken({ id: 7, rol: 'usuario' }) },
    });
    optionalAuth(req, {} as Response, next);
    expect(req.user).toEqual({ id: 7, rol: 'usuario' });
  });

  it('con token invalido ignora la sesion y continua', () => {
    const next = vi.fn();
    const req = peticion({ cookies: { access_token: 'basura' } });
    optionalAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });
});

describe('requireRole', () => {
  it('sin usuario responde 401', () => {
    const next = vi.fn();
    requireRole('admin')(peticion(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NO_AUTENTICADO', statusCode: 401 }),
    );
  });

  it('con rol insuficiente responde 403', () => {
    const next = vi.fn();
    const req = peticion();
    req.user = { id: 1, rol: 'usuario' };
    requireRole('admin')(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PROHIBIDO', statusCode: 403 }),
    );
  });

  it('con el rol correcto continua', () => {
    const next = vi.fn();
    const req = peticion();
    req.user = { id: 1, rol: 'admin' };
    requireRole('admin')(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('originCheck', () => {
  it('deja pasar metodos seguros aunque el origen sea desconocido', () => {
    const next = vi.fn();
    const req = peticion({ method: 'GET', get: () => 'http://evil.example' });
    originCheck(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('deja pasar peticiones sin Origin (curl, servidor a servidor)', () => {
    const next = vi.fn();
    const req = peticion({ method: 'POST', get: () => undefined });
    originCheck(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('acepta un origen de CORS y el propio API (con barra final)', () => {
    for (const origen of ['http://localhost:5173', 'http://localhost:3000/']) {
      const next = vi.fn();
      const req = peticion({ method: 'POST', get: () => origen });
      originCheck(req, {} as Response, next);
      expect(next).toHaveBeenCalledWith();
    }
  });

  it('rechaza un origen no permitido con 403', () => {
    const next = vi.fn();
    const req = peticion({ method: 'PATCH', get: () => 'http://evil.example' });
    originCheck(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ORIGEN_NO_PERMITIDO', statusCode: 403 }),
    );
  });
});

describe('validate y validado', () => {
  it('guarda body, query y params limpios y continua', () => {
    const next = vi.fn();
    const req = peticion({
      body: { nombre: '  Ana  ' },
      query: { page: '2' },
      params: { id: '3' },
    });

    validate({
      body: z.strictObject({ nombre: z.string().trim() }),
      query: z.strictObject({ page: z.coerce.number().int() }),
      params: z.strictObject({ id: z.coerce.number().int() }),
    })(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.validated).toEqual({
      body: { nombre: 'Ana' },
      query: { page: 2 },
      params: { id: 3 },
    });
  });

  it('acumula los detalles de todas las partes invalidas', () => {
    const next = vi.fn();
    const req = peticion({ body: { nombre: 1 }, query: { page: '0' } });

    validate({
      body: z.strictObject({ nombre: z.string() }),
      query: z.strictObject({ page: z.coerce.number().int().min(1) }),
    })(req, {} as Response, next);

    const error = next.mock.calls[0]?.[0] as BadRequestError;
    expect(error).toMatchObject({ code: 'VALIDACION_FALLIDA', statusCode: 400 });
    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: 'nombre' }),
        expect.objectContaining({ campo: 'page' }),
      ]),
    );
  });

  it('validado explota si la ruta olvido validate()', () => {
    expect(() => validado(peticion(), 'body')).toThrow('falta validate()');
  });
});

describe('errorHandler', () => {
  const req = { id: 'req-test' } as unknown as Request;

  it('traduce un ZodError a 400 VALIDACION_FALLIDA', () => {
    const parseo = z.strictObject({ nombre: z.string() }).safeParse({});
    expect(parseo.success).toBe(false);
    if (parseo.success) return;

    const res = respuestaFalsa();
    errorHandler(parseo.error, req, res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(res.cuerpo).toMatchObject({
      error: {
        code: 'VALIDACION_FALLIDA',
        details: [expect.objectContaining({ campo: 'nombre' })],
      },
    });
  });

  it('devuelve un AppError con sus detalles', () => {
    const res = respuestaFalsa();
    errorHandler(
      new BadRequestError('X', 'mal', [{ campo: 'a', mensaje: 'b' }]),
      req,
      res as unknown as Response,
      vi.fn(),
    );
    expect(res.statusCode).toBe(400);
    expect(res.cuerpo).toEqual({ error: { code: 'X', message: 'mal', details: [{ campo: 'a', mensaje: 'b' }] } });
  });

  it('traduce errores de Postgres', () => {
    const res = respuestaFalsa();
    const error = Object.assign(new Error('pg'), { code: '23505', constraint: 'usuario_email_key' });
    errorHandler(error, req, res as unknown as Response, vi.fn());
    expect(res.statusCode).toBe(409);
    expect(res.cuerpo).toMatchObject({ error: { code: 'EMAIL_EN_USO' } });
  });

  it('detecta JSON mal formado de body-parser', () => {
    const res = respuestaFalsa();
    const error = Object.assign(new SyntaxError('json'), { status: 400, body: '{}' });
    errorHandler(error, req, res as unknown as Response, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.cuerpo).toMatchObject({ error: { code: 'JSON_INVALIDO' } });
  });

  it('traduce entity.too.large a 413', () => {
    const res = respuestaFalsa();
    errorHandler({ type: 'entity.too.large' }, req, res as unknown as Response, vi.fn());
    expect(res.statusCode).toBe(413);
    expect(res.cuerpo).toMatchObject({ error: { code: 'PAYLOAD_DEMASIADO_GRANDE' } });
  });

  it('traduce MulterError de tamano y de archivo invalido', () => {
    const grande = respuestaFalsa();
    errorHandler(
      new MulterError('LIMIT_FILE_SIZE'),
      req,
      grande as unknown as Response,
      vi.fn(),
    );
    expect(grande.statusCode).toBe(413);

    const invalido = respuestaFalsa();
    errorHandler(
      new MulterError('LIMIT_FILE_COUNT'),
      req,
      invalido as unknown as Response,
      vi.fn(),
    );
    expect(invalido.statusCode).toBe(400);
    expect(invalido.cuerpo).toMatchObject({ error: { code: 'ARCHIVO_INVALIDO' } });
  });

  it('responde 500 generico sin filtrar el detalle', () => {
    const res = respuestaFalsa();
    errorHandler(new Error('secreto interno'), req, res as unknown as Response, vi.fn());
    expect(res.statusCode).toBe(500);
    expect(res.cuerpo).toEqual({
      error: { code: 'ERROR_INTERNO', message: 'Ocurrio un error inesperado en el servidor' },
    });
    expect(JSON.stringify(res.cuerpo)).not.toContain('secreto');
  });
});

describe('notFound', () => {
  it('responde 404 en el formato unico de error', () => {
    const res = respuestaFalsa();
    notFound(
      { method: 'GET', originalUrl: '/api/v1/nada' } as unknown as Request,
      res as unknown as Response,
      vi.fn(),
    );
    expect(res.statusCode).toBe(404);
    expect(res.cuerpo).toMatchObject({ error: { code: 'RUTA_NO_ENCONTRADA' } });
  });
});
