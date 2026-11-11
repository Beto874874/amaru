import multer from 'multer';
import { BadRequestError } from '../shared/errors.js';
import { MAX_IMAGENES_POR_PETICION } from '../modules/imagenes/schemas.js';

const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

// Barrera rapida por MIME declarado. La validacion REAL la hace sharp sobre el
// contenido: un .jpg falso (SVG, GIF, ejecutable...) se rechaza en procesar.ts.
const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const subirImagenes = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO_BYTES, files: MAX_IMAGENES_POR_PETICION },
  fileFilter: (_req, file, callback) => {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      callback(
        new BadRequestError(
          'IMAGEN_INVALIDA',
          'Solo se aceptan imagenes JPEG, PNG o WebP',
        ),
      );
      return;
    }
    callback(null, true);
  },
}).array('imagenes', MAX_IMAGENES_POR_PETICION);
