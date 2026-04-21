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
    expect(estimateRemainingTimeSeconds(1, 10, 10000)).toBe(90);
  });

  it('promedia cuando ya hay varios artículos processed', () => {
    expect(estimateRemainingTimeSeconds(3, 10, 30000)).toBe(70);
  });

  it('redondea el result a entero', () => {
    expect(estimateRemainingTimeSeconds(2, 5, 17000)).toBe(26);
  });

  it('retorna un valor predeterminado si processed es 0', () => {
    expect(estimateRemainingTimeSeconds(0, 10, 0)).toBe(150);
  });
});
