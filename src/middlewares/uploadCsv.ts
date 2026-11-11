import multer from 'multer';
import { BadRequestError } from '../shared/errors.js';

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

const TIPOS_CSV = new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel']);

/**
 * Recibe el CSV en memoria (nunca toca disco) con un limite de 5 MB.
 * Se acepta por MIME type o por extension .csv, porque algunos navegadores
 * envian application/vnd.ms-excel para archivos CSV.
 */
export const subirArchivoCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const porExtension = file.originalname.toLowerCase().endsWith('.csv');
    if (!porExtension && !TIPOS_CSV.has(file.mimetype)) {
      callback(
        new BadRequestError(
          'ARCHIVO_INVALIDO',
          'El archivo debe ser un CSV (text/csv o extension .csv)',
        ),
      );
      return;
    }
    callback(null, true);
  },
}).single('archivo');
