import { describe, it, expect } from 'vitest';
import { validarLote } from '../../src/data/validator';
import { ArticuloRow } from '../../src/data/types';

// === Helper para construir un artículo válido base ===
function articuloValido(overrides: Partial<ArticuloRow> = {}): ArticuloRow {
  return {
    titulo: 'Título válido con más de diez caracteres',
    url: 'https://example.com/articulo',
    gran_area: '6',
    area: '6A',
    tipo_documento: '1',
    palabras_clave: 'historia; cultura',
    titulo_ingles: 'Valid title with more than ten characters',
    resumen: 'Resumen válido con más de diez caracteres',
    _fila: 2,
    ...overrides,
  };
}

describe('validarLote - casos válidos', () => {
  it('acepta un artículo con todos los campos obligatorios válidos', () => {
    const result = validarLote([articuloValido()], []);
    expect(result.errores).toEqual([]);
    expect(result.validos).toHaveLength(1);
  });

  it('acepta múltiples artículos válidos', () => {
    const articulos = [
      articuloValido({ _fila: 2 }),
      articuloValido({ _fila: 3, titulo: 'Otro título bastante largo' }),
    ];
    const result = validarLote(articulos, []);
    expect(result.errores).toEqual([]);
    expect(result.validos).toHaveLength(2);
  });
});

describe('validarLote - campos obligatorios', () => {
  it('rechaza título faltante', () => {
    const result = validarLote([articuloValido({ titulo: '' })], []);
    expect(result.errores.some(e => e.campo === 'titulo')).toBe(true);
    expect(result.validos).toHaveLength(0);
  });

  it('rechaza título demasiado corto (<10 chars)', () => {
    const result = validarLote([articuloValido({ titulo: 'Corto' })], []);
    const err = result.errores.find(e => e.campo === 'titulo');
    expect(err).toBeDefined();
    expect(err?.mensaje).toContain('mínimo 10');
  });

  it('rechaza URL sin http/https', () => {
    const result = validarLote([articuloValido({ url: 'ftp://example.com' })], []);
    const err = result.errores.find(e => e.campo === 'url');
    expect(err).toBeDefined();
    expect(err?.mensaje).toContain('http');
  });

  it('rechaza gran_area inexistente', () => {
    const result = validarLote([articuloValido({ gran_area: '99' })], []);
    expect(result.errores.some(e => e.campo === 'gran_area')).toBe(true);
  });

  it('rechaza tipo_documento fuera de rango', () => {
    const result = validarLote([articuloValido({ tipo_documento: '99' })], []);
    expect(result.errores.some(e => e.campo === 'tipo_documento')).toBe(true);
  });

  it('rechaza resumen demasiado corto', () => {
    const result = validarLote([articuloValido({ resumen: 'Corto' })], []);
    expect(result.errores.some(e => e.campo === 'resumen')).toBe(true);
  });

  it('rechaza titulo_ingles demasiado corto', () => {
    const result = validarLote([articuloValido({ titulo_ingles: 'Short' })], []);
    expect(result.errores.some(e => e.campo === 'titulo_ingles')).toBe(true);
  });

  it('rechaza palabras_clave vacías', () => {
    const result = validarLote([articuloValido({ palabras_clave: '' })], []);
    expect(result.errores.some(e => e.campo === 'palabras_clave')).toBe(true);
  });
});

describe('validarLote - concordancia entre campos', () => {
  it('rechaza cuando area no pertenece a gran_area', () => {
    const result = validarLote([articuloValido({ gran_area: '6', area: '1A' })], []);
    const err = result.errores.find(e => e.campo === 'area');
    expect(err).toBeDefined();
    expect(err?.mensaje).toContain('no pertenece a gran_area');
  });

  it('acepta cuando area pertenece a gran_area', () => {
    const result = validarLote([articuloValido({ gran_area: '6', area: '6A' })], []);
    expect(result.errores.filter(e => e.campo === 'area')).toEqual([]);
  });

  it('rechaza cuando subarea no pertenece a area', () => {
    const result = validarLote([articuloValido({ gran_area: '6', area: '6A', subarea: '1F01' })], []);
    expect(result.errores.some(e => e.campo === 'subarea')).toBe(true);
  });

  it('acepta subarea correcta', () => {
    const result = validarLote([articuloValido({ gran_area: '6', area: '6A', subarea: '6A01' })], []);
    expect(result.errores.filter(e => e.campo === 'subarea')).toEqual([]);
  });

  it('rechaza fecha_aceptacion anterior a fecha_recepcion', () => {
    const result = validarLote(
      [articuloValido({ fecha_recepcion: '2026-03-01', fecha_aceptacion: '2026-01-15' })],
      []
    );
    const err = result.errores.find(e => e.campo === 'fecha_aceptacion');
    expect(err).toBeDefined();
  });

  it('acepta fecha_aceptacion posterior a fecha_recepcion', () => {
    const result = validarLote(
      [articuloValido({ fecha_recepcion: '2026-01-15', fecha_aceptacion: '2026-03-01' })],
      []
    );
    expect(result.errores.filter(e => e.campo === 'fecha_aceptacion')).toEqual([]);
  });

  it('rechaza pagina_final <= pagina_inicial', () => {
    const result = validarLote(
      [articuloValido({ pagina_inicial: '10', pagina_final: '5' })],
      []
    );
    const err = result.errores.find(e => e.campo === 'pagina_final');
    expect(err).toBeDefined();
  });

  it('acepta pagina_final > pagina_inicial', () => {
    const result = validarLote(
      [articuloValido({ pagina_inicial: '1', pagina_final: '15' })],
      []
    );
    expect(result.errores.filter(e => e.campo === 'pagina_final')).toEqual([]);
  });

  it('rechaza idioma igual a otro_idioma', () => {
    const result = validarLote(
      [articuloValido({ idioma: 'ES', otro_idioma: 'ES' })],
      []
    );
    expect(result.errores.some(e => e.campo === 'otro_idioma')).toBe(true);
  });

  it('acepta idiomas diferentes', () => {
    const result = validarLote(
      [articuloValido({ idioma: 'ES', otro_idioma: 'EN' })],
      []
    );
    expect(result.errores.filter(e => e.campo === 'otro_idioma')).toEqual([]);
  });
});

describe('validarLote - enums y formatos', () => {
  it('rechaza tipo_resumen inválido', () => {
    const result = validarLote([articuloValido({ tipo_resumen: 'X' })], []);
    expect(result.errores.some(e => e.campo === 'tipo_resumen')).toBe(true);
  });

  it('acepta tipo_resumen válido (A, D, S)', () => {
    for (const valor of ['A', 'D', 'S']) {
      const result = validarLote([articuloValido({ tipo_resumen: valor, _fila: 2 })], []);
      expect(result.errores.filter(e => e.campo === 'tipo_resumen')).toEqual([]);
    }
  });

  it('rechaza tipo_especialista inválido', () => {
    const result = validarLote([articuloValido({ tipo_especialista: 'Z' })], []);
    expect(result.errores.some(e => e.campo === 'tipo_especialista')).toBe(true);
  });

  it('rechaza eval_interna con valor distinto a T/F', () => {
    const result = validarLote([articuloValido({ eval_interna: 'YES' })], []);
    expect(result.errores.some(e => e.campo === 'eval_interna')).toBe(true);
  });

  it('acepta eval_interna con T o F', () => {
    expect(validarLote([articuloValido({ eval_interna: 'T' })], []).errores.filter(e => e.campo === 'eval_interna')).toEqual([]);
    expect(validarLote([articuloValido({ eval_interna: 'F' })], []).errores.filter(e => e.campo === 'eval_interna')).toEqual([]);
  });

  it('rechaza idioma no soportado', () => {
    const result = validarLote([articuloValido({ idioma: 'ZZ' })], []);
    expect(result.errores.some(e => e.campo === 'idioma')).toBe(true);
  });

  it('rechaza DOI demasiado corto', () => {
    const result = validarLote([articuloValido({ doi: 'short' })], []);
    expect(result.errores.some(e => e.campo === 'doi')).toBe(true);
  });

  it('acepta DOI válido', () => {
    const result = validarLote([articuloValido({ doi: '10.1234/abcd' })], []);
    expect(result.errores.filter(e => e.campo === 'doi')).toEqual([]);
  });

  it('rechaza DOI en formato URL con https://doi.org/', () => {
    const result = validarLote([articuloValido({ doi: 'https://doi.org/10.1234/abcd' })], []);
    const err = result.errores.find(e => e.campo === 'doi');
    expect(err).toBeDefined();
    expect(err?.mensaje).toContain('10.');
  });

  it('rechaza DOI que empieza con http://', () => {
    const result = validarLote([articuloValido({ doi: 'http://dx.doi.org/10.1234/abcd' })], []);
    expect(result.errores.some(e => e.campo === 'doi')).toBe(true);
  });

  it('rechaza DOI que no empieza con "10."', () => {
    const result = validarLote([articuloValido({ doi: 'abc/1234567890' })], []);
    expect(result.errores.some(e => e.campo === 'doi')).toBe(true);
  });

  it('rechaza fecha con formato inválido', () => {
    const result = validarLote([articuloValido({ fecha_recepcion: 'hoy' })], []);
    expect(result.errores.some(e => e.campo === 'fecha_recepcion')).toBe(true);
  });

  it('acepta fecha YYYY-MM-DD', () => {
    const result = validarLote([articuloValido({ fecha_recepcion: '2026-04-15' })], []);
    expect(result.errores.filter(e => e.campo === 'fecha_recepcion')).toEqual([]);
  });

  it('acepta fecha DD/MM/YYYY', () => {
    const result = validarLote([articuloValido({ fecha_recepcion: '15/04/2026' })], []);
    expect(result.errores.filter(e => e.campo === 'fecha_recepcion')).toEqual([]);
  });
});

describe('validarLote - numéricos', () => {
  it('rechaza numero_autores no numérico', () => {
    const result = validarLote([articuloValido({ numero_autores: 'tres' })], []);
    expect(result.errores.some(e => e.campo === 'numero_autores')).toBe(true);
  });

  it('acepta numero_autores numérico', () => {
    const result = validarLote([articuloValido({ numero_autores: '3' })], []);
    expect(result.errores.filter(e => e.campo === 'numero_autores')).toEqual([]);
  });

  it('rechaza numero_referencias negativo', () => {
    const result = validarLote([articuloValido({ numero_referencias: '-5' })], []);
    expect(result.errores.some(e => e.campo === 'numero_referencias')).toBe(true);
  });
});

describe('validarLote - integridad del lote', () => {
  it('rechaza lote vacío', () => {
    const result = validarLote([], []);
    expect(result.errores.length).toBeGreaterThan(0);
    expect(result.validos).toEqual([]);
  });

  it('detecta duplicados por título como advertencia', () => {
    const articulos = [
      articuloValido({ _fila: 2, titulo: 'Título repetido con diez o más caracteres' }),
      articuloValido({ _fila: 5, titulo: 'Título repetido con diez o más caracteres' }),
    ];
    const result = validarLote(articulos, []);
    expect(result.advertencias.some(a => a.mensaje.toLowerCase().includes('duplicado'))).toBe(true);
  });

  it('detecta headers desconocidos como advertencia', () => {
    const result = validarLote([articuloValido()], ['abstrac', 'xyz']);
    expect(result.advertencias.length).toBeGreaterThanOrEqual(2);
  });

  it('sugiere header similar en caso de typo', () => {
    const result = validarLote([articuloValido()], ['titolo']);
    const adv = result.advertencias.find(a => a.mensaje.includes('titolo'));
    expect(adv).toBeDefined();
    expect(adv?.mensaje).toContain('quiso decir');
    expect(adv?.mensaje).toContain('titulo');
  });

  it('separa correctamente válidos de inválidos', () => {
    const articulos = [
      articuloValido({ _fila: 2 }),
      articuloValido({ _fila: 3, titulo: 'corto' }), // inválido
      articuloValido({ _fila: 4 }),
    ];
    const result = validarLote(articulos, []);
    expect(result.validos).toHaveLength(2);
    expect(result.validos.map(v => v._fila)).toEqual([2, 4]);
    expect(result.errores.some(e => e.fila === 3)).toBe(true);
  });
});
