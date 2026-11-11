import { z } from '../../shared/zod.js';
import { crearInmuebleSchema } from '../inmuebles/schemas.js';

// ---------------------------------------------------------------------------
// Columnas del CSV (seccion 11.2). `id_categoria` y `matricula_inmobiliaria`
// se aceptan por compatibilidad, pero el servidor las ignora.
// ---------------------------------------------------------------------------

export const COLUMNAS_REQUERIDAS = [
  'codigo_sae',
  'tipo_inmueble',
  'departamento',
  'direccion',
] as const;

export const COLUMNAS_IMPORTACION = [
  'codigo_sae',
  'nombre_inmueble',
  'tipo_inmueble',
  'ciudad',
  'departamento',
  'direccion',
  'estrato',
  'valor_arriendo',
  'mas_admon',
  'en_home',
  'area_terreno',
  'area_construida',
  'iva',
  'nombre_contacto',
  'telefono_contacto',
  'direccion_contacto',
  'correo_contacto',
  'matricula_inmobiliaria',
  'estado_inmueble',
  'fecha_publicacion',
  'ubicacion_inferida',
  'alertas',
] as const;

export const COLUMNAS_BOOLEANAS = ['mas_admon', 'en_home', 'iva', 'ubicacion_inferida'] as const;

// America/Bogota es UTC-5 durante todo el ano (no tiene horario de verano).
const CINCO_HORAS_EN_MS = 5 * 60 * 60 * 1000;
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

/**
 * Convierte 'YYYY-MM-DD HH:mm:ss' en hora de Colombia al instante UTC.
 * Si el texto no tiene ese formato (o la fecha no existe) devuelve el texto
 * original para que Zod lo rechace con un mensaje en espanol.
 */
function fechaBogotaAUtc(texto: string): Date | string {
  const partes = FORMATO_FECHA.exec(texto);
  if (!partes) return texto;

  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const hora = Number(partes[4]);
  const minuto = Number(partes[5]);
  const segundo = Number(partes[6]);

  // Se interpreta como UTC para validar los componentes y luego se suman las
  // cinco horas de diferencia. Date.UTC normaliza valores fuera de rango, asi
  // que se compara el resultado para rechazar fechas como 2021-02-30.
  const comoUtc = Date.UTC(anio, mes - 1, dia, hora, minuto, segundo);
  const fecha = new Date(comoUtc);
  const valida =
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia &&
    fecha.getUTCHours() === hora &&
    fecha.getUTCMinutes() === minuto &&
    fecha.getUTCSeconds() === segundo;

  if (!valida) return texto;
  return new Date(comoUtc + CINCO_HORAS_EN_MS);
}

const fechaPublicacionSchema = z.preprocess(
  (valor) => (typeof valor === 'string' ? fechaBogotaAUtc(valor) : valor),
  z
    .date({
      message: 'fecha_publicacion debe tener el formato YYYY-MM-DD HH:mm:ss (hora de Colombia)',
    })
    .optional(),
);

// ---------------------------------------------------------------------------
// Fila del CSV: el MISMO esquema del POST normal extendido con las columnas
// que solo existen en la importacion.
// ---------------------------------------------------------------------------

export const filaImportacionSchema = crearInmuebleSchema.extend({
  fecha_publicacion: fechaPublicacionSchema,
  ubicacion_inferida: z.boolean().default(false),
  alertas: z.array(z.string()).default([]),
});

export type FilaImportacion = z.infer<typeof filaImportacionSchema>;

export interface ResultadoImportacion {
  insertados: number;
  omitidos: number;
}
