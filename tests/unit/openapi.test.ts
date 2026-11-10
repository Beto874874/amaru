import { describe, expect, it } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { buildOpenApiDocument } from '../../src/docs/openapi.js';

// Rutas minimas que el contrato debe exponer (se amplia por fase).
const RUTAS_ESPERADAS = ['/health'];

describe('documento OpenAPI', () => {
  const documento = buildOpenApiDocument();

  it('es un OpenAPI 3.1 valido (sin $ref rotos)', async () => {
    await expect(SwaggerParser.validate(structuredClone(documento))).resolves.toBeTruthy();
  });

  it('declara las rutas principales', () => {
    const rutas = Object.keys(documento.paths ?? {});
    for (const ruta of RUTAS_ESPERADAS) {
      expect(rutas).toContain(ruta);
    }
  });

  it('cada operacion tiene tags, summary y respuestas de exito y error', () => {
    for (const [ruta, item] of Object.entries(documento.paths ?? {})) {
      for (const [metodo, operacion] of Object.entries(item ?? {})) {
        if (metodo.startsWith('x-')) continue;
        expect(operacion.tags, `${metodo} ${ruta} sin tags`).toBeTruthy();
        expect(operacion.summary, `${metodo} ${ruta} sin summary`).toBeTruthy();

        const codigos = Object.keys(operacion.responses ?? {});
        const hayExito = codigos.some((codigo) => /^2\d\d$/.test(codigo));
        const hayError = codigos.some((codigo) => /^[45]\d\d$/.test(codigo));
        expect(hayExito, `${metodo} ${ruta} sin respuesta 2xx`).toBe(true);
        expect(hayError, `${metodo} ${ruta} sin respuesta de error`).toBe(true);
      }
    }
  });

  it('publica la seguridad por cookie y las respuestas reutilizables', () => {
    expect(documento.components?.securitySchemes?.cookieAuth).toBeTruthy();
    expect(documento.components?.schemas?.Error).toBeTruthy();
    expect(documento.components?.schemas?.ErrorValidacion).toBeTruthy();
  });
});
