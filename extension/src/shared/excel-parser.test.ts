import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbookFromBuffer } from './excel-parser';
import {
  ARTICLES_SHEET_NAME,
  AUTHORS_SHEET_NAME,
  REVIEWERS_SHEET_NAME,
} from './constants';

function buildWorkbookBuffer(sheets: Record<string, Record<string, string>[]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf as ArrayBuffer;
}

describe('parseWorkbookFromBuffer', () => {
  it('lee las tres hojas y asigna _fila empezando en 2', () => {
    const buf = buildWorkbookBuffer({
      [ARTICLES_SHEET_NAME]: [
        {
          titulo: 'Artículo Prueba 1',
          url: 'https://revistas.example.org/a/1',
          gran_area: 'Ciencias Sociales',
          area: 'Sociología',
          tipo_documento: 'Artículo de investigación científica y tecnológica',
          palabras_clave: 'alpha; beta',
          titulo_ingles: 'Fake Title 1',
          resumen: 'Resumen ficticio',
        },
      ],
      [AUTHORS_SHEET_NAME]: [
        {
          titulo_articulo: 'Artículo Prueba 1',
          id_articulo: '',
          nombre_completo: 'Ana Prueba',
          identificacion: 'TEST-00001',
          nacionalidad: 'Colombiana',
        },
      ],
      [REVIEWERS_SHEET_NAME]: [
        {
          nombre_completo: 'Autor Prueba 2',
          identificacion: 'TEST-00002',
          nacionalidad: 'Extranjera',
        },
      ],
    });

    const parsed = parseWorkbookFromBuffer(buf);

    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0].titulo).toBe('Artículo Prueba 1');
    expect(parsed.articles[0]._fila).toBe(2);

    expect(parsed.authors).toHaveLength(1);
    expect(parsed.authors[0].nombre_completo).toBe('Ana Prueba');
    expect(parsed.authors[0]._fila).toBe(2);

    expect(parsed.reviewers).toHaveLength(1);
    expect(parsed.reviewers[0].nombre_completo).toBe('Autor Prueba 2');
  });

  it('retorna arrays vacíos cuando alguna hoja no existe', () => {
    const buf = buildWorkbookBuffer({
      [ARTICLES_SHEET_NAME]: [
        {
          titulo: 'Solo artículos',
          url: 'https://revistas.example.org/a/2',
          gran_area: 'x',
          area: 'y',
          tipo_documento: 'z',
          palabras_clave: '',
          titulo_ingles: '',
          resumen: '',
        },
      ],
    });

    const parsed = parseWorkbookFromBuffer(buf);
    expect(parsed.articles).toHaveLength(1);
    expect(parsed.authors).toEqual([]);
    expect(parsed.reviewers).toEqual([]);
  });
});
