-- ============================================================================
-- 02_carga_csv.sql
-- Carga masiva inicial de los 1365 inmuebles desde el CSV original.
--
-- IMPORTANTE: usa `\copy`, que es un comando de psql, NO de SQL Editor de
-- Supabase. La base ya fue cargada con este mismo proceso (seccion 2.2 de la
-- guia); este archivo queda como fuente de verdad y para reconstruir la base.
--
-- Uso:
--   psql "$DIRECT_URL" -f sql/02_carga_csv.sql
--   (con el CSV en ../InmueblesarriendoLimpio.csv, relativo a la carpeta sql/)
--
-- El CSV no se versiona en git porque contiene datos de contacto de terceros.
-- Formato: UTF-8, cabecera con 23 columnas, celdas vacias = sin dato.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabla de staging: todo entra como texto y se transforma despues, que es
--    lo mas fiel al CSV (y permite validar antes de insertar).
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE stg_inmuebles (
  id_categoria text,
  codigo_sae text,
  nombre_inmueble text,
  tipo_inmueble text,
  ciudad text,
  departamento text,
  direccion text,
  estrato text,
  valor_arriendo text,
  mas_admon text,
  en_home text,
  area_terreno text,
  area_construida text,
  iva text,
  nombre_contacto text,
  telefono_contacto text,
  direccion_contacto text,
  correo_contacto text,
  matricula_inmobiliaria text,
  estado_inmueble text,
  fecha_publicacion text,
  ubicacion_inferida text,
  alertas text
);

\copy stg_inmuebles FROM '../InmueblesarriendoLimpio.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

-- ---------------------------------------------------------------------------
-- 2) Limpieza basica: recortar espacios y convertir "" en NULL.
-- ---------------------------------------------------------------------------

UPDATE stg_inmuebles SET
  codigo_sae = nullif(btrim(codigo_sae), ''),
  nombre_inmueble = nullif(btrim(nombre_inmueble), ''),
  tipo_inmueble = nullif(btrim(tipo_inmueble), ''),
  ciudad = nullif(btrim(ciudad), ''),
  departamento = nullif(btrim(departamento), ''),
  direccion = nullif(btrim(direccion), ''),
  estrato = nullif(btrim(estrato), ''),
  valor_arriendo = nullif(btrim(valor_arriendo), ''),
  mas_admon = nullif(btrim(mas_admon), ''),
  en_home = nullif(btrim(en_home), ''),
  area_terreno = nullif(btrim(area_terreno), ''),
  area_construida = nullif(btrim(area_construida), ''),
  iva = nullif(btrim(iva), ''),
  nombre_contacto = nullif(btrim(nombre_contacto), ''),
  telefono_contacto = nullif(btrim(telefono_contacto), ''),
  direccion_contacto = nullif(btrim(direccion_contacto), ''),
  correo_contacto = nullif(btrim(correo_contacto), ''),
  estado_inmueble = nullif(btrim(estado_inmueble), ''),
  fecha_publicacion = nullif(btrim(fecha_publicacion), ''),
  ubicacion_inferida = nullif(btrim(ubicacion_inferida), ''),
  alertas = nullif(btrim(alertas), '');

-- ---------------------------------------------------------------------------
-- 3) Catalogos (solo los valores presentes en el CSV)
-- ---------------------------------------------------------------------------

INSERT INTO departamento (nombre)
SELECT DISTINCT departamento
FROM stg_inmuebles
WHERE departamento IS NOT NULL
ORDER BY departamento
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO ciudad (id_departamento, nombre)
SELECT DISTINCT d.id_departamento, s.ciudad
FROM stg_inmuebles s
JOIN departamento d ON d.nombre = s.departamento
WHERE s.ciudad IS NOT NULL
ORDER BY d.id_departamento, s.ciudad
ON CONFLICT (id_departamento, nombre) DO NOTHING;

INSERT INTO tipo_inmueble (nombre)
SELECT DISTINCT tipo_inmueble
FROM stg_inmuebles
WHERE tipo_inmueble IS NOT NULL
ORDER BY tipo_inmueble
ON CONFLICT (nombre) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) Contactos (buscar o crear, sin duplicar)
-- ---------------------------------------------------------------------------

INSERT INTO contacto (nombre, telefono, direccion, correo)
SELECT DISTINCT
  nombre_contacto,
  telefono_contacto,
  direccion_contacto,
  correo_contacto
FROM stg_inmuebles
WHERE nombre_contacto IS NOT NULL
ON CONFLICT (nombre, telefono, direccion, correo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5) Inmuebles
--    - id_usuario queda NULL: son datos importados sin dueno.
--    - fecha_publicacion viene en hora de Colombia; se convierte a UTC.
--    - alertas viene separado por ';'.
-- ---------------------------------------------------------------------------

INSERT INTO inmueble (
  codigo_sae,
  nombre_inmueble,
  id_tipo,
  id_departamento,
  id_ciudad,
  id_contacto,
  direccion,
  estrato,
  valor_arriendo,
  area_terreno,
  area_construida,
  mas_admon,
  en_home,
  iva,
  estado,
  ubicacion_inferida,
  alertas,
  fecha_publicacion
)
SELECT
  s.codigo_sae,
  COALESCE(s.nombre_inmueble, s.tipo_inmueble || ' - ' || s.codigo_sae),
  t.id_tipo,
  d.id_departamento,
  c.id_ciudad,
  ct.id_contacto,
  s.direccion,
  s.estrato::smallint,
  s.valor_arriendo::bigint,
  s.area_terreno::numeric(12, 2),
  s.area_construida::numeric(12, 2),
  COALESCE(s.mas_admon = 'true', false),
  COALESCE(s.en_home = 'true', false),
  COALESCE(s.iva = 'true', false),
  COALESCE(s.estado_inmueble, 'Disponible'),
  COALESCE(s.ubicacion_inferida = 'true', false),
  COALESCE(string_to_array(s.alertas, ';'), '{}'),
  COALESCE(
    to_timestamp(s.fecha_publicacion, 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'America/Bogota',
    now()
  )
FROM stg_inmuebles s
JOIN tipo_inmueble t ON t.nombre = s.tipo_inmueble
JOIN departamento d ON d.nombre = s.departamento
LEFT JOIN ciudad c
  ON c.id_departamento = d.id_departamento
 AND c.nombre = s.ciudad
LEFT JOIN contacto ct
  ON ct.nombre = s.nombre_contacto
 AND ct.telefono IS NOT DISTINCT FROM s.telefono_contacto
 AND ct.direccion IS NOT DISTINCT FROM s.direccion_contacto
 AND ct.correo IS NOT DISTINCT FROM s.correo_contacto
WHERE s.codigo_sae IS NOT NULL
  AND s.tipo_inmueble IS NOT NULL
  AND s.departamento IS NOT NULL
  AND s.direccion IS NOT NULL
ORDER BY s.codigo_sae
ON CONFLICT (codigo_sae) DO NOTHING;

DROP TABLE stg_inmuebles;

-- ---------------------------------------------------------------------------
-- 6) Verificacion: debe devolver 1365 (mas los publicados despues).
-- ---------------------------------------------------------------------------

SELECT count(*) AS total_inmuebles FROM inmueble;
