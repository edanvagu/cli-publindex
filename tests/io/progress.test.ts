import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as XLSX from 'xlsx';
import { ProgressTracker } from '../../src/io/progress';
import { readArticles } from '../../src/io/excel-reader';

function simularArchivoBloqueado() {
  return vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {
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

function crearXlsxBase(rutaArchivo: string, rows: number = 2) {
  const headers = ['titulo', 'url'];
  const data: unknown[][] = [headers];
  for (let i = 0; i < rows; i++) {
    data.push([`Título ${i + 1}`, `https://example.com/${i + 1}`]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, rutaArchivo);
}

function leerXlsx(ruta: string): Record<string, string>[] {
  const wb = XLSX.readFile(ruta);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
}

describe('ProgressTracker - XLSX', () => {
  it('marca un artículo como subido en el Excel', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);

    const gestor = new ProgressTracker(file);
    const ok = gestor.update({ row: 2, state: 'subido' });

    expect(ok).toBe(true);
    const data = leerXlsx(file);
    expect(data[0].estado).toBe('subido');
    expect(data[0].fecha_subida).toBeTruthy();
  });

  it('marca un artículo como error con mensaje', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);

    const gestor = new ProgressTracker(file);
    gestor.update({ row: 2, state: 'error', error: 'HTTP 500' });

    const data = leerXlsx(file);
    expect(data[0].estado).toBe('error');
    expect(data[0].ultimo_error).toBe('HTTP 500');
  });

  it('agrega las columnas estado, fecha_subida, ultimo_error si no existen', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);

    const gestor = new ProgressTracker(file);
    gestor.update({ row: 2, state: 'subido' });

    const wb = XLSX.readFile(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    const headers = rows[0];
    expect(headers).toContain('estado');
    expect(headers).toContain('fecha_subida');
    expect(headers).toContain('ultimo_error');
  });

  it('actualiza filas en orden no-secuencial', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file, 5);

    const gestor = new ProgressTracker(file);
    gestor.update({ row: 4, state: 'subido' });
    gestor.update({ row: 2, state: 'error', error: 'E1' });
    gestor.update({ row: 6, state: 'subido' });

    const data = leerXlsx(file);
    expect(data[0].estado).toBe('error'); // row 2
    expect(data[1].estado).toBe('');       // row 3, sin tocar
    expect(data[2].estado).toBe('subido'); // row 4
    expect(data[3].estado).toBe('');       // row 5
    expect(data[4].estado).toBe('subido'); // row 6
  });

  it('limpia el error al marcar como subido', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);

    const gestor = new ProgressTracker(file);
    gestor.update({ row: 2, state: 'error', error: 'Primer fallo' });
    gestor.update({ row: 2, state: 'subido' });

    const data = leerXlsx(file);
    expect(data[0].estado).toBe('subido');
    expect(data[0].ultimo_error).toBe('');
  });
});

describe('ProgressTracker - fallback sidecar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cae al sidecar si no se puede escribir al archivo', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);
    const gestor = new ProgressTracker(file);
    simularArchivoBloqueado();

    const messages: string[] = [];
    const ok = gestor.update({ row: 2, state: 'subido' }, msg => messages.push(msg));

    expect(ok).toBe(false);
    expect(fs.existsSync(file + '.progreso.json')).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain('progreso');
  });

  it('sidecar contiene el estado correcto', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);
    const gestor = new ProgressTracker(file);
    simularArchivoBloqueado();

    gestor.update({ row: 2, state: 'subido' });
    gestor.update({ row: 3, state: 'error', error: 'fallo' });

    const sidecar = JSON.parse(fs.readFileSync(file + '.progreso.json', 'utf-8'));
    expect(sidecar.records).toHaveLength(2);
    expect(sidecar.records.find((r: any) => r.row === 2).state).toBe('subido');
    expect(sidecar.records.find((r: any) => r.row === 3).state).toBe('error');
  });

  it('solo muestra warning la primera vez', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);
    const gestor = new ProgressTracker(file);
    simularArchivoBloqueado();

    const messages: string[] = [];
    gestor.update({ row: 2, state: 'subido' }, msg => messages.push(msg));
    gestor.update({ row: 3, state: 'subido' }, msg => messages.push(msg));
    gestor.update({ row: 4, state: 'subido' }, msg => messages.push(msg));

    expect(messages).toHaveLength(1);
  });
});

describe('ProgressTracker - readStates', () => {
  it('lee estados desde los ArticleRow', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);
    const gestor = new ProgressTracker(file);
    gestor.update({ row: 2, state: 'subido' });
    gestor.update({ row: 3, state: 'error', error: 'e' });

    const { articles } = readArticles(file);
    const estados = ProgressTracker.readStates(file, articles);

    expect(estados.get(2)).toBe('subido');
    expect(estados.get(3)).toBe('error');
  });

  it('el sidecar tiene prioridad sobre el archivo', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);
    const gestor = new ProgressTracker(file);
    gestor.update({ row: 2, state: 'error', error: 'e' });

    const spy = simularArchivoBloqueado();
    gestor.update({ row: 2, state: 'subido' });
    spy.mockRestore();

    const { articles } = readArticles(file);
    const estados = ProgressTracker.readStates(file, articles);

    expect(estados.get(2)).toBe('subido');
  });
});

describe('ProgressTracker - sincronizarSidecar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mueve estados del sidecar al archivo original y borra el sidecar', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);
    const gestor = new ProgressTracker(file);

    const spy = simularArchivoBloqueado();
    gestor.update({ row: 2, state: 'subido' });
    gestor.update({ row: 3, state: 'error', error: 'e1' });

    expect(fs.existsSync(file + '.progreso.json')).toBe(true);
    spy.mockRestore();

    const ok = gestor.trySyncSidecar();
    expect(ok).toBe(true);
    expect(fs.existsSync(file + '.progreso.json')).toBe(false);

    const data = leerXlsx(file);
    expect(data[0].estado).toBe('subido');
    expect(data[1].estado).toBe('error');
    expect(data[1].ultimo_error).toBe('e1');
  });

  it('retorna true si no hay sidecar (nada que hacer)', () => {
    const file = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(file);
    const gestor = new ProgressTracker(file);

    expect(gestor.trySyncSidecar()).toBe(true);
  });
});
