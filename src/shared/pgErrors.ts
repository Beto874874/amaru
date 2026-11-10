import type { AppError } from './errors.js';
import {
  BadRequestError,
  ConflictError,
  type DetalleValidacion,
} from './errors.js';

// Errores de Postgres -> AppError.
// Drizzle envuelve los errores del driver (DrizzleQueryError), asi que el
// codigo real puede estar en `error.code` o en algun `error.cause.code`.
// Por eso se recorre la cadena de causas.

interface DatosErrorPg {
  code: string;
  constraint?: string;
  column?: string;
}

function extraerDatosPg(error: unknown): DatosErrorPg | null {
  let actual: unknown = error;
  // Limite de profundidad: evita bucles si una causa se referencia a si misma.
  for (let i = 0; i < 5 && actual !== null && typeof actual === 'object'; i += 1) {
    const candidato = actual as { code?: unknown; constraint?: unknown; column?: unknown; cause?: unknown };
    if (typeof candidato.code === 'string' && /^[0-9A-Z]{5}$/.test(candidato.code)) {
      return {
        code: candidato.code,
        constraint: typeof candidato.constraint === 'string' ? candidato.constraint : undefined,
        column: typeof candidato.column === 'string' ? candidato.column : undefined,
      };
    }
    actual = candidato.cause;
  }
  return null;
}

const MENSAJES_UNIQUE: Record<string, { code: string; message: string }> = {
  inmueble_codigo_sae_key: {
    code: 'CODIGO_SAE_DUPLICADO',
    message: 'Ya existe un inmueble con ese codigo SAE',
  },
  usuario_email_key: {
    code: 'EMAIL_EN_USO',
    message: 'Ya existe una cuenta registrada con ese correo',
  },
  contacto_unico: {
    code: 'CONTACTO_DUPLICADO',
    message: 'Ya existe un contacto con esos mismos datos',
  },
  departamento_nombre_key: {
    code: 'REGISTRO_DUPLICADO',
    message: 'Ya existe un departamento con ese nombre',
  },
  ciudad_departamento_nombre_key: {
    code: 'CIUDAD_DUPLICADA',
    message: 'Ya existe una ciudad con ese nombre en el departamento',
  },
  tipo_inmueble_nombre_key: {
    code: 'TIPO_DUPLICADO',
    message: 'Ya existe un tipo de inmueble con ese nombre',
  },
  sesion_token_hash_key: {
    code: 'REGISTRO_DUPLICADO',
    message: 'La sesion ya existe',
  },
};

const MENSAJES_CHECK: Record<string, string> = {
  inmueble_estrato_check: 'El estrato debe estar entre 1 y 6',
  inmueble_valor_arriendo_check: 'El valor del arriendo debe ser mayor que cero',
  inmueble_areas_check: 'Las areas no pueden ser negativas',
  inmueble_estado_check: 'El estado del inmueble no es valido',
  usuario_rol_check: 'El rol no es valido',
  usuario_email_formato: 'El correo debe estar en minusculas y tener un formato valido',
  usuario_nombre_no_vacio: 'El nombre no puede estar vacio',
  contacto_nombre_no_vacio: 'El nombre del contacto no puede estar vacio',
  departamento_nombre_no_vacio: 'El nombre del departamento no puede estar vacio',
  ciudad_nombre_no_vacio: 'El nombre de la ciudad no puede estar vacio',
  tipo_inmueble_nombre_no_vacio: 'El nombre del tipo no puede estar vacio',
};

function detalle(campo: string, mensaje: string): DetalleValidacion[] {
  return [{ campo, mensaje }];
}

/**
 * Traduce un error de Postgres a AppError. Devuelve null si el error no viene
 * de la base (entonces el errorHandler aplica la regla generica).
 */
export function traducirErrorPg(error: unknown): AppError | null {
  const datos = extraerDatosPg(error);
  if (!datos) return null;

  switch (datos.code) {
    case '23505': {
      const conocido = datos.constraint ? MENSAJES_UNIQUE[datos.constraint] : undefined;
      return new ConflictError(
        conocido?.code ?? 'REGISTRO_DUPLICADO',
        conocido?.message ?? 'Ya existe un registro con esos datos',
      );
    }
    case '23503':
      // Al insertar una referencia inexistente el service ya devuelve 400 antes
      // (resuelve nombres), asi que este caso corresponde casi siempre a borrar
      // algo en uso.
      return new ConflictError(
        'REFERENCIA_INVALIDA',
        'El registro esta en uso o la referencia no existe',
      );
    case '23514':
      return new BadRequestError(
        'DATO_INVALIDO',
        (datos.constraint && MENSAJES_CHECK[datos.constraint]) ??
          'Algun dato no cumple las reglas de la base',
      );
    case '23502':
      return new BadRequestError(
        'DATO_INVALIDO',
        datos.column
          ? `Falta un dato obligatorio (${datos.column})`
          : 'Falta un dato obligatorio',
        datos.column ? detalle(datos.column, 'Este campo es obligatorio') : undefined,
      );
    case '22P02':
      return new BadRequestError('DATO_INVALIDO', 'Algun dato tiene un formato invalido');
    default:
      return null;
  }
}
