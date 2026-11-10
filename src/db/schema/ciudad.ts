import { check, foreignKey, integer, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { departamento } from './departamento.js';

// La doble UNIQUE no es capricho:
//  - (id_departamento, nombre) evita ciudades repetidas dentro de un departamento.
//  - (id_ciudad, id_departamento) es el destino de la FK COMPUESTA de inmueble,
//    que garantiza que la ciudad pertenezca al departamento del inmueble.
export const ciudad = pgTable(
  'ciudad',
  {
    id_ciudad: integer('id_ciudad')
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: 'ciudad_id_ciudad_seq' }),
    id_departamento: integer('id_departamento').notNull(),
    nombre: text('nombre').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id_departamento],
      foreignColumns: [departamento.id_departamento],
      name: 'ciudad_id_departamento_fkey',
    }),
    unique('ciudad_id_departamento_key').on(table.id_ciudad, table.id_departamento),
    unique('ciudad_departamento_nombre_key').on(table.id_departamento, table.nombre),
    check('ciudad_nombre_no_vacio', sql`btrim(nombre) <> ''::text`),
  ],
);
