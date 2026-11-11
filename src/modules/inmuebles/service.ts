import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors.js';
import {
  calcularOffset,
  construirMeta,
  type RespuestaPaginada,
} from '../../shared/pagination.js';
import { aInmueblePublico } from './mapper.js';
import * as repo from './repository.js';
import type {
  ActualizarInmuebleInput,
  CrearInmuebleInput,
  InmueblePublico,
  ListarInmueblesQuery,
} from './schemas.js';

export interface UsuarioSolicitante {
  id: number;
  rol: 'usuario' | 'admin';
}

// ---------------------------------------------------------------------------
// Resolucion de catalogos por nombre exacto (case-sensitive, tras trim).
// ---------------------------------------------------------------------------

async function resolverTipo(nombre: string): Promise<number> {
  const tipo = await repo.buscarTipoPorNombre(nombre);
  if (!tipo) {
    const validos = await repo.listarNombresTipos();
    throw new BadRequestError(
      'TIPO_INVALIDO',
      `El tipo de inmueble "${nombre}" no existe. Tipos validos: ${validos.join(', ')}`,
    );
  }
  return tipo.id;
}

async function resolverDepartamento(nombre: string): Promise<number> {
  const departamento = await repo.buscarDepartamentoPorNombre(nombre);
  if (!departamento) {
    const validos = await repo.listarNombresDepartamentos();
    throw new BadRequestError(
      'DEPARTAMENTO_INVALIDO',
      `El departamento "${nombre}" no existe. Departamentos validos: ${validos.join(', ')}`,
    );
  }
  return departamento.id;
}

async function resolverCiudad(idDepartamento: number, nombre: string): Promise<number> {
  const ciudad = await repo.buscarCiudadPorNombre(idDepartamento, nombre);
  if (!ciudad) {
    throw new BadRequestError(
      'CIUDAD_INVALIDA',
      `La ciudad "${nombre}" no existe en ese departamento`,
    );
  }
  return ciudad.id;
}

// ---------------------------------------------------------------------------
// Autorizacion de dominio (8.6). La ruta solo exige sesion; esto decide si el
// usuario puede tocar ESTE inmueble.
// ---------------------------------------------------------------------------

function verificarPropiedad(fila: repo.InmuebleConRelaciones, usuario: UsuarioSolicitante): void {
  if (usuario.rol === 'admin') return;
  if (fila.id_usuario !== null && fila.id_usuario === usuario.id) return;
  throw new ForbiddenError(
    'PROHIBIDO',
    'Solo el dueno del inmueble o un admin puede realizar esta accion',
  );
}

/**
 * Autorizacion reutilizable (7.2 de la guia de imagenes): 404 si el inmueble no
 * existe y 403 si el solicitante no es su dueno ni admin. La usan los modulos
 * que modifican recursos del inmueble (p. ej. imagenes) sin duplicar la regla.
 */
export async function asegurarPuedeModificar(
  usuario: UsuarioSolicitante,
  idInmueble: number,
): Promise<void> {
  const fila = await repo.buscarPorId(idInmueble);
  if (!fila) {
    throw new NotFoundError('INMUEBLE_NO_ENCONTRADO', 'El inmueble no existe');
  }
  verificarPropiedad(fila, usuario);
}

// ---------------------------------------------------------------------------
// Contacto
// ---------------------------------------------------------------------------

function contactoDeCreacion(input: CrearInmuebleInput): repo.DatosContacto | null {
  if (!input.nombre_contacto) return null;
  return {
    nombre: input.nombre_contacto,
    telefono: input.telefono_contacto ?? null,
    direccion: input.direccion_contacto ?? null,
    correo: input.correo_contacto ?? null,
  };
}

/**
 * Resuelve el contacto resultante de un PATCH:
 *  - undefined: no se envio ningun campo de contacto -> no tocar.
 *  - null: se envio nombre_contacto: null -> quitar el contacto.
 *  - objeto: se "busca o crea" con los campos enviados, completando con los
 *    actuales. Los contactos son compartidos, asi que nunca se mutan: si los
 *    datos cambian se crea otro contacto y se reasigna el inmueble.
 */
function contactoDeActualizacion(
  fila: repo.InmuebleConRelaciones,
  cambios: ActualizarInmuebleInput,
): repo.DatosContacto | null | undefined {
  const hayCambio =
    cambios.nombre_contacto !== undefined ||
    cambios.telefono_contacto !== undefined ||
    cambios.direccion_contacto !== undefined ||
    cambios.correo_contacto !== undefined;

  if (!hayCambio) return undefined;
  if (cambios.nombre_contacto === null) return null;

  const actual =
    fila.contacto_nombre === null
      ? { nombre: null, telefono: null, direccion: null, correo: null }
      : {
          nombre: fila.contacto_nombre,
          telefono: fila.contacto_telefono,
          direccion: fila.contacto_direccion,
          correo: fila.contacto_correo,
        };

  const nombre = cambios.nombre_contacto ?? actual.nombre;
  if (!nombre) {
    throw new BadRequestError(
      'DATOS_INCOMPLETOS',
      'Para asignar un contacto debes enviar nombre_contacto',
    );
  }

  return {
    nombre,
    telefono:
      cambios.telefono_contacto !== undefined ? cambios.telefono_contacto : actual.telefono,
    direccion:
      cambios.direccion_contacto !== undefined ? cambios.direccion_contacto : actual.direccion,
    correo: cambios.correo_contacto !== undefined ? cambios.correo_contacto : actual.correo,
  };
}

// ---------------------------------------------------------------------------
// Casos de uso
// ---------------------------------------------------------------------------

export async function crear(
  usuarioId: number,
  input: CrearInmuebleInput,
): Promise<InmueblePublico> {
  const idTipo = await resolverTipo(input.tipo_inmueble);
  const idDepartamento = await resolverDepartamento(input.departamento);
  const idCiudad = input.ciudad ? await resolverCiudad(idDepartamento, input.ciudad) : null;
  const nombre = input.nombre_inmueble ?? `${input.tipo_inmueble} - ${input.codigo_sae}`;

  const fila = await repo.crearInmueble({
    codigoSae: input.codigo_sae,
    nombreInmueble: nombre,
    idTipo,
    idDepartamento,
    idCiudad,
    idUsuario: usuarioId,
    direccion: input.direccion,
    estrato: input.estrato ?? null,
    valorArriendo: input.valor_arriendo ?? null,
    areaTerreno: input.area_terreno ?? null,
    areaConstruida: input.area_construida ?? null,
    masAdmon: input.mas_admon,
    enHome: input.en_home,
    iva: input.iva,
    paginaWeb: input.pagina_web ?? null,
    estado: input.estado_inmueble,
    contacto: contactoDeCreacion(input),
  });

  return aInmueblePublico(fila, usuarioId);
}

export async function actualizar(
  usuario: UsuarioSolicitante,
  id: number,
  cambios: ActualizarInmuebleInput,
): Promise<InmueblePublico> {
  const fila = await repo.buscarPorId(id);
  if (!fila) {
    throw new NotFoundError('INMUEBLE_NO_ENCONTRADO', 'El inmueble no existe');
  }
  verificarPropiedad(fila, usuario);

  const idTipo =
    cambios.tipo_inmueble !== undefined ? await resolverTipo(cambios.tipo_inmueble) : undefined;
  const idDepartamento =
    cambios.departamento !== undefined
      ? await resolverDepartamento(cambios.departamento)
      : undefined;

  const idDepartamentoFinal = idDepartamento ?? fila.id_departamento;

  let idCiudad: number | null | undefined;
  if (cambios.ciudad !== undefined) {
    idCiudad =
      cambios.ciudad === null
        ? null
        : await resolverCiudad(idDepartamentoFinal, cambios.ciudad);
  } else if (fila.id_ciudad !== null && idDepartamentoFinal !== fila.id_departamento) {
    // Se cambia solo el departamento: la ciudad actual debe seguir siendo
    // valida dentro del nuevo, o se pide explicitamente una ciudad/null.
    const ciudadActual = await repo.buscarCiudadPorId(fila.id_ciudad);
    if (!ciudadActual || ciudadActual.idDepartamento !== idDepartamentoFinal) {
      throw new BadRequestError(
        'CIUDAD_INVALIDA',
        'La ciudad actual no pertenece al nuevo departamento; envia una ciudad valida o null',
      );
    }
  }

  const actualizado = await repo.actualizarInmueble(id, {
    codigoSae: cambios.codigo_sae,
    nombreInmueble: cambios.nombre_inmueble,
    idTipo,
    idDepartamento,
    idCiudad,
    direccion: cambios.direccion,
    estrato: cambios.estrato,
    valorArriendo: cambios.valor_arriendo,
    areaTerreno: cambios.area_terreno,
    areaConstruida: cambios.area_construida,
    masAdmon: cambios.mas_admon,
    enHome: cambios.en_home,
    iva: cambios.iva,
    paginaWeb: cambios.pagina_web,
    estado: cambios.estado_inmueble,
    contacto: contactoDeActualizacion(fila, cambios),
  });

  return aInmueblePublico(actualizado, usuario.id);
}

export async function eliminar(usuario: UsuarioSolicitante, id: number): Promise<void> {
  const fila = await repo.buscarPorId(id);
  if (!fila) {
    throw new NotFoundError('INMUEBLE_NO_ENCONTRADO', 'El inmueble no existe');
  }
  verificarPropiedad(fila, usuario);
  await repo.eliminarInmueble(id);
}

export async function obtener(id: number, usuarioId?: number): Promise<InmueblePublico> {
  const fila = await repo.buscarPorId(id);
  if (!fila) {
    throw new NotFoundError('INMUEBLE_NO_ENCONTRADO', 'El inmueble no existe');
  }
  return aInmueblePublico(fila, usuarioId);
}

export async function listar(
  query: ListarInmueblesQuery,
  usuarioId?: number,
): Promise<RespuestaPaginada<InmueblePublico>> {
  if (query.mias && usuarioId === undefined) {
    throw new UnauthorizedError(
      'NO_AUTENTICADO',
      'Debes iniciar sesion para ver tus inmuebles',
    );
  }

  const { filas, total } = await repo.listar(
    {
      departamento: query.departamento,
      ciudad: query.ciudad,
      tipo: query.tipo,
      estrato: query.estrato,
      valorMin: query.valor_min,
      valorMax: query.valor_max,
      areaMin: query.area_min,
      areaMax: query.area_max,
      estado: query.estado,
      q: query.q,
      miasDe: query.mias ? usuarioId : undefined,
    },
    { offset: calcularOffset(query), limit: query.limit },
    { campo: query.sort, direccion: query.order },
  );

  return {
    data: filas.map((fila) => aInmueblePublico(fila, usuarioId)),
    meta: construirMeta(query, total),
  };
}
