import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { ciudad } from './ciudad.js';
import { contacto } from './contacto.js';
import { departamento } from './departamento.js';
import { tipoInmueble } from './tipo-inmueble.js';
import { usuario } from './usuario.js';

// Decisiones de tipos (seccion 3 de la guia):
//  - valor_arriendo: bigint en modo number (los valores reales son < 100M, muy
//    por debajo de 2^53, asi que no hay perdida de precision).
//  - areas: numeric en modo number (Drizzle convierte el string del driver `pg`
//    a number). Se documenta aqui para no repetir la duda en el repository.
//  - timestamps: mode 'date' => llegan como Date y JSON los serializa ISO 8601.
export const inmueble = pgTable(
  'inmueble',
  {
    id_inmueble: integer('id_inmueble')
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'inmueble_id_inmueble_seq' }),
    codigo_sae: text('codigo_sae').notNull(),
    nombre_inmueble: text('nombre_inmueble').notNull(),
    id_tipo: integer('id_tipo').notNull(),
    id_departamento: integer('id_departamento').notNull(),
    id_ciudad: integer('id_ciudad'),
    id_contacto: integer('id_contacto'),
    direccion: text('direccion').notNull(),
    estrato: smallint('estrato'),
    valor_arriendo: bigint('valor_arriendo', { mode: 'number' }),
    area_terreno: numeric('area_terreno', { precision: 12, scale: 2, mode: 'number' }),
    area_construida: numeric('area_construida', { precision: 12, scale: 2, mode: 'number' }),
    mas_admon: boolean('mas_admon').notNull().default(false),
    en_home: boolean('en_home').notNull().default(false),
    iva: boolean('iva').notNull().default(false),
    pagina_web: text('pagina_web'),
    estado: text('estado')
      .$type<'Disponible' | 'Arrendado' | 'No disponible'>()
      .notNull()
      .default('Disponible'),
    ubicacion_inferida: boolean('ubicacion_inferida').notNull().default(false),
    alertas: text('alertas')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    fecha_publicacion: timestamp('fecha_publicacion', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    // NULL = inmueble importado del CSV (sin dueno): solo un admin lo modifica.
    id_usuario: integer('id_usuario'),
  },
  (table) => [
    index('inmueble_estado_idx').on(table.estado),
    index('inmueble_id_ciudad_idx').on(table.id_ciudad),
    index('inmueble_id_contacto_idx').on(table.id_contacto),
    index('inmueble_id_departamento_idx').on(table.id_departamento),
    index('inmueble_id_tipo_idx').on(table.id_tipo),
    index('inmueble_id_usuario_idx').on(table.id_usuario),
    index('inmueble_valor_arriendo_idx').on(table.valor_arriendo),
    // FK compuesta: la ciudad debe pertenecer al departamento. Si id_ciudad es
    // NULL la restriccion no se evalua (comportamiento estandar de Postgres).
    foreignKey({
      columns: [table.id_departamento, table.id_ciudad],
      foreignColumns: [ciudad.id_ciudad, ciudad.id_departamento],
      name: 'inmueble_ciudad_departamento_fkey',
    }),
    foreignKey({
      columns: [table.id_contacto],
      foreignColumns: [contacto.id_contacto],
      name: 'inmueble_id_contacto_fkey',
    }),
    foreignKey({
      columns: [table.id_departamento],
      foreignColumns: [departamento.id_departamento],
      name: 'inmueble_id_departamento_fkey',
    }),
    foreignKey({
      columns: [table.id_tipo],
      foreignColumns: [tipoInmueble.id_tipo],
      name: 'inmueble_id_tipo_fkey',
    }),
    foreignKey({
      columns: [table.id_usuario],
      foreignColumns: [usuario.id_usuario],
      name: 'inmueble_id_usuario_fkey',
    }).onDelete('restrict'),
    unique('inmueble_codigo_sae_key').on(table.codigo_sae),
    check(
      'inmueble_areas_check',
      sql`(COALESCE(area_terreno, (0)::numeric) >= (0)::numeric) AND (COALESCE(area_construida, (0)::numeric) >= (0)::numeric)`,
    ),
    check(
      'inmueble_estado_check',
      sql`estado = ANY (ARRAY['Disponible'::text, 'Arrendado'::text, 'No disponible'::text])`,
    ),
    check('inmueble_estrato_check', sql`(estrato >= 1) AND (estrato <= 6)`),
    check('inmueble_valor_arriendo_check', sql`valor_arriendo > 0`),
  ],
);
