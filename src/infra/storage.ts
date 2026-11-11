import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { BadGatewayError } from '../shared/errors.js';

// Adaptador UNICO hacia Supabase Storage. Los services dependen de estas
// funciones, nunca del cliente: asi el dia que cambie el proveedor solo se
// toca este archivo. El SDK solo puede importarse aqui (regla de ESLint).
//
// La clave secreta ignora RLS. Nunca se imprime, ni siquiera en logs.
const cliente = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const bucket = env.SUPABASE_BUCKET;

/**
 * Sube un WebP ya procesado. La ruta la genera el servidor con un uuid, por eso
 * nunca hay sobrescritura (upsert: false) y la cache puede ser muy larga.
 */
export async function subir(ruta: string, buffer: Buffer): Promise<void> {
  const { error } = await cliente.storage.from(bucket).upload(ruta, buffer, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: '31536000',
  });

  if (error) {
    // Solo el mensaje, nunca el objeto completo: podria arrastrar cabeceras.
    logger.error({ mensaje: error.message, ruta }, 'Fallo al subir un archivo a Storage');
    throw new BadGatewayError();
  }
}

/**
 * Borra varios archivos (best effort). Un archivo huerfano es inofensivo; si
 * Storage falla se registra pero NO se rompe la peticion del cliente.
 */
export async function eliminar(rutas: string[]): Promise<void> {
  if (rutas.length === 0) return;

  const { error } = await cliente.storage.from(bucket).remove(rutas);

  if (error) {
    logger.error(
      { mensaje: error.message, cantidad: rutas.length },
      'Fallo al borrar archivos de Storage (quedaran huerfanos)',
    );
  }
}

/** Arma la URL publica a partir de la ruta relativa. No hace red. */
export function urlPublica(ruta: string): string {
  return cliente.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}
