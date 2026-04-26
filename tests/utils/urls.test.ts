import { describe, it, expect } from 'vitest';
import { buildArticleUrl, normalizeBaseUrl } from '../../src/utils/urls';

describe('buildArticleUrl', () => {
  it('concatena base + /article/view/ + id', () => {
    expect(buildArticleUrl('https://revistas.example.com/index.php/fhistoria', '2953')).toBe(
      'https://revistas.example.com/index.php/fhistoria/article/view/2953',
    );
  });

  it('tolera base con slash final', () => {
    expect(buildArticleUrl('https://x.com/j/', '42')).toBe('https://x.com/j/article/view/42');
  });

  it('tolera múltiples slashes al final de la base', () => {
    expect(buildArticleUrl('https://x.com/j///', '42')).toBe('https://x.com/j/article/view/42');
  });
});

describe('normalizeBaseUrl', () => {
  it('agrega https:// si no hay esquema', () => {
    expect(normalizeBaseUrl('revistas.example.com/j')).toBe('https://revistas.example.com/j');
  });

  it('preserva http:// si ya lo tiene', () => {
    expect(normalizeBaseUrl('http://x.com/j')).toBe('http://x.com/j');
  });

  it('quita slashes finales', () => {
    expect(normalizeBaseUrl('https://x.com/j///')).toBe('https://x.com/j');
  });

  it('quita espacios', () => {
    expect(normalizeBaseUrl('  https://x.com/j  ')).toBe('https://x.com/j');
  });
});
