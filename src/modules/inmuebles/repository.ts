import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, type SQL } from 'drizzle-orm';
import { db } from '../../config/db.js';
import {
  ciudad,
  contacto,
  departamento,
  inmueble,
  inmuebleImagen,
  tipoInmueble,
} from '../../db/schema/index.js';
import { escaparLike } from '../../shared/sql.js';
import type { EstadoInmueble } from './schemas.js';

// ---------------------------------------------------------------------------
// Consulta base con TODOS los joins (evita N+1). La ciudad se une con la FK
// compuesta completa para que no pueda venir de otro departamento.
// ---------------------------------------------------------------------------

const seleccion = {
  id_inmueble: inmueble.id_inmueble,
  codigo_sae: inmueble.codigo_sae,
  nombre_inmueble: inmueble.nombre_inmueble,
  direccion: inmueble.direccion,
  estrato: inmueble.estrato,
  valor_arriendo: inmueble.valor_arriendo,
  area_terreno: inmueble.area_terreno,
  area_construida: inmueble.area_construida,
  mas_admon: inmueble.mas_admon,
  en_home: inmueble.en_home,
  iva: inmueble.iva,
  pagina_web: inmueble.pagina_web,
  estado: inmueble.estado,
  ubicacion_inferida: inmueble.ubicacion_inferida,
  alertas: inmueble.alertas,
  fecha_publicacion: inmueble.fecha_publicacion,
  id_departamento: inmueble.id_departamento,
  id_ciudad: inmueble.id_ciudad,
  id_tipo: inmueble.id_tipo,
  id_usuario: inmueble.id_usuario,
  tipo: tipoInmueble.nombre,
  departamento: departamento.nombre,
  ciudad: ciudad.nombre,
  contacto_nombre: contacto.nombre,
  contacto_telefono: contacto.telefono,
  contacto_direccion: contacto.direccion,
  contacto_correo: contacto.correo,
  // La foto principal entra en la MISMA consulta (LEFT JOIN a la fila
  // es_principal). El indice unico parcial garantiza que haya como maximo una,
  // asi que el listado no necesita una consulta por inmueble (N+1).
  imagen_principal_ruta: inmuebleImagen.ruta,
  imagen_principal_ruta_miniatura: inmuebleImagen.ruta_miniatura,
} as const;

function consultaBase() {
  return db
    .select(seleccion)
    .from(inmueble)
    .innerJoin(tipoInmueble, eq(inmueble.id_tipo, tipoInmueble.id_tipo))
    .innerJoin(departamento, eq(inmueble.id_departamento, departamento.id_departamento))
    .leftJoin(
      ciudad,
      and(
        eq(inmueble.id_ciudad, ciudad.id_ciudad),
        eq(inmueble.id_departamento, ciudad.id_departamento),
      ),
    )
    .leftJoin(contacto, eq(inmueble.id_contacto, contacto.id_contacto))
    .leftJoin(
      inmuebleImagen,
      and(
        eq(inmueble.id_inmueble, inmuebleImagen.id_inmueble),
        eq(inmuebleImagen.es_principal, true),
      ),
    );
}

export type InmuebleConRelaciones = Awaited<ReturnType<typeof consultaBase>>[number];

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export interface FiltrosLista {
  departamento?: number;
  ciudad?: number;
  tipo?: number;
  estrato?: number;
  valorMin?: number;
  valorMax?: number;
  areaMin?: number;
  areaMax?: number;
  estado: EstadoInmueble;
  q?: string;
  miasDe?: number;
}

export interface OrdenLista {
  campo: 'valor_arriendo' | 'fecha_publicacion' | 'area_construida';
  direccion: 'asc' | 'desc';
}

export interface PaginacionDb {
  offset: number;
  limit: number;
}

function construirCondiciones(filtros: FiltrosLista): SQL[] {
  const condiciones: SQL[] = [eq(inmueble.estado, filtros.estado)];

  if (filtros.departamento !== undefined) {
    condiciones.push(eq(inmueble.id_departamento, filtros.departamento));
  }
  if (filtros.ciudad !== undefined) {
    condiciones.push(eq(inmueble.id_ciudad, filtros.ciudad));
  }
  if (filtros.tipo !== undefined) {
    condiciones.push(eq(inmueble.id_tipo, filtros.tipo));
  }
  if (filtros.estrato !== undefined) {
    condiciones.push(eq(inmueble.estrato, filtros.estrato));
  }
  if (filtros.valorMin !== undefined) {
    condiciones.push(gte(inmueble.valor_arriendo, filtros.valorMin));
  }
  if (filtros.valorMax !== undefined) {
    condiciones.push(lte(inmueble.valor_arriendo, filtros.valorMax));
  }
  if (filtros.areaMin !== undefined) {
    condiciones.push(gte(inmueble.area_construida, filtros.areaMin));
  }
  if (filtros.areaMax !== undefined) {
    condiciones.push(lte(inmueble.area_construida, filtros.areaMax));
  }
  if (filtros.miasDe !== undefined) {
    condiciones.push(eq(inmueble.id_usuario, filtros.miasDe));
  }
  if (filtros.q) {
    const patron = `%${escaparLike(filtros.q)}%`;
    const busqueda = or(
      ilike(inmueble.nombre_inmueble, patron),
      ilike(inmueble.direccion, patron),
    );
    if (busqueda) condiciones.push(busqueda);
  }

  return condiciones;
}

export async function listar(
  filtros: FiltrosLista,
  paginacion: PaginacionDb,
  orden: OrdenLista,
): Promise<{ filas: InmuebleConRelaciones[]; total: number }> {
  const where = and(...construirCondiciones(filtros));

  const totalFilas = await db.select({ total: count() }).from(inmueble).where(where);
  const total = totalFilas[0]?.total ?? 0;

  const columnas = {
    valor_arriendo: inmueble.valor_arriendo,
    fecha_publicacion: inmueble.fecha_publicacion,
    area_construida: inmueble.area_construida,
  } as const;
  const direccion = orden.direccion === 'asc' ? asc : desc;
  const columna = columnas[orden.campo];

  const filas = await consultaBase()
    .where(where)
    .orderBy(direccion(columna), direccion(inmueble.id_inmueble))
    .limit(paginacion.limit)
    .offset(paginacion.offset);

  return { filas, total };
}

export async function buscarPorId(id: number): Promise<InmuebleConRelaciones | undefined> {
  const filas = await consultaBase().where(eq(inmueble.id_inmueble, id)).limit(1);
  return filas[0];
}

export interface ImagenDeInmueble {
  id_imagen: number;
  ruta: string;
  ruta_miniatura: string;
  ancho: number;
  alto: number;
  orden: number;
  es_principal: boolean;
}

/**
 * Fotos del detalle, ya ordenadas. Es una SEGUNDA consulta solo para
 * GET /inmuebles/:id; el listado nunca las trae.
 */
export async function listarImagenesPorInmueble(
  idInmueble: number,
): Promise<ImagenDeInmueble[]> {
  return db
    .select({
      id_imagen: inmuebleImagen.id_imagen,
      ruta: inmuebleImagen.ruta,
      ruta_miniatura: inmuebleImagen.ruta_miniatura,
      ancho: inmuebleImagen.ancho,
      alto: inmuebleImagen.alto,
      orden: inmuebleImagen.orden,
      es_principal: inmuebleImagen.es_principal,
    })
    .from(inmuebleImagen)
    .where(eq(inmuebleImagen.id_inmueble, idInmueble))
    .orderBy(asc(inmuebleImagen.orden), asc(inmuebleImagen.id_imagen));
}

// ---------------------------------------------------------------------------
// Catalogos: se resuelven por nombre exacto (tras trim). No se crean aqui.
// ---------------------------------------------------------------------------

export async function buscarTipoPorNombre(
  nombre: string,
): Promise<{ id: number; nombre: string } | undefined> {
  const filas = await db
    .select({ id: tipoInmueble.id_tipo, nombre: tipoInmueble.nombre })
    .from(tipoInmueble)
    .where(eq(tipoInmueble.nombre, nombre))
    .limit(1);
  return filas[0];
}

export async function buscarDepartamentoPorNombre(
  nombre: string,
): Promise<{ id: number; nombre: string } | undefined> {
  const filas = await db
    .select({ id: departamento.id_departamento, nombre: departamento.nombre })
    .from(departamento)
    .where(eq(departamento.nombre, nombre))
    .limit(1);
  return filas[0];
}

export async function buscarCiudadPorNombre(
  idDepartamento: number,
  nombre: string,
): Promise<{ id: number; nombre: string; idDepartamento: number } | undefined> {
  const filas = await db
    .select({
      id: ciudad.id_ciudad,
      nombre: ciudad.nombre,
      idDepartamento: ciudad.id_departamento,
    })
    .from(ciudad)
    .where(and(eq(ciudad.id_departamento, idDepartamento), eq(ciudad.nombre, nombre)))
    .limit(1);
  return filas[0];
}

export async function buscarCiudadPorId(
  idCiudad: number,
): Promise<{ id: number; nombre: string; idDepartamento: number } | undefined> {
  const filas = await db
    .select({
      id: ciudad.id_ciudad,
      nombre: ciudad.nombre,
      idDepartamento: ciudad.id_departamento,
    })
    .from(ciudad)
    .where(eq(ciudad.id_ciudad, idCiudad))
    .limit(1);
  return filas[0];
}

export async function listarNombresTipos(): Promise<string[]> {
  const filas = await db
    .select({ nombre: tipoInmueble.nombre })
    .from(tipoInmueble)
    .orderBy(asc(tipoInmueble.nombre));
  return filas.map((fila) => fila.nombre);
}

export async function listarNombresDepartamentos(): Promise<string[]> {
  const filas = await db
    .select({ nombre: departamento.nombre })
    .from(departamento)
    .orderBy(asc(departamento.nombre));
  return filas.map((fila) => fila.nombre);
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

export interface DatosContacto {
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
}

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Busca o crea un contacto por los 4 campos (NULL = NULL, igual que el UNIQUE
 * NULLS NOT DISTINCT). ON CONFLICT DO NOTHING + SELECT evita la carrera entre
 * dos peticiones simultaneas sin necesidad de adivinar el id.
 */
async function buscarOCrearContacto(tx: Transaccion, datos: DatosContacto): Promise<number> {
  const insertados = await tx
    .insert(contacto)
    .values(datos)
    .onConflictDoNothing({
      target: [contacto.nombre, contacto.telefono, contacto.direccion, contacto.correo],
    })
    .returning({ id: contacto.id_contacto });

  const insertado = insertados[0];
  if (insertado) return insertado.id;

  const condiciones = [
    eq(contacto.nombre, datos.nombre),
    datos.telefono === null ? isNull(contacto.telefono) : eq(contacto.telefono, datos.telefono),
    datos.direccion === null ? isNull(contacto.direccion) : eq(contacto.direccion, datos.direccion),
    datos.correo === null ? isNull(contacto.correo) : eq(contacto.correo, datos.correo),
  ];

  const filas = await tx
    .select({ id: contacto.id_contacto })
    .from(contacto)
    .where(and(...condiciones))
    .limit(1);

  const fila = filas[0];
  if (!fila) {
    throw new Error('No se pudo resolver el contacto despues del conflicto');
  }
  return fila.id;
}

export interface NuevoInmueble {
  codigoSae: string;
  nombreInmueble: string;
  idTipo: number;
  idDepartamento: number;
  idCiudad: number | null;
  idUsuario: number;
  direccion: string;
  estrato: number | null;
  valorArriendo: number | null;
  areaTerreno: number | null;
  areaConstruida: number | null;
  masAdmon: boolean;
  enHome: boolean;
  iva: boolean;
  paginaWeb: string | null;
  estado: EstadoInmueble;
  contacto: DatosContacto | null;
}

export async function crearInmueble(datos: NuevoInmueble): Promise<InmuebleConRelaciones> {
  // Contacto + inmueble en UNA transaccion: si falla el insert del inmueble no
  // queda un contacto huerfano creado solo por esta peticion.
  const id = await db.transaction(async (tx) => {
    let idContacto: number | null = null;
    if (datos.contacto) {
      idContacto = await buscarOCrearContacto(tx, datos.contacto);
    }

    const insertados = await tx
      .insert(inmueble)
      .values({
        codigo_sae: datos.codigoSae,
        nombre_inmueble: datos.nombreInmueble,
        id_tipo: datos.idTipo,
        id_departamento: datos.idDepartamento,
        id_ciudad: datos.idCiudad,
        id_contacto: idContacto,
        id_usuario: datos.idUsuario,
        direccion: datos.direccion,
        estrato: datos.estrato,
        valor_arriendo: datos.valorArriendo,
        area_terreno: datos.areaTerreno,
        area_construida: datos.areaConstruida,
        mas_admon: datos.masAdmon,
        en_home: datos.enHome,
        iva: datos.iva,
        pagina_web: datos.paginaWeb,
        estado: datos.estado,
      })
      .returning({ id: inmueble.id_inmueble });

    const fila = insertados[0];
    if (!fila) throw new Error('No se pudo crear el inmueble');
    return fila.id;
  });

  const creado = await buscarPorId(id);
  if (!creado) throw new Error('No se pudo leer el inmueble recien creado');
  return creado;
}

export interface CambiosInmueble {
  codigoSae?: string;
  nombreInmueble?: string;
  idTipo?: number;
  idDepartamento?: number;
  idCiudad?: number | null;
  direccion?: string;
  estrato?: number | null;
  valorArriendo?: number | null;
  areaTerreno?: number | null;
  areaConstruida?: number | null;
  masAdmon?: boolean;
  enHome?: boolean;
  iva?: boolean;
  paginaWeb?: string | null;
  estado?: EstadoInmueble;
  /** undefined = no tocar; null = quitar contacto; objeto = buscar o crear. */
  contacto?: DatosContacto | null;
}

export async function actualizarInmueble(
  idInmueble: number,
  cambios: CambiosInmueble,
): Promise<InmuebleConRelaciones> {
  await db.transaction(async (tx) => {
    // `valores` solo contiene las claves realmente presentes en el PATCH: un
    // campo ausente no se toca. El tipo parcial de la tabla mantiene el update
    // tipado (sin `any` ni spreads de objetos desconocidos).
    const valores: Partial<typeof inmueble.$inferInsert> = {};
    if (cambios.codigoSae !== undefined) valores.codigo_sae = cambios.codigoSae;
    if (cambios.nombreInmueble !== undefined) valores.nombre_inmueble = cambios.nombreInmueble;
    if (cambios.idTipo !== undefined) valores.id_tipo = cambios.idTipo;
    if (cambios.idDepartamento !== undefined) valores.id_departamento = cambios.idDepartamento;
    if (cambios.idCiudad !== undefined) valores.id_ciudad = cambios.idCiudad;
    if (cambios.direccion !== undefined) valores.direccion = cambios.direccion;
    if (cambios.estrato !== undefined) valores.estrato = cambios.estrato;
    if (cambios.valorArriendo !== undefined) valores.valor_arriendo = cambios.valorArriendo;
    if (cambios.areaTerreno !== undefined) valores.area_terreno = cambios.areaTerreno;
    if (cambios.areaConstruida !== undefined) valores.area_construida = cambios.areaConstruida;
    if (cambios.masAdmon !== undefined) valores.mas_admon = cambios.masAdmon;
    if (cambios.enHome !== undefined) valores.en_home = cambios.enHome;
    if (cambios.iva !== undefined) valores.iva = cambios.iva;
    if (cambios.paginaWeb !== undefined) valores.pagina_web = cambios.paginaWeb;
    if (cambios.estado !== undefined) valores.estado = cambios.estado;

    if (cambios.contacto !== undefined) {
      valores.id_contacto = cambios.contacto
        ? await buscarOCrearContacto(tx, cambios.contacto)
        : null;
    }

    if (Object.keys(valores).length > 0) {
      await tx.update(inmueble).set(valores).where(eq(inmueble.id_inmueble, idInmueble));
    }
  });

  const actualizado = await buscarPorId(idInmueble);
  if (!actualizado) throw new Error('No se pudo leer el inmueble actualizado');
  return actualizado;
}

export async function eliminarInmueble(idInmueble: number): Promise<boolean> {
  const filas = await db
    .delete(inmueble)
    .where(eq(inmueble.id_inmueble, idInmueble))
    .returning({ id: inmueble.id_inmueble });
  return filas.length > 0;
}
