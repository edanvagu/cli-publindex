import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ExcelJS from 'exceljs';
import { generateTemplateWithData } from '../../src/io/excel-writer';
import { ArticleRow } from '../../src/entities/articles/types';
import { EXCEL_HEADERS, ARTICLES_SHEET_NAME } from '../../src/config/constants';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publindex-tpl-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb;
}

function columnStrings(ws: ExcelJS.Worksheet, colIdx: number): string[] {
  const out: string[] = [];
  ws.getColumn(colIdx).eachCell({ includeEmpty: false }, (cell) => {
    const v = cell.value;
    if (v === null || v === undefined) return;
    out.push(typeof v === 'string' ? v : String(v));
  });
  return out;
}

// Scans every column of `_lookups` looking for one whose first cell (header) equals `name`.
function findLookupColumn(ws: ExcelJS.Worksheet, name: string): string[] | undefined {
  const width = ws.actualColumnCount;
  for (let c = 1; c <= width; c++) {
    const header = ws.getCell(1, c).value;
    if (typeof header === 'string' && header === name) {
      return columnStrings(ws, c).slice(1);
    }
  }
  return undefined;
}

function formulaeAsNumbers(dv: ExcelJS.DataValidation | undefined): number[] | undefined {
  if (!dv || !dv.formulae) return undefined;
  return dv.formulae.map((f) => (typeof f === 'number' ? f : parseFloat(String(f))));
}

describe('generateTemplateWithData — validaciones dinámicas', () => {
  const fictitiousArticle: Partial<ArticleRow> = {
    titulo: 'Título ficticio de prueba con más de diez caracteres',
    url: 'https://example.com/articulo',
    gran_area: '5',
    area: '5D',
    tipo_documento: '1',
    palabras_clave: 'prueba; ficticio',
    titulo_ingles: 'Fictitious test article title with enough length',
    resumen: 'Resumen ficticio de prueba con más de diez caracteres.',
    pagina_inicial: '1',
    pagina_final: '10',
  };

  it('_lookups NO expone REQ_TITULO (siempre-obligatorios usan regla simple $cell="")', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const lookups = wb.getWorksheet('_lookups');
    expect(lookups).toBeDefined();

    // titulo is ALWAYS_REQUIRED → no named range needed, only conditional fields get one.
    expect(findLookupColumn(lookups!, 'REQ_TITULO')).toBeUndefined();
    expect(findLookupColumn(lookups!, 'REQ_URL')).toBeUndefined();
    expect(findLookupColumn(lookups!, 'REQ_TIPO_DOCUMENTO')).toBeUndefined();
  });

  it('_lookups expone REQ_PALABRAS_CLAVE con 6 etiquetas (tipos 1–6)', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const lookups = wb.getWorksheet('_lookups');
    expect(lookups).toBeDefined();

    const labels = findLookupColumn(lookups!, 'REQ_PALABRAS_CLAVE');
    expect(labels).toBeDefined();
    expect(labels!.length).toBe(6);
  });

  it('aplica data validation textLength [10, 255] a la columna titulo', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const ws = wb.getWorksheet(ARTICLES_SHEET_NAME);
    expect(ws).toBeDefined();

    const tituloIdx = EXCEL_HEADERS.indexOf('titulo') + 1;
    const cell = ws!.getCell(2, tituloIdx);
    expect(cell.dataValidation?.type).toBe('textLength');
    const nums = formulaeAsNumbers(cell.dataValidation);
    expect(nums).toEqual([10, 255]);
  });

  it('aplica data validation whole [1, 9999] a la columna pagina_inicial', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const ws = wb.getWorksheet(ARTICLES_SHEET_NAME);
    expect(ws).toBeDefined();

    const pIniIdx = EXCEL_HEADERS.indexOf('pagina_inicial') + 1;
    const cell = ws!.getCell(2, pIniIdx);
    expect(cell.dataValidation?.type).toBe('whole');
    const nums = formulaeAsNumbers(cell.dataValidation);
    expect(nums).toEqual([1, 9999]);
  });

  it('amarillo de tipo_documento no depende de MATCH y sí del guard de fila activa', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const ws = wb.getWorksheet(ARTICLES_SHEET_NAME);
    expect(ws).toBeDefined();

    const tipoCol = EXCEL_HEADERS.indexOf('tipo_documento') + 1;
    const letter = ws!.getColumn(tipoCol).letter;
    const rules = (
      ws as unknown as { conditionalFormattings: Array<{ ref: string; rules: Array<{ formulae?: string[] }> }> }
    ).conditionalFormattings;
    const matching = rules.filter((cf) => cf.ref.startsWith(`${letter}2`));
    expect(matching.length).toBeGreaterThan(0);
    const formulae = matching.flatMap((cf) => cf.rules.flatMap((r) => r.formulae ?? []));
    expect(formulae.some((f) => f.includes('=""'))).toBe(true);
    expect(formulae.some((f) => f.includes('MATCH'))).toBe(false);
    expect(formulae.some((f) => f.includes('OR('))).toBe(true);
  });

  it('amarillo de palabras_clave usa MATCH contra REQ_PALABRAS_CLAVE', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const ws = wb.getWorksheet(ARTICLES_SHEET_NAME);
    expect(ws).toBeDefined();

    const pcCol = EXCEL_HEADERS.indexOf('palabras_clave') + 1;
    const letter = ws!.getColumn(pcCol).letter;
    const rules = (
      ws as unknown as { conditionalFormattings: Array<{ ref: string; rules: Array<{ formulae?: string[] }> }> }
    ).conditionalFormattings;
    const matching = rules.filter((cf) => cf.ref.startsWith(`${letter}2`));
    const formulae = matching.flatMap((cf) => cf.rules.flatMap((r) => r.formulae ?? []));
    expect(formulae.some((f) => f.includes('REQ_PALABRAS_CLAVE'))).toBe(true);
  });

  it('aplica data validation type=date a fecha_recepcion y fecha_aceptacion', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const ws = wb.getWorksheet(ARTICLES_SHEET_NAME)!;
    const headers = ws.getRow(1).values as string[];
    const fRecCol = headers.indexOf('fecha_recepcion');
    const dv = ws.getCell(2, fRecCol).dataValidation;
    expect(dv).toBeDefined();
    expect(dv!.type).toBe('date');
  });

  it('aplica numFmt dd/mm/yyyy a fecha_recepcion y fecha_aceptacion (alineado con Publindex)', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const ws = wb.getWorksheet(ARTICLES_SHEET_NAME)!;
    const headers = ws.getRow(1).values as string[];
    const fRecCol = headers.indexOf('fecha_recepcion');
    const fAccCol = headers.indexOf('fecha_aceptacion');
    expect(fRecCol).toBeGreaterThan(0);
    expect(fAccCol).toBeGreaterThan(0);

    expect(ws.getCell(2, fRecCol).numFmt).toBe('dd/mm/yyyy');
    expect(ws.getCell(2, fAccCol).numFmt).toBe('dd/mm/yyyy');
    expect(ws.getCell(50, fRecCol).numFmt).toBe('dd/mm/yyyy');
  });

  it('ninguna data validation usa una lista inline (Excel para Mac rechaza inline >255 chars)', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const ws = wb.getWorksheet(ARTICLES_SHEET_NAME)!;
    const dvs = (ws as unknown as { dataValidations: { model: Record<string, ExcelJS.DataValidation> } })
      .dataValidations.model;
    for (const [range, dv] of Object.entries(dvs)) {
      if (dv.type !== 'list') continue;
      const formula = String(dv.formulae?.[0] ?? '');
      expect(formula.startsWith('"'), `lista inline en ${range}: ${formula}`).toBe(false);
    }
  });

  it('la hoja Instrucciones etiqueta las columnas Auto como "Auto (ruta automatizada)"', async () => {
    const out = path.join(tempDir, 'test.xlsx');
    await generateTemplateWithData([fictitiousArticle], out);

    const wb = await loadWorkbook(out);
    const ws = wb.getWorksheet('Instrucciones');
    expect(ws).toBeDefined();

    const obligatorioValues: string[] = [];
    for (let r = 1; r <= ws!.rowCount; r++) {
      const v = ws!.getCell(r, 2).value;
      if (typeof v === 'string') obligatorioValues.push(v);
    }
    expect(obligatorioValues).toContain('Auto (ruta automatizada)');
    expect(obligatorioValues).not.toContain('Auto');
  });
});
