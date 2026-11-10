import { mkdirSync, writeFileSync } from 'node:fs';
import { buildOpenApiDocument } from './openapi.js';

// Escribe docs/openapi.json, que SE VERSIONA en git. Se regenera cada vez que
// cambia un endpoint: `npm run docs:export`.
const documento = buildOpenApiDocument();
const carpeta = new URL('../../docs/', import.meta.url);
const archivo = new URL('openapi.json', carpeta);

mkdirSync(carpeta, { recursive: true });
writeFileSync(archivo, `${JSON.stringify(documento, null, 2)}\n`, 'utf8');

// eslint-disable-next-line no-console
console.log(
  `OpenAPI exportado a docs/openapi.json (${Object.keys(documento.paths ?? {}).length} rutas)`,
);
