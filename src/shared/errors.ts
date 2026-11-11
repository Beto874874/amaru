// Errores de aplicacion con un `code` estable en MAYUSCULAS. El front decide
// con el codigo, nunca con el mensaje (que puede cambiar de redaccion).
// El formato de salida unico lo aplica middlewares/errorHandler.ts.

export interface DetalleValidacion {
  campo: string;
  mensaje: string;
  /** Numero de fila fisica del archivo CSV (solo en la importacion masiva). */
  fila?: number;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: DetalleValidacion[];

  constructor(statusCode: number, code: string, message: string, details?: DetalleValidacion[]) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(code: string, message: string, details?: DetalleValidacion[]) {
    super(400, code, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string, message: string) {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string, message: string) {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(code: string, message: string, details?: DetalleValidacion[]) {
    super(422, code, message, details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'El cuerpo de la peticion es demasiado grande') {
    super(413, 'PAYLOAD_DEMASIADO_GRANDE', message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Demasiadas peticiones. Intenta de nuevo mas tarde.') {
    super(429, 'DEMASIADAS_PETICIONES', message);
  }
}
