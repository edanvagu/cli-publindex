import { describe, it, expect } from 'vitest';
import { normalizeTitle, cleanHtml } from '../../src/utils/text';

describe('normalizeTitle', () => {
  it('devuelve cadena vacía para entradas nulas/vacías', () => {
    expect(normalizeTitle(undefined)).toBe('');
    expect(normalizeTitle(null)).toBe('');
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle('   ')).toBe('');
  });

  it('elimina diacríticos y baja a minúsculas', () => {
    expect(normalizeTitle('Árbol de café')).toBe('arbol de cafe');
    expect(normalizeTitle('¿Cómo estás?')).toBe('¿como estas?');
  });

  it('colapsa espacios en blanco y recorta bordes', () => {
    expect(normalizeTitle('  Hola   mundo  ')).toBe('hola mundo');
    expect(normalizeTitle('Hola\n\tmundo')).toBe('hola mundo');
  });

  it('es idempotente', () => {
    const input = 'Título con Acentos';
    expect(normalizeTitle(normalizeTitle(input))).toBe(normalizeTitle(input));
  });
});

describe('cleanHtml', () => {
  it('elimina tags HTML y decodifica entidades', () => {
    expect(cleanHtml('<p>Hola&nbsp;mundo</p>')).toBe('Hola mundo');
  });
});
