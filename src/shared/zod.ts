import { z } from 'zod';

// Mensajes de validacion en espanol para TODA la API. Se configura una sola vez:
// Zod guarda esta configuracion de forma global.
z.config(z.locales.es());

export { z };
