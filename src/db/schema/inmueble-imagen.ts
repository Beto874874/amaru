import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { inmueble } from './inmueble.js';

// Espejo de la tabla public.inmueble_imagen creada por sql/04_imagenes.sql.
// La base guarda solo rutas y metadatos; los archivos viven en Supabase
// Storage. La URL publica se calcula al responder, nunca se persiste.
//
// Decisiones:
//  - id_imagen es GENERATED ALWAYS AS IDENTITY: el back nunca envia un id.
//  - timestamps en modo 'date' como el resto del proyecto (JSON ISO 8601).
//  - `orden` es smallint y `es_principal` boolean, tal como en la base.
export const inmuebleImagen = pgTable(
  'inmueble_imagen',
  {
    id_imagen: integer('id_imagen')
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: 'inmueble_imagen_id_imagen_seq' }),
    id_inmueble: integer('id_inmueble').notNull(),
    ruta: text('ruta').notNull(),
    ruta_miniatura: text('ruta_miniatura').notNull(),
    ancho: integer('ancho').notNull(),
    alto: integer('alto').notNull(),
    bytes: integer('bytes').notNull(),
    orden: smallint('orden').notNull().default(0),
    es_principal: boolean('es_principal').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Listar las fotos de un inmueble ya ordenadas.
    index('inmueble_imagen_inmueble_orden_idx').on(
      table.id_inmueble,
      table.orden,
      table.id_imagen,
    ),
    // A lo sumo UNA foto principal por inmueble.
    uniqueIndex('inmueble_imagen_una_principal_idx')
      .on(table.id_inmueble)
      .where(sql`es_principal`),
    // Al borrar el inmueble, la base borra sus filas (los archivos los limpia
    // el service, porque Storage no se entera de los CASCADE).
    foreignKey({
      columns: [table.id_inmueble],
      foreignColumns: [inmueble.id_inmueble],
      name: 'inmueble_imagen_id_inmueble_fkey',
    }).onDelete('cascade'),
    unique('inmueble_imagen_ruta_key').on(table.ruta),
    unique('inmueble_imagen_ruta_miniatura_key').on(table.ruta_miniatura),
    check('inmueble_imagen_dimensiones_check', sql`(ancho > 0) AND (alto > 0) AND (bytes > 0)`),
    check(
      'inmueble_imagen_ruta_segura',
      sql`(ruta !~ '(^/|\.\.)'::text) AND (ruta_miniatura !~ '(^/|\.\.)'::text)`,
    ),
  ],
);
