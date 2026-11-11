import sharp from 'sharp';
import { BadRequestError } from '../../shared/errors.js';

// Procesamiento 100 % en memoria: el archivo original nunca se guarda.
// Toda imagen se re-codifica a WebP, lo que ademas elimina EXIF/GPS y
// neutraliza archivos disfrazados (un .jpg que en realidad es un SVG, etc.).
export interface ImagenProcesada {
  grande: Buffer;
  miniatura: Buffer;
  /** Ancho de la imagen grande ya procesada. */
  ancho: number;
  /** Alto de la imagen grande ya procesada. */
  alto: number;
  /** Bytes de la imagen grande ya procesada. */
  bytes: number;
}

const FORMATOS_ACEPTADOS = new Set(['jpeg', 'png', 'webp']);

// Proteccion contra "bombas de descompresion": una imagen de 100 000 x 100 000
// px puede agotar la memoria aunque pese pocos bytes.
const LIMITE_PIXELES = 40_000_000;

function imagenInvalida(motivo = 'El archivo no es una imagen JPEG, PNG o WebP valida') {
  return new BadRequestError('IMAGEN_INVALIDA', motivo);
}

/**
 * Valida por CONTENIDO REAL (sharp), aplica la orientacion EXIF y genera dos
 * WebP: grande (max 1600 px de ancho) y miniatura (max 480 px).
 */
export async function procesarImagen(buffer: Buffer): Promise<ImagenProcesada> {
  let formato: string | undefined;
  try {
    const metadata = await sharp(buffer, { limitInputPixels: LIMITE_PIXELES }).metadata();
    formato = metadata.format;
  } catch {
    throw imagenInvalida();
  }

  // Se decide por metadata.format, nunca por la extension ni el Content-Type
  // que declaro el cliente. GIF, TIFF, HEIC, SVG, etc. se rechazan.
  if (!formato || !FORMATOS_ACEPTADOS.has(formato)) {
    throw imagenInvalida();
  }

  try {
    const [grande, miniatura] = await Promise.all([
      sharp(buffer, { limitInputPixels: LIMITE_PIXELES })
        .rotate() // aplica orientacion EXIF antes de descartar metadatos
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true }),
      sharp(buffer, { limitInputPixels: LIMITE_PIXELES })
        .rotate()
        .resize({ width: 480, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer(),
    ]);

    return {
      grande: grande.data,
      miniatura,
      ancho: grande.info.width,
      alto: grande.info.height,
      bytes: grande.info.size,
    };
  } catch {
    // Sin .withMetadata(): sharp descarta EXIF/GPS por defecto.
    throw imagenInvalida('No se pudo procesar la imagen');
  }
}
