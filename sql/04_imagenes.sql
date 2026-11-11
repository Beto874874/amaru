-- =====================================================================
-- 04_imagenes.sql  —  Fotos de los inmuebles
-- Ejecutar UNA vez en Supabase -> SQL Editor, despues de 01, 02 y 03.
-- No borra datos: solo crea una tabla nueva.
--
-- La base guarda SOLO metadatos y rutas. Los archivos viven en Supabase
-- Storage (bucket 'inmuebles'). La URL publica NO se guarda: se calcula en
-- el back a partir de la ruta, asi no se rompe si cambia el dominio.
--
-- Por cada foto el back guarda dos archivos ya procesados (webp):
--   ruta            imagen grande (max 1600 px de ancho)  -> pagina de detalle
--   ruta_miniatura  miniatura (max 480 px de ancho)       -> listados
-- =====================================================================

BEGIN;

CREATE TABLE public.inmueble_imagen (
  id_imagen      integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- CASCADE: al borrar el inmueble se borran sus filas de imagen.
  -- OJO: los ARCHIVOS en Storage NO se borran solos; el back debe
  -- eliminarlos (ver la guia de imagenes).
  id_inmueble    integer     NOT NULL REFERENCES public.inmueble (id_inmueble) ON DELETE CASCADE,
  ruta           text        NOT NULL,
  ruta_miniatura text        NOT NULL,
  ancho          integer     NOT NULL,
  alto           integer     NOT NULL,
  bytes          integer     NOT NULL,
  orden          smallint    NOT NULL DEFAULT 0,
  es_principal   boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inmueble_imagen_ruta_key           UNIQUE (ruta),
  CONSTRAINT inmueble_imagen_ruta_miniatura_key UNIQUE (ruta_miniatura),
  -- Defensa en profundidad: las rutas son relativas y sin "..".
  CONSTRAINT inmueble_imagen_ruta_segura        CHECK (ruta !~ '(^/|\.\.)' AND ruta_miniatura !~ '(^/|\.\.)'),
  CONSTRAINT inmueble_imagen_dimensiones_check  CHECK (ancho > 0 AND alto > 0 AND bytes > 0)
);

-- Para listar las fotos de un inmueble ya ordenadas.
CREATE INDEX inmueble_imagen_inmueble_orden_idx
  ON public.inmueble_imagen (id_inmueble, orden, id_imagen);

-- A lo sumo UNA foto principal por inmueble.
CREATE UNIQUE INDEX inmueble_imagen_una_principal_idx
  ON public.inmueble_imagen (id_inmueble) WHERE es_principal;

-- Misma politica de seguridad que el resto: RLS activo y sin politicas.
ALTER TABLE public.inmueble_imagen ENABLE ROW LEVEL SECURITY;

-- El limite de fotos por inmueble (10) lo aplica el service, no la base.

COMMIT;
