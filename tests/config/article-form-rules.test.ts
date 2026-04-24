import { describe, it, expect } from 'vitest';
import {
  REQUIRED_FIELDS_BY_DOC_TYPE,
  FIELD_CONSTRAINTS,
  isRequired,
  docTypeLabelsRequiring,
  potentiallyRequiredFields,
  DocTypeCode,
} from '../../src/config/article-form-rules';

describe('REQUIRED_FIELDS_BY_DOC_TYPE', () => {
  it('tipo 1 exige palabras_clave', () => {
    expect(REQUIRED_FIELDS_BY_DOC_TYPE['1'].has('palabras_clave')).toBe(true);
  });

  it('tipo 7 no exige palabras_clave', () => {
    expect(REQUIRED_FIELDS_BY_DOC_TYPE['7'].has('palabras_clave')).toBe(false);
  });

  it('tipo 11 no exige titulo_ingles', () => {
    expect(REQUIRED_FIELDS_BY_DOC_TYPE['11'].has('titulo_ingles')).toBe(false);
  });

  it('todos los 12 tipos exigen el núcleo: titulo, url, gran_area, area, tipo_documento', () => {
    const codes: DocTypeCode[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    for (const code of codes) {
      const required = REQUIRED_FIELDS_BY_DOC_TYPE[code];
      for (const field of ['titulo', 'url', 'gran_area', 'area', 'tipo_documento']) {
        expect(required.has(field), `tipo ${code} debería exigir ${field}`).toBe(true);
      }
    }
  });
});

describe('isRequired', () => {
  it('titulo es obligatorio para tipo 1 y tipo 7', () => {
    expect(isRequired('titulo', '1')).toBe(true);
    expect(isRequired('titulo', '7')).toBe(true);
  });

  it('resumen es obligatorio para tipo 6 pero no tipo 7', () => {
    expect(isRequired('resumen', '6')).toBe(true);
    expect(isRequired('resumen', '7')).toBe(false);
  });

  it('subarea nunca es obligatorio', () => {
    expect(isRequired('subarea', '1')).toBe(false);
  });

  it('cuando tipo es undefined, titulo obligatorio / resumen no', () => {
    expect(isRequired('titulo', undefined)).toBe(true);
    expect(isRequired('resumen', undefined)).toBe(false);
  });
});

describe('FIELD_CONSTRAINTS', () => {
  it('titulo: min 10, max 255', () => {
    expect(FIELD_CONSTRAINTS.titulo.min).toBe(10);
    expect(FIELD_CONSTRAINTS.titulo.max).toBe(255);
  });

  it('resumen: max 4000', () => {
    expect(FIELD_CONSTRAINTS.resumen.max).toBe(4000);
  });

  it('pagina_inicial: integer con max 9999', () => {
    expect(FIELD_CONSTRAINTS.pagina_inicial.kind).toBe('integer');
    expect(FIELD_CONSTRAINTS.pagina_inicial.max).toBe(9999);
  });

  it('doi pattern acepta formato 10.xxxx/yyyy', () => {
    expect(FIELD_CONSTRAINTS.doi.pattern?.test('10.0000/fake.0001')).toBe(true);
  });

  it('doi pattern rechaza formato URL', () => {
    expect(FIELD_CONSTRAINTS.doi.pattern?.test('https://doi.org/10.1234/abc')).toBe(false);
  });
});

describe('docTypeLabelsRequiring', () => {
  it('palabras_clave la exigen 6 tipos (tipos 1-6)', () => {
    expect(docTypeLabelsRequiring('palabras_clave').length).toBe(6);
  });

  it('titulo lo exigen los 12 tipos', () => {
    expect(docTypeLabelsRequiring('titulo').length).toBe(12);
  });

  it('subarea no la exige ningún tipo', () => {
    expect(docTypeLabelsRequiring('subarea').length).toBe(0);
  });
});

describe('potentiallyRequiredFields', () => {
  it('incluye palabras_clave, titulo y area', () => {
    const fields = potentiallyRequiredFields();
    expect(fields).toContain('palabras_clave');
    expect(fields).toContain('titulo');
    expect(fields).toContain('area');
  });
});
