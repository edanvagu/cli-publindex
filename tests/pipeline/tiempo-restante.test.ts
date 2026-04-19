import { describe, it, expect } from 'vitest';
import { estimarTiempoRestanteSegundos } from '../../src/pipeline/runner';

describe('estimarTiempoRestanteSegundos', () => {
  it('retorna 0 cuando ya se procesaron todos los artículos', () => {
    expect(estimarTiempoRestanteSegundos(10, 10, 50000)).toBe(0);
  });

  it('retorna 0 cuando no quedan artículos pendientes', () => {
    expect(estimarTiempoRestanteSegundos(5, 5, 20000)).toBe(0);
  });

  it('estima basado en el promedio observado hasta el momento', () => {
    // 1 artículo tomó 10 segundos, quedan 9 → 9 * 10 = 90 segundos
    expect(estimarTiempoRestanteSegundos(1, 10, 10000)).toBe(90);
  });

  it('promedia cuando ya hay varios artículos procesados', () => {
    // 3 artículos en 30 segundos → 10 seg/articulo, quedan 7 → 70 segundos
    expect(estimarTiempoRestanteSegundos(3, 10, 30000)).toBe(70);
  });

  it('redondea el resultado a entero', () => {
    // 2 artículos en 17 segundos → 8.5 seg/articulo, quedan 3 → 25.5 → 26
    expect(estimarTiempoRestanteSegundos(2, 5, 17000)).toBe(26);
  });

  it('retorna un valor predeterminado si procesados es 0', () => {
    // No hay base para promediar; usar estimado estático: 10 articulos * 8.5 = 85
    expect(estimarTiempoRestanteSegundos(0, 10, 0)).toBe(85);
  });
});
