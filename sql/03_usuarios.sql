-- ============================================================================
-- 03_usuarios.sql
-- Autenticacion propia: usuario, sesion y dueno del inmueble.
-- Ejecutar DESPUES de 01_modelo.sql y 02_carga_csv.sql.
--
-- Reglas:
--  - rol: 'usuario' | 'admin'. No hay endpoint para promover admin: se hace
--    con el UPDATE comentado al final del archivo (seccion 8.7 de la guia).
--  - email SIEMPRE en minusculas (CHECK).
--  - sesion guarda sha256(refresh_token) en hex, nunca el token.
--  - familia agrupa la cadena de rotaciones de refresh tokens.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE usuario (
  id_usuario integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  rol text NOT NULL DEFAULT 'usuario',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuario_email_key UNIQUE (email),
  CONSTRAINT usuario_email_formato CHECK (
    email = lower(btrim(email)) AND POSITION('@' IN email) > 1
  ),
  CONSTRAINT usuario_nombre_no_vacio CHECK (btrim(nombre) <> ''),
  CONSTRAINT usuario_rol_check CHECK (rol IN ('usuario', 'admin'))
);

CREATE TRIGGER usuario_set_updated_at
BEFORE UPDATE ON usuario
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE sesion (
  id_sesion uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario integer NOT NULL,
  familia uuid NOT NULL,
  token_hash text NOT NULL,
  expira_en timestamptz NOT NULL,
  revocada_en timestamptz,
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sesion_id_usuario_fkey
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  CONSTRAINT sesion_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX sesion_id_usuario_idx ON sesion (id_usuario);
CREATE INDEX sesion_familia_idx ON sesion (familia);

-- Dueno del inmueble. NULL = importado del CSV: solo un admin lo modifica.
ALTER TABLE inmueble
  ADD COLUMN id_usuario integer,
  ADD CONSTRAINT inmueble_id_usuario_fkey
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE RESTRICT;

CREATE INDEX inmueble_id_usuario_idx ON inmueble (id_usuario);

ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesion ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Crear el PRIMER ADMIN (manual, una sola vez):
--   1) registrar la cuenta con POST /auth/register
--   2) ejecutar en el SQL Editor:
--
--   UPDATE public.usuario SET rol = 'admin' WHERE email = 'tu-correo@ejemplo.com';
--
-- No hay endpoint para esto a proposito: evitar que una cuenta comprometida
-- se auto-promueva.
-- ---------------------------------------------------------------------------
