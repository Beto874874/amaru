import { check, integer, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Un contacto lo comparten muchos inmuebles (una inmobiliaria puede tener
// cientos), por eso es una entidad aparte y solo un admin la edita.
// El UNIQUE usa NULLS NOT DISTINCT en la base: dos contactos con los mismos
// cuatro valores (incluidos los NULL) son el mismo contacto.
export const contacto = pgTable(
  'contacto',
  {
    id_contacto: integer('id_contacto')
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: 'contacto_id_contacto_seq' }),
    nombre: text('nombre').notNull(),
    telefono: text('telefono'),
    direccion: text('direccion'),
    correo: text('correo'),
  },
  (table) => [
    unique('contacto_unico')
      .on(table.nombre, table.telefono, table.direccion, table.correo)
      .nullsNotDistinct(),
    check('contacto_nombre_no_vacio', sql`btrim(nombre) <> ''::text`),
  ],
);
