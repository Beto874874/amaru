# Guía de integración para el frontend

Esta guía explica cómo consumir la API de Inmuebles en Arriendo desde una
aplicación web. La referencia completa y actualizada de cada endpoint está en
Swagger UI (`/api/docs`) y en el contrato OpenAPI (`/api/openapi.json`).

- Contrato versionado en el repositorio: [`docs/openapi.json`](./openapi.json).
- Swagger UI: `http://localhost:3000/api/docs/`.
- JSON OpenAPI: `http://localhost:3000/api/openapi.json`.

---

## 1. URL base por entorno

Todas las rutas de negocio cuelgan de `/api/v1`.

| Entorno     | URL base                              |
| ----------- | ------------------------------------- |
| Desarrollo  | `http://localhost:3000/api/v1`        |
| Producción  | `https://<tu-dominio>/api/v1`         |

Ejemplos:

```text
GET  http://localhost:3000/api/v1/inmuebles
POST http://localhost:3000/api/v1/auth/login
GET  http://localhost:3000/api/docs/
```

La documentación (`/api/docs` y `/api/openapi.json`) puede estar desactivada en
producción con `DOCS_ENABLED=false`; en ese caso ambas rutas responden `404`.
Durante el desarrollo está activa por defecto.

---

## 2. Autenticación con cookies

La API usa **cookies httpOnly**. El frontend **no puede leer los tokens** ni
debe intentar guardarlos en `localStorage` o `sessionStorage`.

- `access_token`: cookie de vida corta (15 min por defecto), enviada a todas
  las rutas del API (`Path=/`).
- `refresh_token`: cookie de vida larga (7 días por defecto), enviada **solo** a
  `/api/v1/auth` (`Path=/api/v1/auth`).

### Toda petición debe incluir credenciales

`fetch`:

```ts
const API = 'http://localhost:3000/api/v1';

const respuesta = await fetch(`${API}/inmuebles`, {
  credentials: 'include',
});
```

`axios`:

```ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  withCredentials: true,
});
```

Sin `credentials: 'include'` (o `withCredentials: true`) el navegador no envía
ni guarda las cookies y todas las rutas protegidas responderán `401`.

### Saber si hay sesión

No infieras la sesión por la presencia de cookies (son httpOnly). Llama a:

```text
GET /api/v1/auth/me  ->  200 { "usuario": { "id", "nombre", "email", "rol" } }
                     ->  401 { "error": { "code": "NO_AUTENTICADO" | "TOKEN_EXPIRADO" | ... } }
```

Al arrancar la aplicación conviene llamar a `GET /auth/me` una vez para
restaurar el estado de sesión.

### Login, registro y logout

```text
POST /api/v1/auth/register  { "nombre", "email", "password" }  -> 201 { usuario }
POST /api/v1/auth/login     { "email", "password" }            -> 200 { usuario }
POST /api/v1/auth/refresh   (sin body)                         -> 200 { usuario }
POST /api/v1/auth/logout    (sin body)                         -> 204
POST /api/v1/auth/logout-all (sin body, autenticado)           -> 204
PATCH /api/v1/auth/me       { "nombre" }                       -> 200 { usuario }
PATCH /api/v1/auth/password { "passwordActual", "passwordNueva" } -> 204
```

- `password`: mínimo 10 y máximo 128 caracteres.
- El email se normaliza a minúsculas y sin espacios.
- `register` y `login` responden con `Set-Cookie` de `access_token` y
  `refresh_token`: no hay tokens en el cuerpo.
- `logout` es idempotente: responde `204` aunque no hubiera sesión.
- `PATCH /auth/password` revoca las demás sesiones y reemite cookies para la
  sesión actual.

---

## 3. Estrategia ante un `401`

Los `401` de sesión llegan con uno de estos códigos:

| Código            | Significado                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `TOKEN_EXPIRADO`  | El access token venció; se puede renovar con `/auth/refresh`.       |
| `NO_AUTENTICADO`  | No hay cookie de acceso.                                           |
| `SESION_INVALIDA` | La sesión fue revocada, expiró o ya no existe. Ir al login.         |
| `TOKEN_INVALIDO`  | El token no es válido. Ir al login.                                 |

Regla recomendada:

1. Si el código es `TOKEN_EXPIRADO`, llamar **una sola vez** a
   `POST /api/v1/auth/refresh` y reintentar la petición original **una sola
   vez**.
2. Si el refresh falla, o el código es `NO_AUTENTICADO`, `SESION_INVALIDA` o
   `TOKEN_INVALIDO`, llevar al usuario al login.
3. No reintentar más de una vez: evita bucles infinitos.

### Serializar los refresh concurrentes

Si varias peticiones fallan a la vez con `TOKEN_EXPIRADO`, todas deben compartir
**una única promesa de refresh**. Si cada una llama a `/auth/refresh` por su
cuenta, la rotación de tokens invalida las demás y se pierde la sesión.

```ts
let refrescoEnCurso: Promise<boolean> | null = null;

function refrescarSesion(): Promise<boolean> {
  refrescoEnCurso ??= fetch(`${API}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refrescoEnCurso = null;
    });

  return refrescoEnCurso;
}

async function pedir(url: string, opciones: RequestInit = {}, reintentar = true) {
  const respuesta = await fetch(`${API}${url}`, {
    ...opciones,
    credentials: 'include',
  });

  if (respuesta.status !== 401 || !reintentar) return respuesta;

  const cuerpo = await respuesta.clone().json().catch(() => null);
  const codigo = cuerpo?.error?.code;

  if (codigo === 'TOKEN_EXPIRADO' && (await refrescarSesion())) {
    // Un único reintento con las cookies ya renovadas.
    return pedir(url, opciones, false);
  }

  // Ir al login.
  return respuesta;
}
```

> Importante: el refresh rota el token. Dos refresh simultáneos con la misma
> cookie hacen que el segundo falle. La promesa compartida es obligatoria.

---

## 4. CORS y cookies

- El origen del frontend debe estar listado en `CORS_ORIGINS` del backend
  (lista separada por comas). Un origen no permitido recibe
  `403 ORIGEN_NO_PERMITIDO` en peticiones que modifican estado.
- El backend responde con `Access-Control-Allow-Credentials: true`. **Nunca**
  se puede usar `Access-Control-Allow-Origin: *` junto con credenciales.
- En local, si front y API están en el mismo sitio (`localhost`), funciona
  `SameSite=Lax`.
- En producción con dominios distintos (por ejemplo `app.midominio.com` y
  `api.midominio.com` son el mismo sitio; `midominio.com` y `otro.com` no), se
  necesita:
  - `COOKIE_SAMESITE=none` en el backend,
  - HTTPS obligatorio (las cookies `SameSite=None` deben ser `Secure`),
  - `NODE_ENV=production`.
- Si el front está en el mismo dominio que la API, `SameSite=Lax` es suficiente.

---

## 5. Formato de errores

Todos los errores usan el mismo formato:

```json
{
  "error": {
    "code": "VALIDACION_FALLIDA",
    "message": "Los datos enviados no son validos",
    "details": [
      { "campo": "email", "mensaje": "El correo no tiene un formato valido" }
    ]
  }
}
```

- `code`: identificador estable para lógica del front.
- `message`: texto en español listo para mostrar o registrar.
- `details`: opcional; normalmente en errores de validación (`400`) e
  importación (`422`).

### Códigos de error

| Código                         | HTTP | Significado / acción sugerida                                                        |
| ------------------------------ | ---- | ----------------------------------------------------------------------------------- |
| `VALIDACION_FALLIDA`           | 400  | Datos inválidos. Marcar los campos de `details[].campo`.                            |
| `JSON_INVALIDO`                | 400  | El cuerpo no es JSON válido. Revisar el envío.                                       |
| `DATO_INVALIDO`                | 400  | Un dato no cumple una regla de la base. Mostrar `message`.                          |
| `SIN_CAMBIOS`                  | 400  | El PATCH no trae ningún campo a modificar.                                          |
| `ARCHIVO_REQUERIDO`            | 400  | Falta el archivo CSV en el campo `archivo`.                                         |
| `ARCHIVO_INVALIDO`             | 400  | El archivo no es un CSV válido.                                                     |
| `IMAGEN_REQUERIDA`             | 400  | No se envió ningún archivo en el campo `imagenes`.                                  |
| `IMAGEN_INVALIDA`              | 400  | El archivo no es una imagen JPEG, PNG o WebP válida. Revisar el archivo.            |
| `CSV_INVALIDO`                 | 400  | El CSV no tiene las columnas obligatorias o está mal formado.                       |
| `CSV_VACIO`                    | 400  | El CSV no tiene filas de datos.                                                     |
| `TIPO_INVALIDO`                | 400  | El `tipo_inmueble` no existe en el catálogo.                                        |
| `DEPARTAMENTO_INVALIDO`        | 400  | El `departamento` no existe en el catálogo.                                         |
| `CIUDAD_INVALIDA`              | 400  | La `ciudad` no existe o no pertenece al departamento.                               |
| `DATOS_INCOMPLETOS`            | 400  | Faltan datos obligatorios para calcular la ubicación.                               |
| `NO_AUTENTICADO`               | 401  | No hay sesión. Llevar al login.                                                     |
| `TOKEN_EXPIRADO`               | 401  | El access token venció. Intentar `/auth/refresh` una vez.                           |
| `TOKEN_INVALIDO`               | 401  | Token inválido. Llevar al login.                                                    |
| `SESION_INVALIDA`              | 401  | Sesión revocada o expirada. Llevar al login.                                        |
| `CREDENCIALES_INVALIDAS`       | 401  | Email o contraseña incorrectos. Mostrar mensaje genérico.                           |
| `PROHIBIDO`                    | 403  | El usuario no tiene permiso para esa acción. Ocultar la acción.                     |
| `USUARIO_DESACTIVADO`          | 403  | La cuenta está desactivada. Contactar al administrador.                             |
| `ORIGEN_NO_PERMITIDO`          | 403  | El origen del front no está en `CORS_ORIGINS`. Revisar configuración.               |
| `INMUEBLE_NO_ENCONTRADO`       | 404  | El inmueble no existe (o fue borrado).                                             |
| `IMAGEN_NO_ENCONTRADA`         | 404  | La imagen no existe en ese inmueble.                                               |
| `CONTACTO_NO_ENCONTRADO`       | 404  | El contacto no existe.                                                              |
| `DEPARTAMENTO_NO_ENCONTRADO`   | 404  | El departamento no existe.                                                          |
| `CIUDAD_NO_ENCONTRADA`         | 404  | La ciudad no existe.                                                                |
| `TIPO_NO_ENCONTRADO`           | 404  | El tipo de inmueble no existe.                                                      |
| `RUTA_NO_ENCONTRADA`           | 404  | La URL no existe. Revisar la ruta.                                                  |
| `EMAIL_EN_USO`                 | 409  | Ya hay una cuenta con ese correo. Sugerir iniciar sesión.                           |
| `CODIGO_SAE_DUPLICADO`         | 409  | Ya existe un inmueble con ese `codigo_sae`.                                         |
| `CONTACTO_DUPLICADO`           | 409  | Ya existe un contacto con esos datos.                                               |
| `CIUDAD_DUPLICADA`             | 409  | Ya existe esa ciudad en el departamento.                                            |
| `TIPO_DUPLICADO`               | 409  | Ya existe ese tipo de inmueble.                                                     |
| `REGISTRO_DUPLICADO`           | 409  | Ya existe un registro con esos datos.                                               |
| `REFERENCIA_INVALIDA`          | 409  | El registro está en uso (por ejemplo, borrar un contacto/catálogo con inmuebles).   |
| `LIMITE_IMAGENES`              | 409  | El inmueble ya tiene el máximo de 10 fotos. Borrar alguna antes de subir más.       |
| `PAYLOAD_DEMASIADO_GRANDE`     | 413  | El cuerpo o el archivo supera el límite (JSON 100 KB, CSV 5 MB, imagen 10 MB).      |
| `IMPORTACION_INVALIDA`         | 422  | Hay filas inválidas en el CSV. Ver `details[]` (`fila`, `campo`, `mensaje`).         |
| `DEMASIADAS_PETICIONES`        | 429  | Límite de peticiones alcanzado. Esperar y reintentar.                               |
| `ERROR_INTERNO`                | 500  | Error inesperado. Mostrar mensaje genérico y registrar `request id`.                |
| `ALMACENAMIENTO_NO_DISPONIBLE` | 502  | Falló Supabase Storage al guardar la foto. Reintentar más tarde.                    |
| `BASE_DE_DATOS_NO_DISPONIBLE`  | 503  | La base no responde. Reintentar más tarde o mostrar estado de mantenimiento.        |

Los límites de peticiones son: 300 peticiones / 15 min en general, 10 / 15 min
en login y registro, y 60 / 15 min en refresh. Al superarlos se recibe
`429 DEMASIADAS_PETICIONES`.

---

## 6. Listado, paginación y filtros de inmuebles

`GET /inmuebles` es público. Devuelve:

```json
{
  "data": [ { "id": 1, "nombre": "...", "valor_arriendo": 1500000 } ],
  "meta": { "page": 1, "limit": 20, "total": 1365, "totalPages": 69 }
}
```

### Parámetros

| Parámetro    | Tipo / valores                                          | Por defecto            |
| ------------ | ------------------------------------------------------- | ---------------------- |
| `page`       | entero ≥ 1                                              | `1`                    |
| `limit`      | entero 1–100                                            | `20`                   |
| `sort`       | `fecha_publicacion`, `valor_arriendo`, `area_construida` | `fecha_publicacion`   |
| `order`      | `asc`, `desc`                                           | `desc`                 |
| `departamento` | **id** del departamento                               | —                      |
| `ciudad`     | **id** de la ciudad                                     | —                      |
| `tipo`       | **id** del tipo de inmueble                             | —                      |
| `estrato`    | entero 1–6                                              | —                      |
| `valor_min`  | entero ≥ 1                                              | —                      |
| `valor_max`  | entero ≥ 1                                              | —                      |
| `area_min`   | número ≥ 0 (sobre `area_construida`)                    | —                      |
| `area_max`   | número ≥ 0                                              | —                      |
| `estado`     | `Disponible`, `Arrendado`, `No disponible`              | `Disponible`           |
| `q`          | texto (busca en nombre y dirección, `ILIKE`)            | —                      |
| `mias`       | `true` / `false`; solo los del usuario autenticado      | `false`                |

> **Ojo:** `estado` tiene por defecto `Disponible`. Para ver todos los estados,
> envía el estado explícitamente o consulta cada uno por separado.
>
> Los filtros de catálogo usan **IDs, no nombres**. Obtén los IDs desde
> `/departamentos`, `/ciudades` y `/tipos-inmueble`.
>
> `mias=true` exige sesión; sin sesión responde `401 NO_AUTENTICADO`.
>
> `valor_min` no puede ser mayor que `valor_max` (y `area_min` no puede ser
> mayor que `area_max`); de lo contrario responde `400 VALIDACION_FALLIDA`.

### Ejemplos de URL

```text
GET /api/v1/inmuebles?page=2&limit=24&sort=valor_arriendo&order=asc

GET /api/v1/inmuebles?departamento=1&ciudad=1&tipo=1

GET /api/v1/inmuebles?estado=Arrendado&valor_min=1000000&valor_max=2500000

GET /api/v1/inmuebles?q=apartamento%20norte&area_min=60&area_max=120

GET /api/v1/inmuebles?mias=true          (requiere sesión)
```

### Detalle

```text
GET /api/v1/inmuebles/{id}
```

Responde `200 { "inmueble": { ... } }`. Si el visitante está autenticado, cada
inmueble incluye `es_mio` (`true` si le pertenece). El detalle agrega el arreglo
`imagenes` con todas las fotos (ver [Imágenes](#8-imágenes-de-los-inmuebles)).
El DTO **nunca** expone el `id_usuario` ni el email del dueño.

---

## 7. Publicar un inmueble

`POST /api/v1/inmuebles` exige sesión (`401` si no la hay). El cuerpo usa el
mismo formato que el CSV.

```json
{
  "codigo_sae": "WEB-001",
  "tipo_inmueble": "Apartamento",
  "departamento": "Bogotá D.C.",
  "ciudad": "Bogotá D.C.",
  "direccion": "CL 119 A 57 60",
  "nombre_inmueble": "Apartamento norte",
  "estrato": 3,
  "valor_arriendo": 1500000,
  "area_terreno": 80,
  "area_construida": 60.5,
  "mas_admon": false,
  "en_home": false,
  "iva": false,
  "pagina_web": "https://ejemplo.com/inmueble/1",
  "estado_inmueble": "Disponible",
  "nombre_contacto": "Inmobiliaria Uno",
  "telefono_contacto": "3001234567",
  "direccion_contacto": "CL 1 # 2-3",
  "correo_contacto": "inmo@ejemplo.com",
  "matricula_inmobiliaria": "50C-123"
}
```

Campos obligatorios: `codigo_sae`, `tipo_inmueble`, `departamento`,
`direccion`. Los demás son opcionales.

- `tipo_inmueble`, `departamento` y `ciudad` se envían **por nombre exacto** y el
  servidor los resuelve a IDs. Si no existen: `400 TIPO_INVALIDO`,
  `DEPARTAMENTO_INVALIDO` o `CIUDAD_INVALIDA`.
- Si la ciudad no pertenece al departamento indicado, también es
  `CIUDAD_INVALIDA`.
- Si no envías `nombre_inmueble`, se genera `"<tipo_inmueble> - <codigo_sae>"`.
- `estado_inmueble` por defecto es `Disponible`.
- `matricula_inmobiliaria` se acepta por compatibilidad con el CSV pero el
  servidor la ignora.
- Si envías `nombre_contacto`, el contacto se busca o se crea sin duplicar. Los
  datos de contacto se comparten entre inmuebles.
- Los campos controlados por el servidor (`id_usuario`, `fecha_publicacion`,
  `created_at`, etc.) **no se aceptan**: el cuerpo es estricto y responde `400`.
- `codigo_sae` es único: si ya existe, `409 CODIGO_SAE_DUPLICADO`.

### Catálogos para poblar los selects

Lectura pública, con `Cache-Control: public, max-age=300`:

```text
GET /api/v1/departamentos              -> 200 { "data": [ { "id": 1, "nombre": "Bogotá D.C." } ] }
GET /api/v1/ciudades?departamento=1    -> 200 { "data": [ { "id": 1, "nombre": "Bogotá D.C.", "id_departamento": 1 } ] }
GET /api/v1/tipos-inmueble             -> 200 { "data": [ { "id": 1, "nombre": "Apartamento" } ] }
```

La escritura de catálogos (POST/PATCH/DELETE) es **solo admin**.

### Importación masiva por CSV (solo admin)

```text
POST /api/v1/importacion/inmuebles
Content-Type: multipart/form-data
Campo: archivo (CSV, máximo 5 MB)
```

Respuesta `201 { "insertados": 2, "omitidos": 0 }`. La importación es
**todo o nada**: si una fila es inválida responde `422 IMPORTACION_INVALIDA`
con `details[]` y no inserta ninguna fila.

---

## 8. Imágenes de los inmuebles

Cada inmueble puede tener hasta **10 fotos**. El backend las procesa y guarda
siempre en WebP: una **imagen grande** (máximo 1600 px de ancho) para el detalle
y una **miniatura** (máximo 480 px) para listados y tarjetas. Las URLs son
públicas y estables: se pueden usar directo en `<img src="...">` sin
credenciales.

### 8.1 Qué trae cada respuesta

- `GET /inmuebles` y `GET /inmuebles/{id}` incluyen
  `imagen_principal: { url, miniatura_url } | null`. Es `null` si el inmueble no
  tiene fotos; en ese caso muestra un placeholder.
- `GET /inmuebles/{id}` agrega `imagenes: ImagenPublica[]`, ordenado por `orden`
  y luego por `id`. El listado **no** envía el arreglo completo (peso).

Cada elemento de `imagenes` tiene esta forma:

| Campo           | Tipo    | Uso                                                |
| --------------- | ------- | -------------------------------------------------- |
| `id`            | entero  | Identificador para `PATCH`/`DELETE`.               |
| `url`           | string  | Foto grande para la página de detalle.             |
| `miniatura_url` | string  | Miniatura para tarjetas y listados (más liviana).  |
| `ancho`         | entero  | Ancho de la foto grande en píxeles.                |
| `alto`          | entero  | Alto de la foto grande en píxeles.                 |
| `orden`         | entero  | Posición dentro del inmueble.                      |
| `es_principal`  | boolean | `true` en la foto que se muestra como portada.     |

### 8.2 Subir fotos

```text
POST /api/v1/inmuebles/{id}/imagenes
Content-Type: multipart/form-data
Campo: imagenes (1 a 5 archivos)
```

Requiere sesión y ser el dueño del inmueble o un admin.

```ts
const form = new FormData();
archivos.forEach((archivo) => form.append('imagenes', archivo));

const respuesta = await fetch(`${API}/inmuebles/${id}/imagenes`, {
  method: 'POST',
  body: form,
  credentials: 'include',
});

if (respuesta.status === 201) {
  const { data } = await respuesta.json(); // ImagenPublica[]
}
```

> **No fijes el header `Content-Type` a mano.** El navegador debe generarlo con
> el `boundary` del multipart. Con axios pasa lo mismo: no envíes
> `'Content-Type': 'multipart/form-data'`; deja que la librería lo haga.

Límites:

- 1 a 5 archivos por petición.
- 10 fotos por inmueble (`409 LIMITE_IMAGENES` si se supera).
- 10 MB por archivo (`413 PAYLOAD_DEMASIADO_GRANDE`).
- Solo JPEG, PNG o WebP. La validación real es por **contenido**, no por la
  extensión ni por el `Content-Type`.
- 30 subidas cada 15 minutos por usuario (`429 DEMASIADAS_PETICIONES`).

La operación es **todo o nada**: si una foto falla, no se guarda ninguna y la
respuesta indica la posición del archivo inválido.

### 8.3 Cambiar la foto principal y el orden

```text
PATCH /api/v1/inmuebles/{id}/imagenes/{idImagen}
{ "es_principal": true }        // o { "orden": 3 }, o ambos
```

- `es_principal` solo acepta `true`. Para quitar la principal, marca otra foto.
- `orden` es el orden final que quieres; no tiene que ser consecutivo.
- Responde `200 { "imagen": ImagenPublica }`.

### 8.4 Borrar una foto

```text
DELETE /api/v1/inmuebles/{id}/imagenes/{idImagen}  -> 204
```

Si la foto borrada era la principal y quedan más, el servidor promueve la de
menor `orden` (desempate por `id`). Recuerda actualizar la UI con la respuesta
del siguiente `GET /inmuebles/{id}`.

### 8.5 Errores de imágenes

| Código                         | HTTP | Acción sugerida                                                  |
| ------------------------------ | ---- | ---------------------------------------------------------------- |
| `IMAGEN_REQUERIDA`             | 400  | No se adjuntó ningún archivo; revisar el `FormData`.             |
| `IMAGEN_INVALIDA`              | 400  | El archivo no es JPEG/PNG/WebP válido; mostrar cuál falló.       |
| `LIMITE_IMAGENES`              | 409  | Ya hay 10 fotos; borrar alguna antes de subir más.               |
| `IMAGEN_NO_ENCONTRADA`         | 404  | La foto no existe en ese inmueble; recargar el detalle.          |
| `PAYLOAD_DEMASIADO_GRANDE`     | 413  | El archivo supera 10 MB; comprimirlo o reducirlo antes de subir. |
| `ALMACENAMIENTO_NO_DISPONIBLE` | 502  | Falló el servicio de archivos; reintentar más tarde.             |

---

## 9. Contactos (uso interno)

Requieren sesión.

| Método   | Ruta                  | Permiso | Notas                                                        |
| -------- | --------------------- | ------- | ------------------------------------------------------------ |
| `GET`    | `/contactos`          | Usuario | Lista paginada; busca por nombre.                            |
| `GET`    | `/contactos/{id}`     | Usuario | `200 { "contacto": { ... } }`.                               |
| `POST`   | `/contactos`          | Usuario | "Buscar o crear": `201` si es nuevo, `200` si ya existía.    |
| `PATCH`  | `/contactos/{id}`     | Admin   | Un contacto lo comparten muchos inmuebles.                   |
| `DELETE` | `/contactos/{id}`     | Admin   | Si está en uso: `409 REFERENCIA_INVALIDA`.                   |

En general, al publicar un inmueble basta con enviar los campos
`*_contacto`; no es necesario crear el contacto antes.

---

## 10. Permisos y estados

### Quién puede qué

| Acción                                              | Visitante | Usuario | Admin |
| --------------------------------------------------- | :-------: | :-----: | :---: |
| `GET /inmuebles` y `GET /inmuebles/{id}`            |    Sí     |   Sí    |  Sí   |
| `GET /inmuebles?mias=true`                          |    No     |   Sí    |  Sí   |
| `POST /inmuebles`                                   |    No     |   Sí    |  Sí   |
| `PATCH` / `DELETE /inmuebles/{id}`                  |    No     |  Solo si es el dueño | Sí (cualquiera) |
| Subir, ordenar o borrar fotos de un inmueble        |    No     |  Solo si es el dueño | Sí (cualquiera) |
| Inmuebles importados o del CSV (`id_usuario NULL`)  |    No     |   No    |  Sí   |
| `GET` catálogos                                     |    Sí     |   Sí    |  Sí   |
| Escribir catálogos (`POST`/`PATCH`/`DELETE`)        |    No     |   No    |  Sí   |
| Contactos: `GET` / `POST`                           |    No     |   Sí    |  Sí   |
| Contactos: `PATCH` / `DELETE`                       |    No     |   No    |  Sí   |
| `POST /importacion/inmuebles`                       |    No     |   No    |  Sí   |

Usa `es_mio` para decidir si mostrar los botones de editar/borrar, y el `rol`
de `GET /auth/me` para las acciones de administrador. Aun así, el backend
siempre vuelve a validar los permisos: ocultar un botón es solo UX.

### Valores válidos de `estado`

```text
Disponible | Arrendado | No disponible
```

- Al publicar, si no se envía, el valor por defecto es `Disponible`.
- En `GET /inmuebles`, el filtro `estado` también vale `Disponible` por
  defecto.
- En `PATCH`, el campo se llama `estado_inmueble`.

---

## 11. Resumen de rutas

Rutas relativas a la URL base (`/api/v1`).

| Método   | Ruta                              | Auth        |
| -------- | --------------------------------- | ----------- |
| `GET`    | `/health`                         | Público     |
| `POST`   | `/auth/register`                  | Público     |
| `POST`   | `/auth/login`                     | Público     |
| `POST`   | `/auth/refresh`                   | Cookie refresh |
| `POST`   | `/auth/logout`                    | Público     |
| `POST`   | `/auth/logout-all`                | Sesión      |
| `GET`    | `/auth/me`                        | Sesión      |
| `PATCH`  | `/auth/me`                        | Sesión      |
| `PATCH`  | `/auth/password`                  | Sesión      |
| `GET`    | `/inmuebles`                      | Público     |
| `GET`    | `/inmuebles/{id}`                 | Público     |
| `POST`   | `/inmuebles`                      | Sesión      |
| `PATCH`  | `/inmuebles/{id}`                 | Dueño/Admin |
| `DELETE` | `/inmuebles/{id}`                 | Dueño/Admin |
| `POST`   | `/inmuebles/{id}/imagenes`        | Dueño/Admin |
| `PATCH`  | `/inmuebles/{id}/imagenes/{idImagen}` | Dueño/Admin |
| `DELETE` | `/inmuebles/{id}/imagenes/{idImagen}` | Dueño/Admin |
| `GET`    | `/departamentos`                  | Público     |
| `POST`   | `/departamentos`                  | Admin       |
| `PATCH`  | `/departamentos/{id}`             | Admin       |
| `DELETE` | `/departamentos/{id}`             | Admin       |
| `GET`    | `/ciudades`                       | Público     |
| `POST`   | `/ciudades`                       | Admin       |
| `PATCH`  | `/ciudades/{id}`                  | Admin       |
| `DELETE` | `/ciudades/{id}`                  | Admin       |
| `GET`    | `/tipos-inmueble`                 | Público     |
| `POST`   | `/tipos-inmueble`                 | Admin       |
| `PATCH`  | `/tipos-inmueble/{id}`            | Admin       |
| `DELETE` | `/tipos-inmueble/{id}`            | Admin       |
| `GET`    | `/contactos`                      | Sesión      |
| `POST`   | `/contactos`                      | Sesión      |
| `GET`    | `/contactos/{id}`                 | Sesión      |
| `PATCH`  | `/contactos/{id}`                 | Admin       |
| `DELETE` | `/contactos/{id}`                 | Admin       |
| `POST`   | `/importacion/inmuebles`          | Admin       |

La lista completa con esquemas de entrada/salida, códigos y ejemplos está en
`/api/docs` y en [`docs/openapi.json`](./openapi.json).
