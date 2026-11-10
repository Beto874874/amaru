/**
 * Escapa los comodines de LIKE (`%` y `_`) y la barra invertida para que el
 * texto que escribe el usuario se busque de forma literal. El valor sigue
 * viajando como parametro (Drizzle nunca concatena SQL).
 */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}
