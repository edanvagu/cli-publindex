import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { ProgressTracker } from '../../src/io/progress';
import { readArticles } from '../../src/io/excel-reader';

function simulateLockedFile() {
  // The tracker writes via a private `writeWorkbook` method; spy on it (prototype-level) to simulate Excel holding the file open without actually locking the OS file descriptor.
  return vi.spyOn(ProgressTracker.prototype as any, 'writeWorkbook').mockImplementation(() => {
    throw new Error('EBUSY: resource busy or locked');
  });
}

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publindex-progreso-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function createBaseXlsx(filePath: string, rows: number = 2) {
  const headers = ['titulo', 'url'];
  const data: unknown[][] = [headers];
  for (let i = 0; i < rows; i++) {
    data.push([`Título ${i + 1}`, `https://example.com/${i + 1}`]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, filePath);
}

// Builds an ExcelJS workbook with intentionally rich styling: italic header, a yellow fill on a data cell, and a list (dropdown) data validation. The style preservation test reads it back after a tracker write to confirm none of these were lost.
async function createStyledXlsx(filePath: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1');
  ws.addRow(['titulo', 'url']);
  ws.addRow(['Título 1', 'https://example.com/1']);
  ws.addRow(['Título 2', 'https://example.com/2']);

  ws.getCell('A1').font = { italic: true, bold: true };
  ws.getCell('A2').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFEB9C' },
  };
  ws.getCell('B2').dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"a,b,c"'],
  };

  await wb.xlsx.writeFile(filePath);
}

function readXlsx(filePath: string): Record<string, string>[] {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
}

describe('ProgressTracker - XLSX', () => {
  it('marca un artículo como subido en el Excel', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);

    const tracker = new ProgressTracker(file);
    const ok = await tracker.update({ row: 2, state: 'subido' });

    expect(ok).toBe(true);
    const data = readXlsx(file);
    expect(data[0].estado).toBe('subido');
    expect(data[0].fecha_subida).toBeTruthy();
  });

  it('marca un artículo como error con mensaje', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);

    const tracker = new ProgressTracker(file);
    await tracker.update({ row: 2, state: 'error', error: 'HTTP 500' });

    const data = readXlsx(file);
    expect(data[0].estado).toBe('error');
    expect(data[0].ultimo_error).toBe('HTTP 500');
  });

  it('agrega las columnas estado, fecha_subida, ultimo_error si no existen', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);

    const tracker = new ProgressTracker(file);
    await tracker.update({ row: 2, state: 'subido' });

    const wb = XLSX.readFile(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    const headers = rows[0];
    expect(headers).toContain('estado');
    expect(headers).toContain('fecha_subida');
    expect(headers).toContain('ultimo_error');
  });

  it('actualiza filas en orden no-secuencial', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file, 5);

    const tracker = new ProgressTracker(file);
    await tracker.update({ row: 4, state: 'subido' });
    await tracker.update({ row: 2, state: 'error', error: 'E1' });
    await tracker.update({ row: 6, state: 'subido' });

    const data = readXlsx(file);
    expect(data[0].estado).toBe('error'); // row 2
    expect(data[1].estado).toBe(''); // row 3, sin tocar
    expect(data[2].estado).toBe('subido'); // row 4
    expect(data[3].estado).toBe(''); // row 5
    expect(data[4].estado).toBe('subido'); // row 6
  });

  it('limpia el error al marcar como subido', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);

    const tracker = new ProgressTracker(file);
    await tracker.update({ row: 2, state: 'error', error: 'Primer fallo' });
    await tracker.update({ row: 2, state: 'subido' });

    const data = readXlsx(file);
    expect(data[0].estado).toBe('subido');
    expect(data[0].ultimo_error).toBe('');
  });

  it('preserva estilos, fills y data validations al modificar celdas', async () => {
    const file = path.join(tempDir, 'styled.xlsx');
    await createStyledXlsx(file);

    const tracker = new ProgressTracker(file);
    await tracker.update({ row: 2, state: 'subido' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet('Hoja1')!;

    expect(ws.getCell('A1').font?.italic).toBe(true);
    expect(ws.getCell('A1').font?.bold).toBe(true);

    const fill = ws.getCell('A2').fill as ExcelJS.FillPattern | undefined;
    expect(fill?.type).toBe('pattern');
    expect((fill?.fgColor as { argb?: string } | undefined)?.argb).toBe('FFFFEB9C');

    const validation = ws.getCell('B2').dataValidation;
    expect(validation?.type).toBe('list');
    expect(validation?.formulae?.[0]).toBe('"a,b,c"');
  });
});

describe('ProgressTracker - fallback sidecar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cae al sidecar si no se puede escribir al archivo', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);
    const tracker = new ProgressTracker(file);
    simulateLockedFile();

    const messages: string[] = [];
    const ok = await tracker.update({ row: 2, state: 'subido' }, (msg) => messages.push(msg));

    expect(ok).toBe(false);
    expect(fs.existsSync(file + '.progreso.json')).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain('progreso');
  });

  it('sidecar contiene el estado correcto', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);
    const tracker = new ProgressTracker(file);
    simulateLockedFile();

    await tracker.update({ row: 2, state: 'subido' });
    await tracker.update({ row: 3, state: 'error', error: 'fallo' });

    const sidecar = JSON.parse(fs.readFileSync(file + '.progreso.json', 'utf-8'));
    expect(sidecar.records).toHaveLength(2);
    expect(sidecar.records.find((r: any) => r.row === 2).state).toBe('subido');
    expect(sidecar.records.find((r: any) => r.row === 3).state).toBe('error');
  });

  it('solo muestra warning la primera vez', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);
    const tracker = new ProgressTracker(file);
    simulateLockedFile();

    const messages: string[] = [];
    await tracker.update({ row: 2, state: 'subido' }, (msg) => messages.push(msg));
    await tracker.update({ row: 3, state: 'subido' }, (msg) => messages.push(msg));
    await tracker.update({ row: 4, state: 'subido' }, (msg) => messages.push(msg));

    expect(messages).toHaveLength(1);
  });
});

describe('ProgressTracker - readStates', () => {
  it('lee estados desde los ArticleRow', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);
    const tracker = new ProgressTracker(file);
    await tracker.update({ row: 2, state: 'subido' });
    await tracker.update({ row: 3, state: 'error', error: 'e' });

    const { articles } = readArticles(file);
    const states = ProgressTracker.readStates(file, articles);

    expect(states.get(2)).toBe('subido');
    expect(states.get(3)).toBe('error');
  });

  it('el sidecar tiene prioridad sobre el archivo', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);
    const tracker = new ProgressTracker(file);
    await tracker.update({ row: 2, state: 'error', error: 'e' });

    const spy = simulateLockedFile();
    await tracker.update({ row: 2, state: 'subido' });
    spy.mockRestore();

    const { articles } = readArticles(file);
    const states = ProgressTracker.readStates(file, articles);

    expect(states.get(2)).toBe('subido');
  });
});

describe('ProgressTracker - sincronizarSidecar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mueve estados del sidecar al archivo original y borra el sidecar', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);
    const tracker = new ProgressTracker(file);

    const spy = simulateLockedFile();
    await tracker.update({ row: 2, state: 'subido' });
    await tracker.update({ row: 3, state: 'error', error: 'e1' });

    expect(fs.existsSync(file + '.progreso.json')).toBe(true);
    spy.mockRestore();

    const ok = await tracker.trySyncSidecar();
    expect(ok).toBe(true);
    expect(fs.existsSync(file + '.progreso.json')).toBe(false);

    const data = readXlsx(file);
    expect(data[0].estado).toBe('subido');
    expect(data[1].estado).toBe('error');
    expect(data[1].ultimo_error).toBe('e1');
  });

  it('retorna true si no hay sidecar (nada que hacer)', async () => {
    const file = path.join(tempDir, 'test.xlsx');
    createBaseXlsx(file);
    const tracker = new ProgressTracker(file);

    expect(await tracker.trySyncSidecar()).toBe(true);
  });
});
