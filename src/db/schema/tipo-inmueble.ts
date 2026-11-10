import { check, integer, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tipoInmueble = pgTable(
  'tipo_inmueble',
  {
    id_tipo: integer('id_tipo')
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: 'tipo_inmueble_id_tipo_seq' }),
    nombre: text('nombre').notNull(),
  },
  (table) => [
    unique('tipo_inmueble_nombre_key').on(table.nombre),
    check('tipo_inmueble_nombre_no_vacio', sql`btrim(nombre) <> ''::text`),
  ],
);
