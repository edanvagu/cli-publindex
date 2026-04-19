import { describe, it, expect } from 'vitest';
import { validateBatch } from '../../../src/entities/articles/validator';
import { ArticleRow } from '../../../src/entities/articles/types';

// === Helper para construir un artículo válido base ===
function articuloValido(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    titulo: 'Título válido con más de diez caracteres',
    url: 'https://example.com/article',
    gran_area: 'Humanidades',
    area: 'Historia y Arqueología',
    tipo_documento: 'Artículo de investigación científica y tecnológica',
    palabras_clave: 'historia; cultura',
    titulo_ingles: 'Valid title with more than ten characters',
    resumen: 'Resumen válido con más de diez caracteres',
    _fila: 2,
    ...overrides,
  };
}

describe('validateBatch - casos válidos', () => {
  it('acepta un artículo con todos los campos obligatorios válidos', () => {
    const result = validateBatch([articuloValido()], []);
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('acepta múltiples artículos válidos', () => {
    const articles = [
      articuloValido({ _fila: 2 }),
      articuloValido({ _fila: 3, titulo: 'Otro título bastante largo' }),
    ];
    const result = validateBatch(articles, []);
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(2);
  });
});

describe('validateBatch - campos obligatorios', () => {
  it('rechaza título faltante', () => {
    const result = validateBatch([articuloValido({ titulo: '' })], []);
    expect(result.errors.some(e => e.field === 'titulo')).toBe(true);
    expect(result.valid).toHaveLength(0);
  });

  it('rechaza título demasiado corto (<10 chars)', () => {
    const result = validateBatch([articuloValido({ titulo: 'Corto' })], []);
    const err = result.errors.find(e => e.field === 'titulo');
    expect(err).toBeDefined();
    expect(err?.message).toContain('mínimo 10');
  });

  it('rechaza URL sin http/https', () => {
    const result = validateBatch([articuloValido({ url: 'ftp://example.com' })], []);
    const err = result.errors.find(e => e.field === 'url');
    expect(err).toBeDefined();
    expect(err?.message).toContain('http');
  });

  it('rechaza gran_area inexistente', () => {
    const result = validateBatch([articuloValido({ gran_area: 'XX-invalido' })], []);
    expect(result.errors.some(e => e.field === 'gran_area')).toBe(true);
  });

  it('rechaza tipo_documento fuera de rango', () => {
    const result = validateBatch([articuloValido({ tipo_documento: 'XX-invalido' })], []);
    expect(result.errors.some(e => e.field === 'tipo_documento')).toBe(true);
  });

  it('rechaza resumen demasiado corto', () => {
    const result = validateBatch([articuloValido({ resumen: 'Corto' })], []);
    expect(result.errors.some(e => e.field === 'resumen')).toBe(true);
  });

  it('rechaza titulo_ingles demasiado corto', () => {
    const result = validateBatch([articuloValido({ titulo_ingles: 'Short' })], []);
    expect(result.errors.some(e => e.field === 'titulo_ingles')).toBe(true);
  });

  it('rechaza palabras_clave vacías', () => {
    const result = validateBatch([articuloValido({ palabras_clave: '' })], []);
    expect(result.errors.some(e => e.field === 'palabras_clave')).toBe(true);
  });
});

describe('validateBatch - concordancia entre campos', () => {
  it('rechaza cuando area no pertenece a gran_area', () => {
    const result = validateBatch([articuloValido({ gran_area: 'Humanidades', area: 'Matemática' })], []);
    const err = result.errors.find(e => e.field === 'area');
    expect(err).toBeDefined();
    expect(err?.message).toContain('no pertenece a');
  });

  it('acepta cuando area pertenece a gran_area', () => {
    const result = validateBatch([articuloValido({ gran_area: 'Humanidades', area: 'Historia y Arqueología' })], []);
    expect(result.errors.filter(e => e.field === 'area')).toEqual([]);
  });

  it('rechaza cuando subarea no pertenece a area', () => {
    const result = validateBatch([articuloValido({ gran_area: 'Humanidades', area: 'Historia y Arqueología', subarea: 'Biología Celular y Microbiología' })], []);
    expect(result.errors.some(e => e.field === 'subarea')).toBe(true);
  });

  it('acepta subarea correcta', () => {
    const result = validateBatch([articuloValido({ gran_area: 'Humanidades', area: 'Historia y Arqueología', subarea: 'Historia' })], []);
    expect(result.errors.filter(e => e.field === 'subarea')).toEqual([]);
  });

  it('rechaza fecha_aceptacion anterior a fecha_recepcion', () => {
    const result = validateBatch(
      [articuloValido({ fecha_recepcion: '2026-03-01', fecha_aceptacion: '2026-01-15' })],
      []
    );
    const err = result.errors.find(e => e.field === 'fecha_aceptacion');
    expect(err).toBeDefined();
  });

  it('acepta fecha_aceptacion posterior a fecha_recepcion', () => {
    const result = validateBatch(
      [articuloValido({ fecha_recepcion: '2026-01-15', fecha_aceptacion: '2026-03-01' })],
      []
    );
    expect(result.errors.filter(e => e.field === 'fecha_aceptacion')).toEqual([]);
  });

  it('rechaza pagina_final <= pagina_inicial', () => {
    const result = validateBatch(
      [articuloValido({ pagina_inicial: '10', pagina_final: '5' })],
      []
    );
    const err = result.errors.find(e => e.field === 'pagina_final');
    expect(err).toBeDefined();
  });

  it('acepta pagina_final > pagina_inicial', () => {
    const result = validateBatch(
      [articuloValido({ pagina_inicial: '1', pagina_final: '15' })],
      []
    );
    expect(result.errors.filter(e => e.field === 'pagina_final')).toEqual([]);
  });

  it('rechaza idioma igual a otro_idioma', () => {
    const result = validateBatch(
      [articuloValido({ idioma: 'Español', otro_idioma: 'Español' })],
      []
    );
    expect(result.errors.some(e => e.field === 'otro_idioma')).toBe(true);
  });

  it('acepta idiomas diferentes', () => {
    const result = validateBatch(
      [articuloValido({ idioma: 'Español', otro_idioma: 'Inglés' })],
      []
    );
    expect(result.errors.filter(e => e.field === 'otro_idioma')).toEqual([]);
  });
});

describe('validateBatch - enums y formatos', () => {
  it('rechaza tipo_resumen inválido', () => {
    const result = validateBatch([articuloValido({ tipo_resumen: 'X' })], []);
    expect(result.errors.some(e => e.field === 'tipo_resumen')).toBe(true);
  });

  it('acepta tipo_resumen válido (A, D, S)', () => {
    for (const valor of ['Analítico', 'Descriptivo', 'Analítico sintético']) {
      const result = validateBatch([articuloValido({ tipo_resumen: valor, _fila: 2 })], []);
      expect(result.errors.filter(e => e.field === 'tipo_resumen')).toEqual([]);
    }
  });

  it('rechaza tipo_especialista inválido', () => {
    const result = validateBatch([articuloValido({ tipo_especialista: 'ZZ-invalido' })], []);
    expect(result.errors.some(e => e.field === 'tipo_especialista')).toBe(true);
  });

  it('rechaza eval_interna con valor distinto a T/F', () => {
    const result = validateBatch([articuloValido({ eval_interna: 'YES' })], []);
    expect(result.errors.some(e => e.field === 'eval_interna')).toBe(true);
  });

  it('acepta eval_interna con T o F', () => {
    expect(validateBatch([articuloValido({ eval_interna: 'T' })], []).errors.filter(e => e.field === 'eval_interna')).toEqual([]);
    expect(validateBatch([articuloValido({ eval_interna: 'F' })], []).errors.filter(e => e.field === 'eval_interna')).toEqual([]);
  });

  it('rechaza idioma no soportado', () => {
    const result = validateBatch([articuloValido({ idioma: 'ZZ-invalido' })], []);
    expect(result.errors.some(e => e.field === 'idioma')).toBe(true);
  });

  it('rechaza DOI demasiado corto', () => {
    const result = validateBatch([articuloValido({ doi: 'short' })], []);
    expect(result.errors.some(e => e.field === 'doi')).toBe(true);
  });

  it('acepta DOI válido', () => {
    const result = validateBatch([articuloValido({ doi: '10.1234/abcd' })], []);
    expect(result.errors.filter(e => e.field === 'doi')).toEqual([]);
  });

  it('rechaza DOI en formato URL con https://doi.org/', () => {
    const result = validateBatch([articuloValido({ doi: 'https://doi.org/10.1234/abcd' })], []);
    const err = result.errors.find(e => e.field === 'doi');
    expect(err).toBeDefined();
    expect(err?.message).toContain('10.');
  });

  it('rechaza DOI que empieza con http://', () => {
    const result = validateBatch([articuloValido({ doi: 'http://dx.doi.org/10.1234/abcd' })], []);
    expect(result.errors.some(e => e.field === 'doi')).toBe(true);
  });

  it('rechaza DOI que no empieza con "10."', () => {
    const result = validateBatch([articuloValido({ doi: 'abc/1234567890' })], []);
    expect(result.errors.some(e => e.field === 'doi')).toBe(true);
  });

  it('rechaza fecha con formato inválido', () => {
    const result = validateBatch([articuloValido({ fecha_recepcion: 'hoy' })], []);
    expect(result.errors.some(e => e.field === 'fecha_recepcion')).toBe(true);
  });

  it('acepta fecha YYYY-MM-DD', () => {
    const result = validateBatch([articuloValido({ fecha_recepcion: '2026-04-15' })], []);
    expect(result.errors.filter(e => e.field === 'fecha_recepcion')).toEqual([]);
  });

  it('acepta fecha DD/MM/YYYY', () => {
    const result = validateBatch([articuloValido({ fecha_recepcion: '15/04/2026' })], []);
    expect(result.errors.filter(e => e.field === 'fecha_recepcion')).toEqual([]);
  });
});

describe('validateBatch - numéricos', () => {
  it('rechaza numero_autores no numérico', () => {
    const result = validateBatch([articuloValido({ numero_autores: 'tres' })], []);
    expect(result.errors.some(e => e.field === 'numero_autores')).toBe(true);
  });

  it('acepta numero_autores numérico', () => {
    const result = validateBatch([articuloValido({ numero_autores: '3' })], []);
    expect(result.errors.filter(e => e.field === 'numero_autores')).toEqual([]);
  });

  it('rechaza numero_referencias negativo', () => {
    const result = validateBatch([articuloValido({ numero_referencias: '-5' })], []);
    expect(result.errors.some(e => e.field === 'numero_referencias')).toBe(true);
  });
});

describe('validateBatch - integridad del lote', () => {
  it('rechaza lote vacío', () => {
    const result = validateBatch([], []);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.valid).toEqual([]);
  });

  it('detecta duplicados por título como warning', () => {
    const articles = [
      articuloValido({ _fila: 2, titulo: 'Título repetido con diez o más caracteres' }),
      articuloValido({ _fila: 5, titulo: 'Título repetido con diez o más caracteres' }),
    ];
    const result = validateBatch(articles, []);
    expect(result.warnings.some(a => a.message.toLowerCase().includes('duplicado'))).toBe(true);
  });

  it('detecta headers desconocidos como warning', () => {
    const result = validateBatch([articuloValido()], ['abstrac', 'xyz']);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('sugiere header similar en caso de typo', () => {
    const result = validateBatch([articuloValido()], ['titolo']);
    const adv = result.warnings.find(a => a.message.includes('titolo'));
    expect(adv).toBeDefined();
    expect(adv?.message).toContain('quiso decir');
    expect(adv?.message).toContain('titulo');
  });

  it('separa correctamente válidos de inválidos', () => {
    const articles = [
      articuloValido({ _fila: 2 }),
      articuloValido({ _fila: 3, titulo: 'corto' }), // inválido
      articuloValido({ _fila: 4 }),
    ];
    const result = validateBatch(articles, []);
    expect(result.valid).toHaveLength(2);
    expect(result.valid.map(v => v._fila)).toEqual([2, 4]);
    expect(result.errors.some(e => e.row === 3)).toBe(true);
  });
});
