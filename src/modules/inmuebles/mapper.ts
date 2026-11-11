import { aImagenPrincipal, aImagenPublica } from '../imagenes/mapper.js';
import type { InmuebleConRelaciones, ImagenDeInmueble } from './repository.js';
import type { InmuebleDetalle, InmueblePublico } from './schemas.js';

/**
 * Convierte la fila de base (con joins) al DTO publico de 9.7.
 * Lista blanca campo a campo: NUNCA se hace spread de la fila ni se exponen
 * id_usuario, email ni ningun dato del dueno.
 */
export function aInmueblePublico(
  fila: InmuebleConRelaciones,
  usuarioId?: number,
): InmueblePublico {
  const rutaPrincipal = fila.imagen_principal_ruta;
  const rutaMiniaturaPrincipal = fila.imagen_principal_ruta_miniatura;

  return {
    id: fila.id_inmueble,
    codigo_sae: fila.codigo_sae,
    nombre: fila.nombre_inmueble,
    tipo: fila.tipo,
    departamento: fila.departamento,
    ciudad: fila.ciudad,
    direccion: fila.direccion,
    estrato: fila.estrato,
    valor_arriendo: fila.valor_arriendo,
    area_terreno: fila.area_terreno,
    area_construida: fila.area_construida,
    mas_admon: fila.mas_admon,
    en_home: fila.en_home,
    iva: fila.iva,
    pagina_web: fila.pagina_web,
    estado: fila.estado,
    ubicacion_inferida: fila.ubicacion_inferida,
    alertas: fila.alertas,
    fecha_publicacion: fila.fecha_publicacion.toISOString(),
    contacto:
      fila.contacto_nombre === null
        ? null
        : {
            nombre: fila.contacto_nombre,
            telefono: fila.contacto_telefono,
            direccion: fila.contacto_direccion,
            correo: fila.contacto_correo,
          },
    publicado_por_usuario: fila.id_usuario !== null,
    es_mio: usuarioId !== undefined && fila.id_usuario === usuarioId,
    imagen_principal:
      rutaPrincipal !== null && rutaMiniaturaPrincipal !== null
        ? aImagenPrincipal({
            ruta: rutaPrincipal,
            ruta_miniatura: rutaMiniaturaPrincipal,
          })
        : null,
  };
}

/** DTO del detalle: el inmueble publico mas el arreglo completo de fotos. */
export function aInmuebleDetalle(
  fila: InmuebleConRelaciones,
  imagenes: ImagenDeInmueble[],
  usuarioId?: number,
): InmuebleDetalle {
  return {
    ...aInmueblePublico(fila, usuarioId),
    imagenes: imagenes.map(aImagenPublica),
  };
}
