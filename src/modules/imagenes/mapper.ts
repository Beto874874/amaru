import { urlPublica } from '../../infra/storage.js';
import type { ImagenFila } from './repository.js';
import type { ImagenPrincipal, ImagenPublica } from './schemas.js';

// El mapper es una funcion pura campo por campo. Las rutas internas NUNCA se
// exponen: solo se transforman en URLs publicas calculadas al responder.
export function aImagenPublica(fila: ImagenFila): ImagenPublica {
  return {
    id: fila.id_imagen,
    url: urlPublica(fila.ruta),
    miniatura_url: urlPublica(fila.ruta_miniatura),
    ancho: fila.ancho,
    alto: fila.alto,
    orden: fila.orden,
    es_principal: fila.es_principal,
  };
}

export function aImagenPrincipal(fila: {
  ruta: string;
  ruta_miniatura: string;
}): ImagenPrincipal {
  return {
    url: urlPublica(fila.ruta),
    miniatura_url: urlPublica(fila.ruta_miniatura),
  };
}
