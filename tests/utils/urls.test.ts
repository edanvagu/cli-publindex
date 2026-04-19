import { describe, it, expect } from 'vitest';
import { construirUrlArticulo, normalizarBaseUrl } from '../../src/utils/urls';

describe('construirUrlArticulo', () => {
  it('concatena base + /article/view/ + id', () => {
    expect(construirUrlArticulo('https://revistas.example.com/index.php/fhistoria', '2953'))
      .toBe('https://revistas.example.com/index.php/fhistoria/article/view/2953');
  });

  it('tolera base con slash final', () => {
    expect(construirUrlArticulo('https://x.com/j/', '42'))
      .toBe('https://x.com/j/article/view/42');
  });

  it('tolera múltiples slashes al final de la base', () => {
    expect(construirUrlArticulo('https://x.com/j///', '42'))
      .toBe('https://x.com/j/article/view/42');
  });
});

describe('normalizarBaseUrl', () => {
  it('agrega https:// si no hay esquema', () => {
    expect(normalizarBaseUrl('revistas.example.com/j')).toBe('https://revistas.example.com/j');
  });

  it('preserva http:// si ya lo tiene', () => {
    expect(normalizarBaseUrl('http://x.com/j')).toBe('http://x.com/j');
  });

  it('quita slashes finales', () => {
    expect(normalizarBaseUrl('https://x.com/j///')).toBe('https://x.com/j');
  });

  it('quita espacios', () => {
    expect(normalizarBaseUrl('  https://x.com/j  ')).toBe('https://x.com/j');
  });
});
