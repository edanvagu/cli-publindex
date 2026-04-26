import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import ExcelJS from 'exceljs';
import { readAuthors } from '../../src/io/authors-reader';
import { AUTHORS_SHEET_NAME, AUTHORS_SHEET_HEADERS, ARTICLES_SHEET_NAME } from '../../src/config/constants';

async function buildWorkbook(outPath: string, autoresRows: any[][]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet(ARTICLES_SHEET_NAME).addRow(['titulo']);
  const ws = wb.addWorksheet(AUTHORS_SHEET_NAME);
  ws.addRow([...AUTHORS_SHEET_HEADERS]);
  for (const r of autoresRows) ws.addRow(r);
  await wb.xlsx.writeFile(outPath);
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'publindex-authors-'));
}

describe('readAuthors', () => {
  it('lee la hoja Autores y clasifica por estado', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'test.xlsx');
    await buildWorkbook(file, [
      // titulo_articulo, id_articulo, nombre_completo, identificacion, nacionalidad, filiacion, tiene_cvlac, estado_carga, accion_requerida
      ['Art 1', '100', 'Autor Uno', '111', 'Colombiana', 'Univ A', 'Sí', 'subido', ''],
      ['Art 1', '100', 'Autor Dos', '222', 'Colombiana', '', '', 'pendiente', ''],
      ['Art 2', '', 'Autor Tres', '333', 'Extranjera', '', '', 'error:No encontrado', 'Registrar'],
    ]);
    const result = readAuthors(file);

    expect(result.missingSheet).toBe(false);
    expect(result.authors).toHaveLength(3);
    expect(result.uploaded).toHaveLength(1);
    expect(result.uploaded[0].nombre_completo).toBe('Autor Uno');
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].nombre_completo).toBe('Autor Dos');
    expect(result.errored).toHaveLength(1);
    expect(result.errored[0].accion_requerida).toBe('Registrar');
  });

  it('reporta missingSheet=true si el workbook no tiene hoja Autores', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'nosheet.xlsx');
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Artículos').addRow(['titulo']);
    await wb.xlsx.writeFile(file);

    const result = readAuthors(file);
    expect(result.missingSheet).toBe(true);
    expect(result.authors).toHaveLength(0);
  });

  it('filtra filas vacías', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'empty.xlsx');
    await buildWorkbook(file, [
      ['Art 1', '100', 'Autor Uno', '111', 'Colombiana', '', '', '', ''],
      ['', '', '', '', '', '', '', '', ''],
      ['Art 1', '100', 'Autor Dos', '222', 'Colombiana', '', '', '', ''],
    ]);
    const result = readAuthors(file);
    expect(result.authors).toHaveLength(2);
  });
});
