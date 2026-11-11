# API de Inmuebles en Arriendo

Backend REST para consultar, publicar y administrar inmuebles en arriendo en
Colombia. Incluye catálogos de departamentos/ciudades/tipos, contactos
compartidos, autenticación propia con cookies httpOnly, sesiones con rotación de
refresh tokens, importación masiva por CSV y documentación OpenAPI 3.1 generada
desde los esquemas Zod.

La base de producción (Supabase) ya viene cargada con los **1365 inmuebles**
históricos del CSV original y los catálogos derivados de ellos (26
departamentos, 91 ciudades, 18 tipos de inmueble).

---

## Índice

- [Características](#características)
- [Requisitos](#requisitos)
- [Instalación paso a paso](#instalación-paso-a-paso)
- [Cadenas de conexión de Supabase](#cadenas-de-conexión-de-supabase)
- [Variables de entorno](#variables-de-entorno)
- [Scripts npm](#scripts-npm)
- [Pruebas](#pruebas)
- [Crear el primer administrador](#crear-el-primer-administrador)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Arquitectura por capas](#arquitectura-por-capas)
- [Documentación de la API](#documentación-de-la-api)
- [Decisiones de producción](#decisiones-de-producción)

---

## Características

- **Consulta pública** de inmuebles con filtros por catálogo, rango de precio y
  área, búsqueda de texto, orden estable y paginación.
- **Autenticación propia** (sin Supabase Auth): contraseñas con `argon2id`,
  JWT de acceso corto y refresh token rotativo guardado como hash SHA-256.
- **Cookies httpOnly**: los tokens nunca son accesibles desde JavaScript.
- **Autorización por rol y por dueño**: un usuario solo edita/borra sus
  inmuebles; un administrador puede tocar cualquiera, incluidos los 1365
  inmuebles históricos sin dueño.
- **Catálogos** con lectura pública y escritura solo para administradores.
- **Contactos compartidos** sin duplicados (se buscan o se crean al vuelo).
- **Importación CSV** transaccional y todo-o-nada, exclusiva de administradores.
- **Validación estricta** con Zod 4 y mensajes de error en español.
- **Seguridad**: helmet, CORS con lista explícita, rate limiting, defensa CSRF
  por `Origin`, RLS activado sin políticas en Supabase.
- **OpenAPI 3.1 + Swagger UI** generados desde los mismos esquemas que valida la
  API.
- **Pruebas** unitarias e integración con Vitest + supertest.

---

## Requisitos

- **Node.js >= 22** (el proyecto usa `--env-file` nativo y `type: module`).
- **npm >= 10**.
- Una **cuenta de Supabase** con un proyecto Postgres (o un Postgres accesible).
- Opcional para pruebas de integración: **Docker Desktop** (o un segundo
  proyecto Supabase gratuito dedicado a pruebas).

---

## Instalación paso a paso

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/Beto874874/amaru.git
cd amaru
npm install
```

> npm puede pedir aprobación para scripts de instalación nativos (por ejemplo
> `argon2`). El proyecto ya declara los permitidos en `package.json`; si npm
> bloquea otro, revisa `npm install-scripts ls` antes de aprobarlo.

### 2. Crear el proyecto en Supabase

1. Entra a <https://supabase.com> y crea un proyecto.
2. Abre el **SQL Editor** y ejecuta, en este orden, los archivos de `/sql`:
   1. `sql/01_modelo.sql` — tablas, restricciones, índices, trigger y RLS.
   2. `sql/02_carga_csv.sql` — carga de los 1365 inmuebles y catálogos.
   3. `sql/03_usuarios.sql` — `usuario`, `sesion` y la columna
      `inmueble.id_usuario`.

> Los archivos SQL son la **única fuente de verdad** del esquema. Drizzle solo
> lo espeja en TypeScript con `npm run db:pull`. No se usa `generate`,
> `migrate` ni `push`.

### 3. Crear el archivo `.env`

Copia la plantilla y complétala:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Genera dos secretos JWT distintos (mínimo 32 bytes cada uno):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Guarda uno en `JWT_ACCESS_SECRET` y el otro en `JWT_REFRESH_SECRET`. Deben ser
**distintos**.

### 4. Configurar la conexión a Supabase

Completa `DATABASE_URL` y `DIRECT_URL` con las cadenas del dashboard (ver
[Cadenas de conexión](#cadenas-de-conexión-de-supabase)).

### 5. Arrancar en desarrollo

```bash
npm run dev
```

Abre <http://localhost:3000/api/v1/health>. Debe responder:

```json
{ "status": "ok", "db": "ok" }
```

Y la documentación interactiva en <http://localhost:3000/api/docs/>.

---

## Cadenas de conexión de Supabase

En el dashboard del proyecto: botón **Connect** → **Connection string** →
pestaña **URI**. Según la guía (sección 2.3) hay tres formas:

| Tipo               | Host                                | Puerto | Uso                                        |
| ------------------ | ----------------------------------- | ------ | ------------------------------------------ |
| Directa            | `db.<ref>.supabase.co`              | 5432   | Solo si tu red soporta IPv6.               |
| Session pooler     | `aws-0-<region>.pooler.supabase.com`| 5432   | Compatible con IPv4; bueno en desarrollo.  |
| Transaction pooler | `aws-0-<region>.pooler.supabase.com`| 6543   | Muchas conexiones cortas; producción.      |

Con el pooler el usuario es `postgres.<ref>`:

```text
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Decisiones de este proyecto:

- `DATABASE_URL`: la usa la aplicación en ejecución. En producción, transaction
  pooler (`6543`); en desarrollo basta el session pooler (`5432`).
- `DIRECT_URL`: la usa `drizzle-kit pull`. La conexión directa si tu red
  soporta IPv6; si no, el session pooler (`5432`).
- **No uses `.prepare()` de Drizzle con el transaction pooler** (`6543`).

> Este proyecto se conecta mediante el **session pooler** en ambos entornos
> porque la conexión directa es solo IPv6 y no era alcanzable desde la red de
> desarrollo.

### SSL

Supabase exige conexión cifrada (`DB_SSL=true` por defecto).

- En producción configura `DB_SSL_CA_PATH` con el certificado CA descargado del
  dashboard para verificar el certificado.
- Solo en desarrollo, si el CA no está disponible, se tolera
  `rejectUnauthorized: false` (excepción documentada en `src/config/db.ts`).
- Para una base local de pruebas que no soporte SSL, usa `DB_SSL=false`.

---

## Variables de entorno

Todas viven en `.env` (no se versiona). La validación es estricta: si falta una
variable o es inválida, el proceso no arranca y muestra únicamente los nombres
de los campos con problema.

| Variable             | Obligatoria | Por defecto            | Descripción                                                                 |
| -------------------- | :---------: | ---------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`           | No          | `development`          | `development`, `test` o `production`.                                       |
| `PORT`               | No          | `3000`                 | Puerto HTTP.                                                                 |
| `DATABASE_URL`       | Sí          | —                      | Cadena Postgres que usa la aplicación.                                      |
| `DIRECT_URL`         | Sí          | —                      | Cadena que usa `drizzle-kit pull`.                                          |
| `DB_SSL`             | No          | `true`                 | `false` solo para una base local de pruebas sin SSL.                        |
| `DB_SSL_CA_PATH`     | No          | vacío                  | Ruta al certificado CA de Supabase.                                         |
| `JWT_ACCESS_SECRET`  | Sí          | —                      | Secreto del access token (≥ 32 caracteres).                                 |
| `JWT_REFRESH_SECRET` | Sí          | —                      | Secreto del refresh token (≥ 32 caracteres, distinto del anterior).         |
| `ACCESS_TOKEN_TTL`   | No          | `15m`                  | Vida del access token.                                                      |
| `REFRESH_TOKEN_TTL`  | No          | `7d`                   | Vida del refresh token.                                                     |
| `COOKIE_SAMESITE`    | No          | `lax`                  | `lax`, `strict` o `none`. `none` exige `NODE_ENV=production` y HTTPS.       |
| `COOKIE_DOMAIN`      | No          | vacío                  | Dominio de las cookies (útil con subdominios).                              |
| `CORS_ORIGINS`       | No          | `http://localhost:5173`| Orígenes permitidos, separados por comas. Nunca `*` con credenciales.       |
| `TRUST_PROXY`        | No          | `false`                | `true`/`1` detrás de un proxy (Render, Railway, Fly.io).                    |
| `LOG_LEVEL`          | No          | `info`                 | `fatal`, `error`, `warn`, `info`, `debug`, `trace` o `silent`.              |
| `API_PUBLIC_URL`     | No          | `http://localhost:3000`| Origen público del propio API (necesario para el "Try it out" de Swagger).  |
| `DOCS_ENABLED`       | No          | `true`                 | `false` desmonta `/api/docs` y `/api/openapi.json`.                         |

---

## Scripts npm

| Script                  | Comando                                  | Qué hace                                                          |
| ----------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`           | `tsx watch --env-file=.env src/server.ts`| Servidor en desarrollo con recarga automática.                    |
| `npm run build`         | `tsc -p tsconfig.json`                   | Compila a `dist/`.                                                |
| `npm start`             | `node --env-file=.env dist/server.js`    | Ejecuta la versión compilada.                                     |
| `npm run typecheck`     | `tsc -p tsconfig.tests.json`             | Typecheck de `src` **y** de las pruebas.                          |
| `npm run lint`          | `eslint .`                               | Lint con reglas de capas y de tipos.                              |
| `npm test`              | `vitest run`                             | Todas las pruebas (unitarias + integración si hay `.env.test`).   |
| `npm run test:watch`    | `vitest`                                 | Pruebas en modo watch.                                            |
| `npm run test:coverage` | `vitest run --coverage`                  | Cobertura con umbrales para services y middlewares.               |
| `npm run db:pull`       | `drizzle-kit pull`                       | Regenera el schema TypeScript desde la base.                      |
| `npm run docs:export`   | `tsx --env-file=.env src/docs/export.ts` | Regenera `docs/openapi.json` (se versiona).                       |
| `npm run sesiones:limpiar` | `tsx --env-file=.env src/scripts/limpiarSesiones.ts` | Borra sesiones expiradas o revocadas.              |

---

## Pruebas

La guía exige que `npm test` **nunca** toque la base real.

### Pruebas unitarias

Usan repositorios simulados (`vi.mock`) y no necesitan base de datos:

```bash
npm test
```

Si no existe `.env.test`, las pruebas de integración se **omiten** y solo corren
las unitarias. Los módulos que validan el entorno reciben valores ficticios.

### Pruebas de integración (base desechable)

Las pruebas de integración corren con supertest contra una base Postgres
desechable. Se activan cuando existe `.env.test`, y un guard verifica que el
host de la base esté en `TEST_DB_HOST_ALLOWED`; si no coincide, las pruebas se
saltan. **Nunca apuntes `.env.test` a la base real.**

#### Opción A: Postgres en Docker (recomendada)

```bash
docker run -d --name amaru-test-db \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_USER=test \
  -e POSTGRES_DB=inmuebles_test \
  -p 55432:5432 \
  postgres:16-alpine
```

Carga el esquema:

```bash
docker cp sql/01_modelo.sql amaru-test-db:/tmp/01.sql
docker cp sql/03_usuarios.sql amaru-test-db:/tmp/03.sql
docker exec amaru-test-db psql -U test -d inmuebles_test -v ON_ERROR_STOP=1 -f /tmp/01.sql
docker exec amaru-test-db psql -U test -d inmuebles_test -v ON_ERROR_STOP=1 -f /tmp/03.sql
```

Crea `.env.test` (no se versiona):

```dotenv
NODE_ENV=test
PORT=3000

DATABASE_URL=postgresql://test:test@localhost:55432/inmuebles_test
DIRECT_URL=postgresql://test:test@localhost:55432/inmuebles_test
TEST_DB_HOST_ALLOWED=localhost
DB_SSL=false

JWT_ACCESS_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
JWT_REFRESH_SECRET=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

COOKIE_SAMESITE=lax
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=false
LOG_LEVEL=silent
API_PUBLIC_URL=http://localhost:3000
DOCS_ENABLED=true
```

> `DB_SSL=false` solo porque el Postgres de Docker no soporta SSL. En Supabase
> debe quedarse en `true`.

#### Opción B: segundo proyecto Supabase gratuito

Crea un proyecto exclusivo para pruebas y pon sus cadenas en `.env.test` con
`TEST_DB_HOST_ALLOWED` apuntando al host del pooler. No lo uses en producción.

#### Ejecutar

```bash
npm test                # unitarias + integración
npm run test:coverage   # con reporte de cobertura
```

Los archivos de integración limpian y siembran la base antes de cada prueba con
`TRUNCATE ... RESTART IDENTITY CASCADE`, así que **todo lo que haya en esa base
se borra**.

### Cobertura

`vitest.config.ts` exige al menos **80 % de líneas y sentencias** en
`src/modules/*/service.ts` y `src/middlewares/**/*.ts`, según la meta de la guía
(sección 12.3).

### Calidad

Una fase se considera terminada cuando pasan:

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm audit --audit-level=high
```

---

## Crear el primer administrador

No existe un endpoint para promover usuarios (por seguridad). Registra la cuenta
normalmente:

```http
POST /api/v1/auth/register
{ "nombre": "Admin", "email": "admin@ejemplo.com", "password": "UnaClaveSegura123" }
```

Luego, en el **SQL Editor de Supabase**:

```sql
UPDATE public.usuario SET rol = 'admin' WHERE email = 'admin@ejemplo.com';
```

Cierra sesión y vuelve a iniciar sesión para que el nuevo access token lleve el
rol `admin` (el rol viaja dentro del JWT).

---

## Estructura de carpetas

```text
amaru/
├── docs/
│   ├── openapi.json          # contrato OpenAPI 3.1 versionado
│   └── FRONTEND.md           # guía de integración para el frontend
├── sql/
│   ├── 01_modelo.sql         # tablas, restricciones, índices, RLS
│   ├── 02_carga_csv.sql      # 1365 inmuebles + catálogos
│   └── 03_usuarios.sql       # usuario, sesion, inmueble.id_usuario
├── src/
│   ├── config/               # env validado, pool de Postgres, logger
│   ├── db/schema/            # schema Drizzle espejo (generado con pull)
│   ├── docs/                 # OpenAPI, registry y export a docs/openapi.json
│   ├── middlewares/          # auth, roles, validación, errores, rate limit, CSV
│   ├── modules/
│   │   ├── auth/             # registro, login, refresh, logout, perfil
│   │   ├── catalogos/        # departamentos, ciudades, tipos de inmueble
│   │   ├── contactos/        # contactos compartidos
│   │   ├── importacion/      # importación CSV (admin)
│   │   ├── inmuebles/        # CRUD y consulta pública
│   │   └── sistema/          # /health
│   ├── scripts/              # limpieza de sesiones
│   ├── shared/               # errores, validación, paginación, pgErrors, zod
│   ├── app.ts                # composición de la app Express
│   ├── routes.ts             # montaje de módulos bajo /api/v1
│   └── server.ts             # arranque y apagado ordenado
├── tests/
│   ├── unit/                 # Vitest con repositorios simulados
│   ├── integration/          # supertest contra base desechable
│   └── setup.ts              # carga .env.test y guard de base
├── .env.example
├── drizzle.config.ts
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Arquitectura por capas

El flujo de una petición es unidireccional. `controller → service → repository`
está **impuesto por ESLint**: una capa no puede saltarse a la siguiente ni
importar hacia arriba.

```text
                 HTTP request
                      │
                      ▼
┌─────────────────────────────────────────────┐
│ routes.ts                                   │
│  define rutas y middlewares por endpoint    │
└──────────────────────┬──────────────────────┘
                       ▼
┌─────────────────────────────────────────────┐
│ controller.ts                               │
│  lee req.validated, llama al service,       │
│  construye el DTO y responde                │
└──────────────────────┬──────────────────────┘
                       ▼
┌─────────────────────────────────────────────┐
│ service.ts                                  │
│  reglas de negocio y autorización           │
│  (dueño/admin, catálogos, importación)      │
└──────────────────────┬──────────────────────┘
                       ▼
┌─────────────────────────────────────────────┐
│ repository.ts                               │
│  única capa que importa Drizzle/pg          │
└──────────────────────┬──────────────────────┘
                       ▼
                PostgreSQL (Supabase)
```

Capas transversales:

- `src/shared/`: errores tipados, validación Zod, paginación, traducción de
  errores de Postgres.
- `src/middlewares/`: autenticación, roles, validación, manejo de errores,
  rate limiting, CORS/CSRF, subida de CSV.
- `src/config/`: entorno validado, pool de base de datos, logger.
- `src/docs/`: registro OpenAPI generado desde Zod.

Los DTO se construyen **campo por campo**: nunca se hace spread de una fila de
base de datos, para que `password_hash`, `token_hash` o el `id_usuario` de otros
usuarios no puedan filtrarse.

---

## Documentación de la API

- **Swagger UI** (en ejecución): <http://localhost:3000/api/docs/>
- **Contrato OpenAPI 3.1** (en ejecución): <http://localhost:3000/api/openapi.json>
- **Contrato versionado**: [`docs/openapi.json`](docs/openapi.json)
- **Guía para el frontend**: [`docs/FRONTEND.md`](docs/FRONTEND.md)

Cada endpoint se documenta en el mismo commit en que se crea. Si cambias rutas o
esquemas, regenera el contrato versionado:

```bash
npm run docs:export
```

El documento se construye una sola vez al arrancar y se valida en las pruebas
con `@apidevtools/swagger-parser`.

---

## Decisiones de producción

- **`DOCS_ENABLED`**: en desarrollo está en `true` para facilitar la
  integración. En producción **se recomienda `false`**: desmonta Swagger UI y
  el JSON público, reduciendo la superficie expuesta. El contrato sigue
  disponible en el repositorio (`docs/openapi.json`). Si el equipo necesita la
  documentación interactiva en producción, puede dejarlo en `true`.
- **`TRUST_PROXY=true`** (o el número de proxies) cuando el API corre detrás de
  Render, Railway, Fly.io o un balanceador; sin esto los límites de peticiones
  verían siempre la IP del proxy.
- **`DATABASE_URL` por el transaction pooler (6543)** en producción.
- **SSL verificado**: configura `DB_SSL_CA_PATH` con el CA de Supabase.
- **`CORS_ORIGINS`** debe contener el dominio real del frontend.
- Con frontend en un dominio distinto: `COOKIE_SAMESITE=none` (exige HTTPS) y
  `COOKIE_DOMAIN` si aplica.
- El **healthcheck** de la plataforma debe apuntar a `/api/v1/health`.
- Los secretos JWT y las cadenas de base **nunca** se versionan: se cargan en
  la plataforma, no en un archivo `.env`.

---

## Seguridad

- Contraseñas con `argon2id`; comparación de tiempo constante también para
  emails inexistentes.
- Refresh tokens rotativos: reutilizar uno revocado invalida la familia de
  sesiones. Solo se guarda `sha256(token)` en la base.
- Cookies `httpOnly`, `SameSite` configurable y `Secure` en producción.
- Rate limiting general y específico para login/registro/refresh.
- Defensa CSRF adicional por cabecera `Origin` en métodos que modifican estado.
- RLS activado sin políticas: la API REST pública de Supabase queda bloqueada;
  toda la autorización la hace este backend.
- Mensajes de error en español que no filtran detalles internos ni datos
  personales.
