import { boolean, check, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// `rol` es text con CHECK en la base (no un enum de Postgres); el tipo TS se
// estrecha con $type para no repetir la union en cada consulta.
// El email siempre se guarda en minusculas: el CHECK lo exige.
export const usuario = pgTable(
  'usuario',
  {
    id_usuario: integer('id_usuario')
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: 'usuario_id_usuario_seq' }),
    nombre: text('nombre').notNull(),
    email: text('email').notNull(),
    password_hash: text('password_hash').notNull(),
    rol: text('rol').$type<'usuario' | 'admin'>().notNull().default('usuario'),
    activo: boolean('activo').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('usuario_email_key').on(table.email),
    check(
      'usuario_email_formato',
      sql`(email = lower(btrim(email))) AND (POSITION(('@'::text) IN (email)) > 1)`,
    ),
    check('usuario_nombre_no_vacio', sql`btrim(nombre) <> ''::text`),
    check('usuario_rol_check', sql`rol = ANY (ARRAY['usuario'::text, 'admin'::text])`),
  ],
);
