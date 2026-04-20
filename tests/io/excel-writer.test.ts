import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as XLSX from 'xlsx-js-style';
import { generateTemplateWithData } from '../../src/io/excel-writer';
import { ArticleRow } from '../../src/entities/articles/types';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publindex-tpl-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function readArticlesSheet(filePath: string) {
  const wb = XLSX.readFile(filePath, { cellStyles: true });
  return wb.Sheets['Artículos'];
}

function backgroundColor(cell: any): string | undefined {
  return cell?.s?.fgColor?.rgb ?? cell?.s?.fill?.fgColor?.rgb;
}

describe('generateTemplateWithData — resaltado de obligatorios vacíos', () => {
  it('resalta en amarillo las celdas obligatorias sin datos', async () => {
    const partial: Partial<ArticleRow> = {
      titulo: 'Artículo con título',
      resumen: 'Resumen presente con más de diez caracteres.',
      palabras_clave: 'foo; bar',
      titulo_ingles: 'Article title in English',
    };
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([partial], out);

    const ws = readArticlesSheet(out);
    // Fila 2 en Excel = índice 1 (row 0 es header)
    // url → columna C, gran_area → J (mandatorios vacíos)
    const urlCell = ws[XLSX.utils.encode_cell({ r: 1, c: 2 })];
    const granAreaCell = ws[XLSX.utils.encode_cell({ r: 1, c: 8 })];

    expect(backgroundColor(urlCell)).toBe('FFEB9C');
    expect(backgroundColor(granAreaCell)).toBe('FFEB9C');
  });

  it('no resalta celdas obligatorias que sí tienen datos', async () => {
    const partial: Partial<ArticleRow> = {
      titulo: 'Artículo con título',
      url: 'https://example.com/art',
      gran_area: '5',
      area: '5D',
      tipo_documento: '1',
      palabras_clave: 'foo; bar',
      titulo_ingles: 'Article title in English',
      resumen: 'Resumen presente con más de diez caracteres.',
    };
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([partial], out);

    const ws = readArticlesSheet(out);
    const tituloCell = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    const urlCell = ws[XLSX.utils.encode_cell({ r: 1, c: 2 })];
    expect(backgroundColor(tituloCell)).toBeUndefined();
    expect(backgroundColor(urlCell)).toBeUndefined();
  });

  it('no resalta celdas de campos no obligatorios aunque estén vacías', async () => {
    const partial: Partial<ArticleRow> = { titulo: 'T' };
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([partial], out);

    const ws = readArticlesSheet(out);
    // doi → columna B (no obligatorio)
    const doiCell = ws[XLSX.utils.encode_cell({ r: 1, c: 1 })];
    expect(backgroundColor(doiCell)).toBeUndefined();
  });
});
