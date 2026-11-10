import { foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { usuario } from './usuario.js';

// Una fila por refresh token emitido. `familia` agrupa la cadena de rotaciones:
// si se detecta reutilizacion de un token revocado, se revoca la familia
// completa. Solo se guarda el sha256 del token, nunca el token.
export const sesion = pgTable(
  'sesion',
  {
    id_sesion: uuid('id_sesion').primaryKey().defaultRandom(),
    id_usuario: integer('id_usuario').notNull(),
    familia: uuid('familia').notNull(),
    token_hash: text('token_hash').notNull(),
    expira_en: timestamp('expira_en', { withTimezone: true, mode: 'date' }).notNull(),
    revocada_en: timestamp('revocada_en', { withTimezone: true, mode: 'date' }),
    user_agent: text('user_agent'),
    ip: text('ip'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('sesion_familia_idx').on(table.familia),
    index('sesion_id_usuario_idx').on(table.id_usuario),
    foreignKey({
      columns: [table.id_usuario],
      foreignColumns: [usuario.id_usuario],
      name: 'sesion_id_usuario_fkey',
    }).onDelete('cascade'),
    unique('sesion_token_hash_key').on(table.token_hash),
  ],
);
