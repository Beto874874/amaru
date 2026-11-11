import { urlPublica } from '../../infra/storage.js';
import type { ImagenFila } from './repository.js';
import type { ImagenPrincipal, ImagenPublica } from './schemas.js';

// El mapper es una funcion pura campo por campo. Las rutas internas NUNCA se
// exponen: solo se transforman en URLs publicas calculadas al responder.
type CamposPublicos = Pick<
  ImagenFila,
  'id_imagen' | 'ruta' | 'ruta_miniatura' | 'ancho' | 'alto' | 'orden' | 'es_principal'
>;

export function aImagenPublica(fila: CamposPublicos): ImagenPublica {
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
