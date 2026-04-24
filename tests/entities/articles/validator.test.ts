import { describe, it, expect } from 'vitest';
import { validateBatch } from '../../../src/entities/articles/validator';
import { ArticleRow } from '../../../src/entities/articles/types';

function validArticle(overrides: Partial<ArticleRow> = {}): ArticleRow {
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
    const result = validateBatch([validArticle()], []);
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('acepta múltiples artículos válidos', () => {
    const articles = [
      validArticle({ _fila: 2 }),
      validArticle({ _fila: 3, titulo: 'Otro título bastante largo' }),
    ];
    const result = validateBatch(articles, []);
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(2);
  });
});

describe('validateBatch - campos obligatorios', () => {
  it('rechaza título faltante', () => {
    const result = validateBatch([validArticle({ titulo: '' })], []);
    expect(result.errors.some(e => e.field === 'titulo')).toBe(true);
    expect(result.valid).toHaveLength(0);
  });

  it('rechaza título demasiado corto (<10 chars)', () => {
    const result = validateBatch([validArticle({ titulo: 'Corto' })], []);
    const err = result.errors.find(e => e.field === 'titulo');
    expect(err).toBeDefined();
    expect(err?.message).toContain('mínimo 10');
  });

  it('rechaza URL sin http/https', () => {
    const result = validateBatch([validArticle({ url: 'ftp://example.com' })], []);
    const err = result.errors.find(e => e.field === 'url');
    expect(err).toBeDefined();
    expect(err?.message).toContain('http');
  });

  it('rechaza gran_area inexistente', () => {
    const result = validateBatch([validArticle({ gran_area: 'XX-invalido' })], []);
    expect(result.errors.some(e => e.field === 'gran_area')).toBe(true);
  });

  it('rechaza tipo_documento fuera de rango', () => {
    const result = validateBatch([validArticle({ tipo_documento: 'XX-invalido' })], []);
    expect(result.errors.some(e => e.field === 'tipo_documento')).toBe(true);
  });

  it('rechaza resumen demasiado corto', () => {
    const result = validateBatch([validArticle({ resumen: 'Corto' })], []);
    expect(result.errors.some(e => e.field === 'resumen')).toBe(true);
  });

  it('rechaza titulo_ingles demasiado corto', () => {
    const result = validateBatch([validArticle({ titulo_ingles: 'Short' })], []);
    expect(result.errors.some(e => e.field === 'titulo_ingles')).toBe(true);
  });

  it('rechaza palabras_clave vacías', () => {
    const result = validateBatch([validArticle({ palabras_clave: '' })], []);
    expect(result.errors.some(e => e.field === 'palabras_clave')).toBe(true);
  });
});

describe('validateBatch - concordancia entre campos', () => {
  it('rechaza cuando area no pertenece a gran_area', () => {
    const result = validateBatch([validArticle({ gran_area: 'Humanidades', area: 'Matemática' })], []);
    const err = result.errors.find(e => e.field === 'area');
    expect(err).toBeDefined();
    expect(err?.message).toContain('no pertenece a');
  });

  it('acepta cuando area pertenece a gran_area', () => {
    const result = validateBatch([validArticle({ gran_area: 'Humanidades', area: 'Historia y Arqueología' })], []);
    expect(result.errors.filter(e => e.field === 'area')).toEqual([]);
  });

  it('rechaza cuando subarea no pertenece a area', () => {
    const result = validateBatch([validArticle({ gran_area: 'Humanidades', area: 'Historia y Arqueología', subarea: 'Biología Celular y Microbiología' })], []);
    expect(result.errors.some(e => e.field === 'subarea')).toBe(true);
  });

  it('acepta subarea correcta', () => {
    const result = validateBatch([validArticle({ gran_area: 'Humanidades', area: 'Historia y Arqueología', subarea: 'Historia' })], []);
    expect(result.errors.filter(e => e.field === 'subarea')).toEqual([]);
  });

  it('rechaza fecha_aceptacion anterior a fecha_recepcion', () => {
    const result = validateBatch(
      [validArticle({ fecha_recepcion: '2026-03-01', fecha_aceptacion: '2026-01-15' })],
      []
    );
    const err = result.errors.find(e => e.field === 'fecha_aceptacion');
    expect(err).toBeDefined();
  });

  it('acepta fecha_aceptacion posterior a fecha_recepcion', () => {
    const result = validateBatch(
      [validArticle({ fecha_recepcion: '2026-01-15', fecha_aceptacion: '2026-03-01' })],
      []
    );
    expect(result.errors.filter(e => e.field === 'fecha_aceptacion')).toEqual([]);
  });

  it('rechaza pagina_final <= pagina_inicial', () => {
    const result = validateBatch(
      [validArticle({ pagina_inicial: '10', pagina_final: '5' })],
      []
    );
    const err = result.errors.find(e => e.field === 'pagina_final');
    expect(err).toBeDefined();
  });

  it('acepta pagina_final > pagina_inicial', () => {
    const result = validateBatch(
      [validArticle({ pagina_inicial: '1', pagina_final: '15' })],
      []
    );
    expect(result.errors.filter(e => e.field === 'pagina_final')).toEqual([]);
  });

  it('rechaza idioma igual a otro_idioma', () => {
    const result = validateBatch(
      [validArticle({ idioma: 'Español', otro_idioma: 'Español' })],
      []
    );
    expect(result.errors.some(e => e.field === 'otro_idioma')).toBe(true);
  });

  it('acepta idiomas diferentes', () => {
    const result = validateBatch(
      [validArticle({ idioma: 'Español', otro_idioma: 'Inglés' })],
      []
    );
    expect(result.errors.filter(e => e.field === 'otro_idioma')).toEqual([]);
  });
});

describe('validateBatch - enums y formatos', () => {
  it('rechaza tipo_resumen inválido', () => {
    const result = validateBatch([validArticle({ tipo_resumen: 'X' })], []);
    expect(result.errors.some(e => e.field === 'tipo_resumen')).toBe(true);
  });

  it('acepta tipo_resumen válido (A, D, S)', () => {
    for (const valor of ['Analítico', 'Descriptivo', 'Analítico sintético']) {
      const result = validateBatch([validArticle({ tipo_resumen: valor, _fila: 2 })], []);
      expect(result.errors.filter(e => e.field === 'tipo_resumen')).toEqual([]);
    }
  });

  it('rechaza tipo_especialista inválido', () => {
    const result = validateBatch([validArticle({ tipo_especialista: 'ZZ-invalido' })], []);
    expect(result.errors.some(e => e.field === 'tipo_especialista')).toBe(true);
  });

  it('rechaza eval_interna con valor distinto a T/F', () => {
    const result = validateBatch([validArticle({ eval_interna: 'YES' })], []);
    expect(result.errors.some(e => e.field === 'eval_interna')).toBe(true);
  });

  it('acepta eval_interna con T o F', () => {
    expect(validateBatch([validArticle({ eval_interna: 'T' })], []).errors.filter(e => e.field === 'eval_interna')).toEqual([]);
    expect(validateBatch([validArticle({ eval_interna: 'F' })], []).errors.filter(e => e.field === 'eval_interna')).toEqual([]);
  });

  it('rechaza idioma no soportado', () => {
    const result = validateBatch([validArticle({ idioma: 'ZZ-invalido' })], []);
    expect(result.errors.some(e => e.field === 'idioma')).toBe(true);
  });

  it('rechaza DOI demasiado corto', () => {
    const result = validateBatch([validArticle({ doi: 'short' })], []);
    expect(result.errors.some(e => e.field === 'doi')).toBe(true);
  });

  it('acepta DOI válido', () => {
    const result = validateBatch([validArticle({ doi: '10.1234/abcd' })], []);
    expect(result.errors.filter(e => e.field === 'doi')).toEqual([]);
  });

  it('rechaza DOI en formato URL con https://doi.org/', () => {
    const result = validateBatch([validArticle({ doi: 'https://doi.org/10.1234/abcd' })], []);
    const err = result.errors.find(e => e.field === 'doi');
    expect(err).toBeDefined();
    expect(err?.message).toContain('10.');
  });

  it('rechaza DOI que empieza con http://', () => {
    const result = validateBatch([validArticle({ doi: 'http://dx.doi.org/10.1234/abcd' })], []);
    expect(result.errors.some(e => e.field === 'doi')).toBe(true);
  });

  it('rechaza DOI que no empieza con "10."', () => {
    const result = validateBatch([validArticle({ doi: 'abc/1234567890' })], []);
    expect(result.errors.some(e => e.field === 'doi')).toBe(true);
  });

  it('rechaza fecha con formato inválido', () => {
    const result = validateBatch([validArticle({ fecha_recepcion: 'hoy' })], []);
    expect(result.errors.some(e => e.field === 'fecha_recepcion')).toBe(true);
  });

  it('acepta fecha YYYY-MM-DD', () => {
    const result = validateBatch([validArticle({ fecha_recepcion: '2026-04-15' })], []);
    expect(result.errors.filter(e => e.field === 'fecha_recepcion')).toEqual([]);
  });

  it('acepta fecha DD/MM/YYYY', () => {
    const result = validateBatch([validArticle({ fecha_recepcion: '15/04/2026' })], []);
    expect(result.errors.filter(e => e.field === 'fecha_recepcion')).toEqual([]);
  });
});

describe('validateBatch - numéricos', () => {
  it('rechaza numero_autores no numérico', () => {
    const result = validateBatch([validArticle({ numero_autores: 'tres' })], []);
    expect(result.errors.some(e => e.field === 'numero_autores')).toBe(true);
  });

  it('acepta numero_autores numérico', () => {
    const result = validateBatch([validArticle({ numero_autores: '3' })], []);
    expect(result.errors.filter(e => e.field === 'numero_autores')).toEqual([]);
  });

  it('rechaza numero_referencias negativo', () => {
    const result = validateBatch([validArticle({ numero_referencias: '-5' })], []);
    expect(result.errors.some(e => e.field === 'numero_referencias')).toBe(true);
  });
});

describe('validateBatch - obligatoriedad por tipo_documento', () => {
  it('tipo 1 sin palabras_clave → error en palabras_clave', () => {
    const result = validateBatch([validArticle({ palabras_clave: '' })], []);
    expect(result.errors.some(e => e.field === 'palabras_clave')).toBe(true);
  });

  it('tipo 1 sin titulo_ingles → error en titulo_ingles', () => {
    const result = validateBatch([validArticle({ titulo_ingles: '' })], []);
    expect(result.errors.some(e => e.field === 'titulo_ingles')).toBe(true);
  });

  it('tipo 7 (Cartas al editor) sin palabras_clave → sin error', () => {
    const result = validateBatch([validArticle({
      tipo_documento: 'Cartas al editor',
      palabras_clave: '',
    })], []);
    expect(result.errors.some(e => e.field === 'palabras_clave')).toBe(false);
  });

  it('tipo 11 (Reseña bibliográfica) sin titulo_ingles → sin error', () => {
    const result = validateBatch([validArticle({
      tipo_documento: 'Reseña bibliográfica',
      titulo_ingles: '',
    })], []);
    expect(result.errors.some(e => e.field === 'titulo_ingles')).toBe(false);
  });

  it('tipo 8 (Editorial) con solo campos núcleo → válido', () => {
    const minimal: Partial<import('../../../src/entities/articles/types').ArticleRow> = {
      titulo: 'Editorial del número de abril de 2026',
      url: 'https://example.com/editorial',
      gran_area: 'Humanidades',
      area: 'Historia y Arqueología',
      tipo_documento: 'Editorial',
      palabras_clave: '',
      titulo_ingles: '',
      resumen: '',
      _fila: 2,
    };
    const result = validateBatch([minimal as import('../../../src/entities/articles/types').ArticleRow], []);
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('cualquier tipo sin titulo → error en titulo', () => {
    const result = validateBatch([validArticle({ tipo_documento: 'Editorial', titulo: '' })], []);
    expect(result.errors.some(e => e.field === 'titulo')).toBe(true);
  });

  it('cualquier tipo sin gran_area → error en gran_area', () => {
    const result = validateBatch([validArticle({ tipo_documento: 'Editorial', gran_area: '' })], []);
    expect(result.errors.some(e => e.field === 'gran_area')).toBe(true);
  });
});

describe('validateBatch - constraints de longitud y rango', () => {
  it('titulo de 256 caracteres → error (max 255)', () => {
    const result = validateBatch([validArticle({ titulo: 'A'.repeat(256) })], []);
    expect(result.errors.some(e => e.field === 'titulo')).toBe(true);
  });

  it('pagina_inicial = "99999" → error (max 9999)', () => {
    const result = validateBatch([validArticle({ pagina_inicial: '99999' })], []);
    expect(result.errors.some(e => e.field === 'pagina_inicial')).toBe(true);
  });

  it('pagina_inicial = "0" → error (min 1)', () => {
    const result = validateBatch([validArticle({ pagina_inicial: '0' })], []);
    expect(result.errors.some(e => e.field === 'pagina_inicial')).toBe(true);
  });

  it('numero_pares_evaluadores = "0" → válido (min 0)', () => {
    const result = validateBatch([validArticle({ numero_pares_evaluadores: '0' })], []);
    expect(result.errors.filter(e => e.field === 'numero_pares_evaluadores')).toEqual([]);
  });

  it('doi en formato URL (https://doi.org/...) → error por pattern', () => {
    const result = validateBatch([validArticle({ doi: 'https://doi.org/10.1234/abc' })], []);
    expect(result.errors.some(e => e.field === 'doi')).toBe(true);
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
      validArticle({ _fila: 2, titulo: 'Título repetido con diez o más caracteres' }),
      validArticle({ _fila: 5, titulo: 'Título repetido con diez o más caracteres' }),
    ];
    const result = validateBatch(articles, []);
    expect(result.warnings.some(a => a.message.toLowerCase().includes('duplicado'))).toBe(true);
  });

  it('detecta headers desconocidos como warning', () => {
    const result = validateBatch([validArticle()], ['abstrac', 'xyz']);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('sugiere header similar en caso de typo', () => {
    const result = validateBatch([validArticle()], ['titolo']);
    const adv = result.warnings.find(a => a.message.includes('titolo'));
    expect(adv).toBeDefined();
    expect(adv?.message).toContain('quiso decir');
    expect(adv?.message).toContain('titulo');
  });

  it('separa correctamente válidos de inválidos', () => {
    const articles = [
      validArticle({ _fila: 2 }),
      validArticle({ _fila: 3, titulo: 'corto' }), // inválido
      validArticle({ _fila: 4 }),
    ];
    const result = validateBatch(articles, []);
    expect(result.valid).toHaveLength(2);
    expect(result.valid.map(v => v._fila)).toEqual([2, 4]);
    expect(result.errors.some(e => e.row === 3)).toBe(true);
  });
});
