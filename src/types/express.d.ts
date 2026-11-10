// Extension de los tipos de Express (declaration merging).
// Express 5 hace req.query de solo lectura: el middleware validate guarda los
// datos ya validados en req.validated y los controllers leen de ahi.

export interface UsuarioAutenticado {
  id: number;
  rol: 'usuario' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: UsuarioAutenticado;
      validated: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      // pino-http asigna un id por peticion; se usa en los logs de error.
      id?: string;
    }
  }
}

export {};
