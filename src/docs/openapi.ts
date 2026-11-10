import { readFileSync } from 'node:fs';
import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';
// Efecto secundario: registra esquemas, seguridad y respuestas de error.
import './components.js';
// Cada modulo registra sus paths al importarse. Un endpoint nuevo se agrega
// aqui y en su propio <modulo>.openapi.ts.
import '../modules/sistema/sistema.openapi.js';
import '../modules/auth/auth.openapi.js';

interface PackageJson {
  version: string;
}

// La version sale de package.json (una sola fuente de verdad). Se lee con fs
// para no pelear con rootDir/JSON imports de TypeScript en NodeNext.
const paquete = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as PackageJson;

const DESCRIPCION = `
API REST para consultar y publicar inmuebles en arriendo en Colombia.
Los datos iniciales provienen de un CSV de 1365 inmuebles.

## Reglas de negocio

- **Publico**: ver inmuebles y catalogos (departamentos, ciudades, tipos).
- **Requiere sesion**: publicar un inmueble y crear contactos.
- **Solo el dueno o un admin**: editar o eliminar un inmueble publicado.
- **Solo admin**: editar/eliminar contactos, gestionar catalogos e importar CSV.
- Los 1365 inmuebles del CSV no tienen dueno: solo un admin puede modificarlos.

## Como autenticarse

La autenticacion es propia (JWT) y los tokens viajan **solo en cookies httpOnly**:

1. \`POST /auth/register\` o \`POST /auth/login\` guardan \`access_token\` (15 minutos)
   y \`refresh_token\` (7 dias, limitada a \`/api/v1/auth\`).
2. El navegador envia las cookies automaticamente; el front **no** puede leerlas
   ni debe guardar tokens en localStorage.
3. Cuando una peticion responde 401 con \`TOKEN_EXPIRADO\`, llama una vez a
   \`POST /auth/refresh\` y reintenta.
4. \`POST /auth/logout\` revoca la sesion actual; \`POST /auth/logout-all\` todas.

### Limitacion de Swagger UI

Segun la documentacion oficial de Swagger, "Try it out" no soporta bien cookies
httpOnly: el boton **Authorize** no sirve aqui. Si el navegador guarda las
cookies del login hecho desde esta misma pagina (mismo origen), los endpoints
protegidos responden. Si no, usa el contrato exportado en \`docs/openapi.json\`
o la guia \`docs/FRONTEND.md\` para probar con curl/Postman.

Guia de integracion para el front: \`docs/FRONTEND.md\` del repositorio.
`.trim();

export const TAGS = [
  { name: 'Sistema', description: 'Estado del API y de la base de datos' },
  { name: 'Auth', description: 'Registro, login, refresh, logout y perfil propio' },
  { name: 'Inmuebles', description: 'Consulta publica y publicacion autenticada de inmuebles' },
  { name: 'Catalogos', description: 'Departamentos, ciudades y tipos de inmueble' },
  { name: 'Contactos', description: 'Contactos/inmobiliarias que publican inmuebles' },
  { name: 'Importacion', description: 'Carga masiva de inmuebles por CSV (solo admin)' },
];

/**
 * Construye el documento OpenAPI 3.1 UNA vez a partir de los esquemas Zod.
 * Nunca se escribe OpenAPI a mano: si un schema cambia, la documentacion cambia.
 */
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'API de Inmuebles en Arriendo',
      version: paquete.version,
      description: DESCRIPCION,
    },
    servers: [
      { url: '/api/v1', description: 'Prefijo de la API (relativo al host actual)' },
    ],
    tags: TAGS,
  });
}
