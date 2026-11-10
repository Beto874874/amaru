import { check, integer, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Catalogo de departamentos. Solo lectura publica; escritura admin.
export const departamento = pgTable(
  'departamento',
  {
    id_departamento: integer('id_departamento')
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: 'departamento_id_departamento_seq' }),
    nombre: text('nombre').notNull(),
  },
  (table) => [
    unique('departamento_nombre_key').on(table.nombre),
    check('departamento_nombre_no_vacio', sql`btrim(nombre) <> ''::text`),
  ],
);
