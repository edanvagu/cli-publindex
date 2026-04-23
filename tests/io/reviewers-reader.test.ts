import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import ExcelJS from 'exceljs';
import { readReviewers } from '../../src/io/reviewers-reader';
import { REVIEWERS_SHEET_NAME, REVIEWERS_SHEET_HEADERS, ARTICLES_SHEET_NAME } from '../../src/config/constants';

async function buildWorkbook(outPath: string, reviewersRows: any[][]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet(ARTICLES_SHEET_NAME).addRow(['titulo']);
  const ws = wb.addWorksheet(REVIEWERS_SHEET_NAME);
  ws.addRow([...REVIEWERS_SHEET_HEADERS]);
  for (const r of reviewersRows) ws.addRow(r);
  await wb.xlsx.writeFile(outPath);
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'publindex-reviewers-'));
}

describe('readReviewers', () => {
  it('lee la hoja Evaluadores y clasifica por estado', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'test.xlsx');
    // nombre_completo, identificacion, nacionalidad, filiacion, tiene_cvlac, estado_carga, accion_requerida
    await buildWorkbook(file, [
      ['Jane Doe',      '111', 'Colombiana', 'Univ A', 'Sí', 'subido',              ''],
      ['John Ficticio', '222', 'Extranjera', '',       '',   'pendiente',           ''],
      ['Mary Prueba',   '',    'Colombiana', '',       '',   'error:No encontrado', 'Revisar nombre'],
    ]);
    const result = readReviewers(file);

    expect(result.missingSheet).toBe(false);
    expect(result.reviewers).toHaveLength(3);
    expect(result.uploaded).toHaveLength(1);
    expect(result.uploaded[0].nombre_completo).toBe('Jane Doe');
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].nombre_completo).toBe('John Ficticio');
    expect(result.errored).toHaveLength(1);
    expect(result.errored[0].accion_requerida).toBe('Revisar nombre');
  });

  it('reporta missingSheet=true si el workbook no tiene hoja Evaluadores', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'nosheet.xlsx');
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet(ARTICLES_SHEET_NAME).addRow(['titulo']);
    await wb.xlsx.writeFile(file);

    const result = readReviewers(file);
    expect(result.missingSheet).toBe(true);
    expect(result.reviewers).toHaveLength(0);
  });

  it('filtra filas vacías', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'empty.xlsx');
    await buildWorkbook(file, [
      ['Jane Doe',      '111', 'Colombiana', '', '', '', ''],
      ['',              '',    '',           '', '', '', ''],
      ['John Ficticio', '222', 'Extranjera', '', '', '', ''],
    ]);
    const result = readReviewers(file);
    expect(result.reviewers).toHaveLength(2);
  });
});
