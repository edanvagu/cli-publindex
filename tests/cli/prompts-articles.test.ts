import { describe, it, expect } from 'vitest';
import { truncateTitle } from '../../src/cli/prompts';

describe('truncateTitle', () => {
  it('devuelve el título tal cual si es corto', () => {
    expect(truncateTitle('Título corto de prueba')).toBe('Título corto de prueba');
  });

  it('devuelve el placeholder si el título es cadena vacía', () => {
    expect(truncateTitle('')).toBe('(sin título)');
  });

  it('devuelve el placeholder si el título es undefined', () => {
    expect(truncateTitle(undefined)).toBe('(sin título)');
  });

  it('trunca títulos de más de 80 caracteres preservando longitud 80', () => {
    const long = 'a'.repeat(90);
    const out = truncateTitle(long);
    expect(out).toHaveLength(80);
    expect(out.endsWith('...')).toBe(true);
    expect(out.slice(0, 77)).toBe('a'.repeat(77));
  });

  it('no trunca un título de exactamente 80 caracteres', () => {
    const exact = 'a'.repeat(80);
    expect(truncateTitle(exact)).toBe(exact);
  });

  it('trata títulos con solo whitespace como vacíos', () => {
    expect(truncateTitle('   ')).toBe('(sin título)');
  });
});
