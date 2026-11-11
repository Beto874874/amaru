import { describe, expect, it } from 'vitest';
import {
  actualizarInmuebleSchema,
  crearInmuebleSchema,
  listarInmueblesSchema,
} from '../../src/modules/inmuebles/schemas.js';
import { filaImportacionSchema } from '../../src/modules/importacion/schemas.js';
import {
  emailSchema,
  loginSchema,
  passwordSchema,
  registroSchema,
} from '../../src/modules/auth/schemas.js';
import { crearContactoSchema } from '../../src/modules/contactos/schemas.js';
import {
  booleanoOpcional,
  correoOpcionalNullable,
  enteroOpcional,
  enteroOpcionalNullable,
  numeroOpcional,
  numeroOpcionalNullable,
  textoOpcional,
  textoOpcionalNullable,
  urlOpcionalNullable,
} from '../../src/shared/validacion.js';

describe('helpers de validacion', () => {
  it('textoOpcional recorta y convierte "" en undefined', () => {
    expect(textoOpcional(10).parse('  hola  ')).toBe('hola');
    expect(textoOpcional(10).parse('   ')).toBeUndefined();
    expect(textoOpcional(10).parse(undefined)).toBeUndefined();
    expect(textoOpcional(10).safeParse('12345678901').success).toBe(false);
  });

  it('textoOpcionalNullable ademas acepta null para vaciar en un PATCH', () => {
    expect(textoOpcionalNullable(10).parse(null)).toBeNull();
    expect(textoOpcionalNullable(10).parse('  ')).toBeUndefined();
    expect(textoOpcionalNullable(10).parse(' x ')).toBe('x');
  });

  it('enteroOpcional trata "" y null como ausentes y coacciona strings', () => {
    const schema = enteroOpcional(1, 10);
    expect(schema.parse('3')).toBe(3);
    expect(schema.parse('')).toBeUndefined();
    expect(schema.parse(null)).toBeUndefined();
    expect(schema.safeParse('0').success).toBe(false);
    expect(schema.safeParse('11').success).toBe(false);
    expect(schema.safeParse('1.5').success).toBe(false);
  });

  it('numeroOpcional admite decimales', () => {
    expect(numeroOpcional(0).parse('12.5')).toBe(12.5);
    expect(numeroOpcional(0).parse('')).toBeUndefined();
    expect(numeroOpcional(0).safeParse('-1').success).toBe(false);
  });

  it('las variantes Nullable conservan null', () => {
    expect(enteroOpcionalNullable(1, 6).parse(null)).toBeNull();
    expect(enteroOpcionalNullable(1, 6).parse('')).toBeUndefined();
    expect(enteroOpcionalNullable(1, 6).parse('4')).toBe(4);
    expect(numeroOpcionalNullable(0).parse(null)).toBeNull();
    expect(numeroOpcionalNullable(0).parse('0.5')).toBe(0.5);
  });

  it('booleanoOpcional acepta booleanos y las cadenas true/false', () => {
    const schema = booleanoOpcional();
    expect(schema.parse(true)).toBe(true);
    expect(schema.parse('true')).toBe(true);
    expect(schema.parse('false')).toBe(false);
    expect(schema.parse('')).toBeUndefined();
    expect(schema.safeParse('yes').success).toBe(false);
    expect(schema.safeParse(1).success).toBe(false);
  });

  it('urlOpcionalNullable solo acepta http/https y null', () => {
    const schema = urlOpcionalNullable();
    expect(schema.parse('https://ejemplo.com')).toBe('https://ejemplo.com');
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse('')).toBeUndefined();
    expect(schema.safeParse('ftp://ejemplo.com').success).toBe(false);
    expect(schema.safeParse('no-es-url').success).toBe(false);
  });

  it('correoOpcionalNullable normaliza a minusculas y acepta null', () => {
    const schema = correoOpcionalNullable();
    expect(schema.parse('  Persona@EJEMPLO.COM ')).toBe('persona@ejemplo.com');
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse('')).toBeUndefined();
    expect(schema.safeParse('no-es-correo').success).toBe(false);
  });
});

describe('esquemas de auth', () => {
  it('normaliza el email y lo valida', () => {
    expect(emailSchema.parse('  Usuario@EJEMPLO.com ')).toBe('usuario@ejemplo.com');
    expect(emailSchema.safeParse('sin-arroba').success).toBe(false);
    expect(emailSchema.safeParse('a'.repeat(250) + '@x.com').success).toBe(false);
  });

  it('aplica la politica de contrasena 10..128', () => {
    expect(passwordSchema.safeParse('123456789').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890').success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('registro exige nombre, email y password y rechaza campos extra', () => {
    const valido = registroSchema.safeParse({
      nombre: '  Ana  ',
      email: 'ANA@EJEMPLO.COM',
      password: 'Password12345',
    });
    expect(valido.success).toBe(true);
    if (valido.success) {
      expect(valido.data).toEqual({
        nombre: 'Ana',
        email: 'ana@ejemplo.com',
        password: 'Password12345',
      });
    }

    expect(
      registroSchema.safeParse({
        nombre: 'Ana',
        email: 'ana@ejemplo.com',
        password: 'Password12345',
        rol: 'admin',
      }).success,
    ).toBe(false);
  });

  it('login no aplica la politica completa de contrasena', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'corta' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('esquema de inmueble', () => {
  const base = {
    codigo_sae: ' 50N-20491787 ',
    tipo_inmueble: 'Apartamento',
    departamento: 'Bogotá D.C.',
    direccion: 'CL 119 A 57 60',
  };

  it('aplica defaults y recorta textos', () => {
    const resultado = crearInmuebleSchema.parse(base);
    expect(resultado.codigo_sae).toBe('50N-20491787');
    expect(resultado.mas_admon).toBe(false);
    expect(resultado.en_home).toBe(false);
    expect(resultado.iva).toBe(false);
    expect(resultado.estado_inmueble).toBe('Disponible');
    expect(resultado.estrato).toBeUndefined();
    expect(resultado.nombre_inmueble).toBeUndefined();
  });

  it('convierte celdas vacias en campos ausentes', () => {
    const resultado = crearInmuebleSchema.parse({
      ...base,
      nombre_inmueble: '  ',
      ciudad: '',
      estrato: '',
      valor_arriendo: '',
      area_terreno: '',
      area_construida: '',
      nombre_contacto: '',
      telefono_contacto: '',
      direccion_contacto: '',
      correo_contacto: '',
      pagina_web: '',
      matricula_inmobiliaria: '',
    });
    expect(resultado.nombre_inmueble).toBeUndefined();
    expect(resultado.ciudad).toBeUndefined();
    expect(resultado.estrato).toBeUndefined();
    expect(resultado.valor_arriendo).toBeUndefined();
    expect(resultado.area_construida).toBeUndefined();
    expect(resultado.nombre_contacto).toBeUndefined();
    expect(resultado.correo_contacto).toBeUndefined();
    expect(resultado.pagina_web).toBeUndefined();
  });

  it('rechaza los campos controlados por el servidor (strict)', () => {
    for (const extra of [
      { id_inmueble: 1 },
      { id_usuario: 1 },
      { fecha_publicacion: '2024-01-01' },
      { ubicacion_inferida: true },
      { alertas: [] },
      { id_categoria: '1' },
      { campo_desconocido: 'x' },
    ]) {
      expect(crearInmuebleSchema.safeParse({ ...base, ...extra }).success).toBe(false);
    }
  });

  it('valida rangos de estrato, valor y areas', () => {
    expect(crearInmuebleSchema.safeParse({ ...base, estrato: '7' }).success).toBe(false);
    expect(crearInmuebleSchema.safeParse({ ...base, valor_arriendo: '0' }).success).toBe(false);
    expect(crearInmuebleSchema.safeParse({ ...base, area_construida: '-1' }).success).toBe(false);
    expect(crearInmuebleSchema.safeParse({ ...base, pagina_web: 'ftp://x.com' }).success).toBe(
      false,
    );
  });

  it('PATCH exige al menos un campo y acepta null para vaciar', () => {
    expect(actualizarInmuebleSchema.safeParse({}).success).toBe(false);
    expect(actualizarInmuebleSchema.parse({ ciudad: null })).toEqual({ ciudad: null });
    expect(actualizarInmuebleSchema.parse({ estrato: null })).toEqual({ estrato: null });
    expect(actualizarInmuebleSchema.parse({ valor_arriendo: null })).toEqual({
      valor_arriendo: null,
    });
    expect(actualizarInmuebleSchema.parse({ nombre_contacto: null })).toEqual({
      nombre_contacto: null,
    });
    expect(actualizarInmuebleSchema.safeParse({ codigo_sae: null }).success).toBe(false);
    expect(actualizarInmuebleSchema.safeParse({ campo_desconocido: 1 }).success).toBe(false);
  });

  it('la lista aplica defaults, coercion y validacion cruzada', () => {
    expect(listarInmueblesSchema.parse({})).toMatchObject({
      page: 1,
      limit: 20,
      estado: 'Disponible',
      sort: 'fecha_publicacion',
      order: 'desc',
    });

    expect(
      listarInmueblesSchema.parse({
        page: '2',
        limit: '50',
        departamento: '3',
        estrato: '4',
        valor_min: '1000',
        valor_max: '2000',
        area_min: '10.5',
        mias: 'true',
        q: '  bogota ',
        sort: 'valor_arriendo',
        order: 'asc',
      }),
    ).toMatchObject({
      page: 2,
      limit: 50,
      departamento: 3,
      estrato: 4,
      valor_min: 1000,
      valor_max: 2000,
      area_min: 10.5,
      mias: true,
      q: 'bogota',
      sort: 'valor_arriendo',
      order: 'asc',
    });

    expect(listarInmueblesSchema.safeParse({ valor_min: '5', valor_max: '2' }).success).toBe(
      false,
    );
    expect(listarInmueblesSchema.safeParse({ area_min: '5', area_max: '2' }).success).toBe(false);
    expect(listarInmueblesSchema.safeParse({ sort: 'nombre' }).success).toBe(false);
    expect(listarInmueblesSchema.safeParse({ order: 'random' }).success).toBe(false);
  });
});

describe('esquema de importacion', () => {
  const base = {
    codigo_sae: 'X-1',
    tipo_inmueble: 'Garaje',
    departamento: 'Bogotá D.C.',
    direccion: 'CL 1',
  };

  it('convierte la fecha de Bogota a UTC', () => {
    const resultado = filaImportacionSchema.parse({
      ...base,
      fecha_publicacion: '2021-05-14 22:51:16',
    });
    expect(resultado.fecha_publicacion?.toISOString()).toBe('2021-05-15T03:51:16.000Z');
  });

  it('acepta el separador T y rechaza fechas inexistentes o mal formadas', () => {
    expect(
      filaImportacionSchema.parse({ ...base, fecha_publicacion: '2021-05-14T22:51:16' })
        .fecha_publicacion?.toISOString(),
    ).toBe('2021-05-15T03:51:16.000Z');

    const invalida = filaImportacionSchema.safeParse({
      ...base,
      fecha_publicacion: '2021-02-30 10:00:00',
    });
    expect(invalida.success).toBe(false);
    if (!invalida.success) {
      expect(invalida.error.issues[0]?.message).toContain('YYYY-MM-DD HH:mm:ss');
    }

    expect(
      filaImportacionSchema.safeParse({ ...base, fecha_publicacion: '14/05/2021' }).success,
    ).toBe(false);
  });

  it('aplica defaults de ubicacion_inferida y alertas', () => {
    const resultado = filaImportacionSchema.parse(base);
    expect(resultado.ubicacion_inferida).toBe(false);
    expect(resultado.alertas).toEqual([]);
    expect(resultado.fecha_publicacion).toBeUndefined();
  });

  it('sigue rechazando campos extra (strict) como id_categoria', () => {
    expect(filaImportacionSchema.safeParse({ ...base, id_categoria: '1' }).success).toBe(false);
  });
});

describe('esquema de contacto', () => {
  it('exige nombre y normaliza el correo', () => {
    const resultado = crearContactoSchema.parse({
      nombre: '  Inmobiliaria  ',
      telefono: null,
      correo: '  Contacto@EJEMPLO.com ',
    });
    expect(resultado).toEqual({
      nombre: 'Inmobiliaria',
      telefono: null,
      correo: 'contacto@ejemplo.com',
    });
    expect(crearContactoSchema.safeParse({}).success).toBe(false);
    expect(crearContactoSchema.safeParse({ nombre: '   ' }).success).toBe(false);
    expect(crearContactoSchema.safeParse({ nombre: 'X', extra: 1 }).success).toBe(false);
  });
});
