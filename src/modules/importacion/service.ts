import { parse } from 'csv-parse/sync';
import {
  BadRequestError,
  UnprocessableEntityError,
  type DetalleValidacion,
} from '../../shared/errors.js';
import * as repo from './repository.js';
import {
  COLUMNAS_BOOLEANAS,
  COLUMNAS_IMPORTACION,
  COLUMNAS_REQUERIDAS,
  filaImportacionSchema,
  type FilaImportacion,
  type ResultadoImportacion,
} from './schemas.js';

// La guia limita la lista de errores devuelta en el 422.
const MAXIMO_ERRORES = 100;

interface RegistroCsv {
  record: Record<string, string>;
  info: { lines: number; columns?: Array<{ name: string }> };
}

interface FilaResuelta {
  numero: number;
  datos: FilaImportacion;
  idTipo: number;
  idDepartamento: number;
  idCiudad: number | null;
}

const COLUMNAS_BOOLEANAS_SET = new Set<string>(COLUMNAS_BOOLEANAS);

// ---------------------------------------------------------------------------
// Lectura y normalizacion del CSV
// ---------------------------------------------------------------------------

function leerCsv(contenido: Buffer): RegistroCsv[] {
  let registros: unknown;
  try {
    registros = parse(contenido, {
      columns: true,
      trim: true,
      skip_empty_lines: true,
      bom: true,
      info: true,
    });
  } catch {
    throw new BadRequestError('CSV_INVALIDO', 'El archivo no es un CSV valido');
  }

  if (!Array.isArray(registros)) {
    throw new BadRequestError('CSV_INVALIDO', 'El archivo no es un CSV valido');
  }
  if (registros.length === 0) {
    throw new BadRequestError('CSV_VACIO', 'El archivo CSV no contiene filas de datos');
  }

  return registros as RegistroCsv[];
}

function verificarEncabezados(registros: RegistroCsv[]): void {
  const primera = registros[0];
  const columnas = new Set(
    primera?.info.columns?.map((columna) => columna.name) ?? [],
  );
  const faltantes = COLUMNAS_REQUERIDAS.filter((columna) => !columnas.has(columna));

  if (faltantes.length > 0) {
    throw new BadRequestError(
      'CSV_INVALIDO',
      `Faltan columnas obligatorias en el CSV: ${faltantes.join(', ')}`,
    );
  }
}

/**
 * Copia SOLO las columnas conocidas (ignora id_categoria y cualquier extra) y
 * aplica las transformaciones del CSV: celdas vacias = sin dato, booleanos
 * 'true'/'false' y alertas separadas por ';'.
 */
function normalizarRegistro(record: Record<string, string>): Record<string, unknown> {
  const datos: Record<string, unknown> = {};

  for (const columna of COLUMNAS_IMPORTACION) {
    const valor = record[columna];
    if (valor === undefined || valor === '') continue;

    if (COLUMNAS_BOOLEANAS_SET.has(columna)) {
      if (valor === 'true') datos[columna] = true;
      else if (valor === 'false') datos[columna] = false;
      else datos[columna] = valor;
      continue;
    }

    if (columna === 'alertas') {
      datos[columna] = valor
        .split(';')
        .map((alerta) => alerta.trim())
        .filter((alerta) => alerta !== '');
      continue;
    }

    datos[columna] = valor;
  }

  return datos;
}

// ---------------------------------------------------------------------------
// Caso de uso: validar TODO y luego insertar en una sola transaccion
// ---------------------------------------------------------------------------

export async function importarInmuebles(
  idUsuario: number,
  contenido: Buffer,
): Promise<ResultadoImportacion> {
  const registros = leerCsv(contenido);
  verificarEncabezados(registros);

  const errores: DetalleValidacion[] = [];
  const validas: Array<{ numero: number; datos: FilaImportacion }> = [];

  // 1) Validacion de formato con el mismo esquema del POST normal.
  for (const registro of registros) {
    const numero = registro.info.lines;
    const resultado = filaImportacionSchema.safeParse(normalizarRegistro(registro.record));

    if (!resultado.success) {
      for (const issue of resultado.error.issues) {
        errores.push({
          fila: numero,
          campo: issue.path.join('.') || 'registro',
          mensaje: issue.message,
        });
      }
      continue;
    }

    validas.push({ numero, datos: resultado.data });
  }

  // 2) Resolucion de nombres de catalogo a ids (solo filas con formato valido).
  const catalogos = validas.length > 0 ? await repo.cargarCatalogos() : undefined;
  const resueltas: FilaResuelta[] = [];

  for (const { numero, datos } of validas) {
    const idTipo = catalogos?.tipos.get(datos.tipo_inmueble);
    if (idTipo === undefined) {
      errores.push({
        fila: numero,
        campo: 'tipo_inmueble',
        mensaje: `El tipo de inmueble "${datos.tipo_inmueble}" no existe`,
      });
      continue;
    }

    const idDepartamento = catalogos?.departamentos.get(datos.departamento);
    if (idDepartamento === undefined) {
      errores.push({
        fila: numero,
        campo: 'departamento',
        mensaje: `El departamento "${datos.departamento}" no existe`,
      });
      continue;
    }

    let idCiudad: number | null = null;
    if (datos.ciudad !== undefined) {
      const encontrada = catalogos?.ciudades.get(repo.claveCiudad(idDepartamento, datos.ciudad));
      if (encontrada === undefined) {
        errores.push({
          fila: numero,
          campo: 'ciudad',
          mensaje: `La ciudad "${datos.ciudad}" no existe en el departamento "${datos.departamento}"`,
        });
        continue;
      }
      idCiudad = encontrada;
    }

    resueltas.push({ numero, datos, idTipo, idDepartamento, idCiudad });
  }

  // 3) codigo_sae repetido en el archivo o ya existente en la base.
  const candidatas: FilaResuelta[] = [];
  if (resueltas.length > 0) {
    const existentes = await repo.listarCodigosSaeExistentes(
      resueltas.map((fila) => fila.datos.codigo_sae),
    );
    const vistos = new Map<string, number>();

    for (const fila of resueltas) {
      const codigo = fila.datos.codigo_sae;

      if (existentes.has(codigo)) {
        errores.push({
          fila: fila.numero,
          campo: 'codigo_sae',
          mensaje: `El codigo_sae "${codigo}" ya existe en la base`,
        });
        continue;
      }

      const filaAnterior = vistos.get(codigo);
      if (filaAnterior !== undefined) {
        errores.push({
          fila: fila.numero,
          campo: 'codigo_sae',
          mensaje: `El codigo_sae "${codigo}" esta repetido en el archivo (fila ${filaAnterior})`,
        });
        continue;
      }

      vistos.set(codigo, fila.numero);
      candidatas.push(fila);
    }
  }

  // 4) Politica todo o nada: si hay un solo error no se inserta nada.
  if (errores.length > 0) {
    const filasInvalidas = new Set(errores.map((error) => error.fila)).size;
    throw new UnprocessableEntityError(
      'IMPORTACION_INVALIDA',
      `El archivo tiene ${filasInvalidas} fila(s) con errores; no se inserto ningun inmueble`,
      errores.slice(0, MAXIMO_ERRORES),
    );
  }

  // 5) Insercion en una sola transaccion, por lotes.
  const filasInsertar: repo.InmuebleImportado[] = candidatas.map(
    ({ datos, idTipo, idDepartamento, idCiudad }) => ({
      codigoSae: datos.codigo_sae,
      nombreInmueble: datos.nombre_inmueble ?? `${datos.tipo_inmueble} - ${datos.codigo_sae}`,
      idTipo,
      idDepartamento,
      idCiudad,
      direccion: datos.direccion,
      estrato: datos.estrato ?? null,
      valorArriendo: datos.valor_arriendo ?? null,
      areaTerreno: datos.area_terreno ?? null,
      areaConstruida: datos.area_construida ?? null,
      masAdmon: datos.mas_admon,
      enHome: datos.en_home,
      iva: datos.iva,
      estado: datos.estado_inmueble,
      fechaPublicacion: datos.fecha_publicacion ?? new Date(),
      ubicacionInferida: datos.ubicacion_inferida,
      alertas: datos.alertas,
      contacto: datos.nombre_contacto
        ? {
            nombre: datos.nombre_contacto,
            telefono: datos.telefono_contacto ?? null,
            direccion: datos.direccion_contacto ?? null,
            correo: datos.correo_contacto ?? null,
          }
        : null,
    }),
  );

  const insertados = await repo.insertarInmuebles(idUsuario, filasInsertar);

  return { insertados, omitidos: 0 };
}
