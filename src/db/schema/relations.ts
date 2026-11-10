import { relations } from 'drizzle-orm';
import { ciudad } from './ciudad.js';
import { contacto } from './contacto.js';
import { departamento } from './departamento.js';
import { inmueble } from './inmueble.js';
import { sesion } from './sesion.js';
import { tipoInmueble } from './tipo-inmueble.js';
import { usuario } from './usuario.js';

// Relaciones de Drizzle. No son obligatorias para los joins (se puede usar
// select().leftJoin()), pero habilitan db.query.<tabla>.findMany() y dejan el
// modelo explicito. La de inmueble->ciudad usa la FK compuesta completa.
export const departamentoRelations = relations(departamento, ({ many }) => ({
  ciudades: many(ciudad),
  inmuebles: many(inmueble),
}));

export const ciudadRelations = relations(ciudad, ({ one, many }) => ({
  departamento: one(departamento, {
    fields: [ciudad.id_departamento],
    references: [departamento.id_departamento],
  }),
  inmuebles: many(inmueble),
}));

export const tipoInmuebleRelations = relations(tipoInmueble, ({ many }) => ({
  inmuebles: many(inmueble),
}));

export const contactoRelations = relations(contacto, ({ many }) => ({
  inmuebles: many(inmueble),
}));

export const usuarioRelations = relations(usuario, ({ many }) => ({
  sesiones: many(sesion),
  inmuebles: many(inmueble),
}));

export const sesionRelations = relations(sesion, ({ one }) => ({
  usuario: one(usuario, {
    fields: [sesion.id_usuario],
    references: [usuario.id_usuario],
  }),
}));

export const inmuebleRelations = relations(inmueble, ({ one }) => ({
  tipo: one(tipoInmueble, {
    fields: [inmueble.id_tipo],
    references: [tipoInmueble.id_tipo],
  }),
  departamento: one(departamento, {
    fields: [inmueble.id_departamento],
    references: [departamento.id_departamento],
  }),
  ciudad: one(ciudad, {
    fields: [inmueble.id_ciudad, inmueble.id_departamento],
    references: [ciudad.id_ciudad, ciudad.id_departamento],
  }),
  contacto: one(contacto, {
    fields: [inmueble.id_contacto],
    references: [contacto.id_contacto],
  }),
  usuario: one(usuario, {
    fields: [inmueble.id_usuario],
    references: [usuario.id_usuario],
  }),
}));
