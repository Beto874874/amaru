import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { ciudad, contacto, departamento, inmueble, tipoInmueble } from '../../db/schema/index.js';
import type { EstadoInmueble } from '../inmuebles/schemas.js';

// ---------------------------------------------------------------------------
// Catalogos: se cargan UNA vez por importacion (mapas en memoria) para no
// hacer una consulta por fila.
// ---------------------------------------------------------------------------

export interface CatalogosImportacion {
  tipos: Map<string, number>;
  departamentos: Map<string, number>;
  /** Clave: `${idDepartamento}\u0000${nombre}` (ver claveCiudad). */
  ciudades: Map<string, number>;
}

export function claveCiudad(idDepartamento: number, nombre: string): string {
  return `${idDepartamento}\u0000${nombre}`;
}

export async function cargarCatalogos(): Promise<CatalogosImportacion> {
  const [tipos, departamentos, ciudades] = await Promise.all([
    db.select({ id: tipoInmueble.id_tipo, nombre: tipoInmueble.nombre }).from(tipoInmueble),
    db
      .select({ id: departamento.id_departamento, nombre: departamento.nombre })
      .from(departamento),
    db
      .select({
        id: ciudad.id_ciudad,
        nombre: ciudad.nombre,
        idDepartamento: ciudad.id_departamento,
      })
      .from(ciudad),
  ]);

  return {
    tipos: new Map(tipos.map((fila) => [fila.nombre, fila.id])),
    departamentos: new Map(departamentos.map((fila) => [fila.nombre, fila.id])),
    ciudades: new Map(
      ciudades.map((fila) => [claveCiudad(fila.idDepartamento, fila.nombre), fila.id]),
    ),
  };
}

/** Codigos SAE del archivo que YA existen en la base (cuentan como error). */
export async function listarCodigosSaeExistentes(codigos: string[]): Promise<Set<string>> {
  if (codigos.length === 0) return new Set();

  const filas = await db
    .select({ codigo: inmueble.codigo_sae })
    .from(inmueble)
    .where(inArray(inmueble.codigo_sae, codigos));

  return new Set(filas.map((fila) => fila.codigo));
}

// ---------------------------------------------------------------------------
// Escritura: contactos + inmuebles en UNA sola transaccion, por lotes.
// ---------------------------------------------------------------------------

export interface ContactoImportado {
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
}

export interface InmuebleImportado {
  codigoSae: string;
  nombreInmueble: string;
  idTipo: number;
  idDepartamento: number;
  idCiudad: number | null;
  direccion: string;
  estrato: number | null;
  valorArriendo: number | null;
  areaTerreno: number | null;
  areaConstruida: number | null;
  masAdmon: boolean;
  enHome: boolean;
  iva: boolean;
  estado: EstadoInmueble;
  fechaPublicacion: Date;
  ubicacionInferida: boolean;
  alertas: string[];
  contacto: ContactoImportado | null;
}

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

const TAMANO_LOTE = 200;

/**
 * Misma primitiva de la Fase 4 (buscar o crear contacto con NULL = NULL).
 * Se duplica aqui para mantener los modulos independientes: la capa de
 * importacion no llama al repositorio de inmuebles.
 */
async function buscarOCrearContacto(tx: Transaccion, datos: ContactoImportado): Promise<number> {
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
    datos.direccion === null
      ? isNull(contacto.direccion)
      : eq(contacto.direccion, datos.direccion),
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

function claveContacto(datos: ContactoImportado): string {
  return JSON.stringify([datos.nombre, datos.telefono, datos.direccion, datos.correo]);
}

/**
 * Inserta TODAS las filas en una transaccion. Los contactos repetidos dentro
 * del archivo se crean una sola vez. Devuelve la cantidad insertada.
 */
export async function insertarInmuebles(
  idUsuario: number,
  filas: InmuebleImportado[],
): Promise<number> {
  return db.transaction(async (tx) => {
    const idsContacto = new Map<string, number>();

    for (const fila of filas) {
      if (!fila.contacto) continue;
      const clave = claveContacto(fila.contacto);
      if (idsContacto.has(clave)) continue;
      idsContacto.set(clave, await buscarOCrearContacto(tx, fila.contacto));
    }

    const valores = filas.map((fila) => ({
      codigo_sae: fila.codigoSae,
      nombre_inmueble: fila.nombreInmueble,
      id_tipo: fila.idTipo,
      id_departamento: fila.idDepartamento,
      id_ciudad: fila.idCiudad,
      id_contacto: fila.contacto
        ? (idsContacto.get(claveContacto(fila.contacto)) ?? null)
        : null,
      id_usuario: idUsuario,
      direccion: fila.direccion,
      estrato: fila.estrato,
      valor_arriendo: fila.valorArriendo,
      area_terreno: fila.areaTerreno,
      area_construida: fila.areaConstruida,
      mas_admon: fila.masAdmon,
      en_home: fila.enHome,
      iva: fila.iva,
      estado: fila.estado,
      fecha_publicacion: fila.fechaPublicacion,
      ubicacion_inferida: fila.ubicacionInferida,
      alertas: fila.alertas,
    }));

    for (let inicio = 0; inicio < valores.length; inicio += TAMANO_LOTE) {
      await tx.insert(inmueble).values(valores.slice(inicio, inicio + TAMANO_LOTE));
    }

    return filas.length;
  });
}
