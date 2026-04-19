import { describe, it, expect } from 'vitest';
import { estimateRemainingTimeSeconds } from '../../../src/entities/articles/uploader';

describe('estimateRemainingTimeSeconds', () => {
  it('retorna 0 cuando ya se procesaron todos los artículos', () => {
    expect(estimateRemainingTimeSeconds(10, 10, 50000)).toBe(0);
  });

  it('retorna 0 cuando no quedan artículos pendientes', () => {
    expect(estimateRemainingTimeSeconds(5, 5, 20000)).toBe(0);
  });

  it('estima basado en el promedio observado hasta el momento', () => {
    // 1 artículo tomó 10 segundos, quedan 9 → 9 * 10 = 90 segundos
    expect(estimateRemainingTimeSeconds(1, 10, 10000)).toBe(90);
  });

  it('promedia cuando ya hay varios artículos processed', () => {
    // 3 artículos en 30 segundos → 10 seg/article, quedan 7 → 70 segundos
    expect(estimateRemainingTimeSeconds(3, 10, 30000)).toBe(70);
  });

  it('redondea el result a entero', () => {
    // 2 artículos en 17 segundos → 8.5 seg/article, quedan 3 → 25.5 → 26
    expect(estimateRemainingTimeSeconds(2, 5, 17000)).toBe(26);
  });

  it('retorna un valor predeterminado si processed es 0', () => {
    // No hay base para promediar; usar estimado estático: 10 articles * 8.5 = 85
    expect(estimateRemainingTimeSeconds(0, 10, 0)).toBe(85);
  });
});
