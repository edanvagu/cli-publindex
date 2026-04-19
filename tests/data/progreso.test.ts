import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as XLSX from 'xlsx';
import { GestorProgreso } from '../../src/data/progreso';
import { readArticulos } from '../../src/data/reader';

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

function crearXlsxBase(rutaArchivo: string, filas: number = 2) {
  const headers = ['titulo', 'url'];
  const data: unknown[][] = [headers];
  for (let i = 0; i < filas; i++) {
    data.push([`Título ${i + 1}`, `https://example.com/${i + 1}`]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, rutaArchivo);
}

function crearCsvBase(rutaArchivo: string, filas: number = 2) {
  const lineas = ['titulo,url'];
  for (let i = 0; i < filas; i++) {
    lineas.push(`Título ${i + 1},https://example.com/${i + 1}`);
  }
  fs.writeFileSync(rutaArchivo, lineas.join('\n'), 'utf-8');
}

function leerXlsx(ruta: string): Record<string, string>[] {
  const wb = XLSX.readFile(ruta);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
}

describe('GestorProgreso - XLSX', () => {
  it('marca un artículo como subido en el Excel', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);

    const gestor = new GestorProgreso(archivo);
    const ok = gestor.actualizar({ fila: 2, estado: 'subido' });

    expect(ok).toBe(true);
    const data = leerXlsx(archivo);
    expect(data[0].estado).toBe('subido');
    expect(data[0].fecha_subida).toBeTruthy();
  });

  it('marca un artículo como error con mensaje', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);

    const gestor = new GestorProgreso(archivo);
    gestor.actualizar({ fila: 2, estado: 'error', error: 'HTTP 500' });

    const data = leerXlsx(archivo);
    expect(data[0].estado).toBe('error');
    expect(data[0].ultimo_error).toBe('HTTP 500');
  });

  it('agrega las columnas estado, fecha_subida, ultimo_error si no existen', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);

    const gestor = new GestorProgreso(archivo);
    gestor.actualizar({ fila: 2, estado: 'subido' });

    const wb = XLSX.readFile(archivo);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    const headers = rows[0];
    expect(headers).toContain('estado');
    expect(headers).toContain('fecha_subida');
    expect(headers).toContain('ultimo_error');
  });

  it('actualiza filas en orden no-secuencial', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo, 5);

    const gestor = new GestorProgreso(archivo);
    gestor.actualizar({ fila: 4, estado: 'subido' });
    gestor.actualizar({ fila: 2, estado: 'error', error: 'E1' });
    gestor.actualizar({ fila: 6, estado: 'subido' });

    const data = leerXlsx(archivo);
    expect(data[0].estado).toBe('error'); // fila 2
    expect(data[1].estado).toBe('');       // fila 3, sin tocar
    expect(data[2].estado).toBe('subido'); // fila 4
    expect(data[3].estado).toBe('');       // fila 5
    expect(data[4].estado).toBe('subido'); // fila 6
  });

  it('limpia el error al marcar como subido', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);

    const gestor = new GestorProgreso(archivo);
    gestor.actualizar({ fila: 2, estado: 'error', error: 'Primer fallo' });
    gestor.actualizar({ fila: 2, estado: 'subido' });

    const data = leerXlsx(archivo);
    expect(data[0].estado).toBe('subido');
    expect(data[0].ultimo_error).toBe('');
  });
});

describe('GestorProgreso - CSV', () => {
  it('actualiza estado en CSV', () => {
    const archivo = path.join(tempDir, 'test.csv');
    crearCsvBase(archivo);

    const gestor = new GestorProgreso(archivo);
    const ok = gestor.actualizar({ fila: 2, estado: 'subido' });

    expect(ok).toBe(true);
    const contenido = fs.readFileSync(archivo, 'utf-8');
    expect(contenido).toContain('subido');
    expect(contenido.split('\n')[0]).toContain('estado');
  });

  it('agrega columnas estado al header del CSV', () => {
    const archivo = path.join(tempDir, 'test.csv');
    crearCsvBase(archivo);

    const gestor = new GestorProgreso(archivo);
    gestor.actualizar({ fila: 2, estado: 'subido' });

    const headers = fs.readFileSync(archivo, 'utf-8').split('\n')[0];
    expect(headers).toContain('estado');
    expect(headers).toContain('fecha_subida');
    expect(headers).toContain('ultimo_error');
  });
});

describe('GestorProgreso - fallback sidecar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cae al sidecar si no se puede escribir al archivo', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);
    const gestor = new GestorProgreso(archivo);
    simularArchivoBloqueado();

    const mensajes: string[] = [];
    const ok = gestor.actualizar({ fila: 2, estado: 'subido' }, msg => mensajes.push(msg));

    expect(ok).toBe(false);
    expect(fs.existsSync(archivo + '.progreso.json')).toBe(true);
    expect(mensajes.length).toBeGreaterThan(0);
    expect(mensajes[0]).toContain('progreso');
  });

  it('sidecar contiene el estado correcto', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);
    const gestor = new GestorProgreso(archivo);
    simularArchivoBloqueado();

    gestor.actualizar({ fila: 2, estado: 'subido' });
    gestor.actualizar({ fila: 3, estado: 'error', error: 'fallo' });

    const sidecar = JSON.parse(fs.readFileSync(archivo + '.progreso.json', 'utf-8'));
    expect(sidecar.registros).toHaveLength(2);
    expect(sidecar.registros.find((r: any) => r.fila === 2).estado).toBe('subido');
    expect(sidecar.registros.find((r: any) => r.fila === 3).estado).toBe('error');
  });

  it('solo muestra advertencia la primera vez', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);
    const gestor = new GestorProgreso(archivo);
    simularArchivoBloqueado();

    const mensajes: string[] = [];
    gestor.actualizar({ fila: 2, estado: 'subido' }, msg => mensajes.push(msg));
    gestor.actualizar({ fila: 3, estado: 'subido' }, msg => mensajes.push(msg));
    gestor.actualizar({ fila: 4, estado: 'subido' }, msg => mensajes.push(msg));

    expect(mensajes).toHaveLength(1);
  });
});

describe('GestorProgreso - leerEstados', () => {
  it('lee estados desde los ArticuloRow', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);
    const gestor = new GestorProgreso(archivo);
    gestor.actualizar({ fila: 2, estado: 'subido' });
    gestor.actualizar({ fila: 3, estado: 'error', error: 'e' });

    const { articulos } = readArticulos(archivo);
    const estados = GestorProgreso.leerEstados(archivo, articulos);

    expect(estados.get(2)).toBe('subido');
    expect(estados.get(3)).toBe('error');
  });

  it('el sidecar tiene prioridad sobre el archivo', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);
    const gestor = new GestorProgreso(archivo);
    gestor.actualizar({ fila: 2, estado: 'error', error: 'e' });

    const spy = simularArchivoBloqueado();
    gestor.actualizar({ fila: 2, estado: 'subido' });
    spy.mockRestore();

    const { articulos } = readArticulos(archivo);
    const estados = GestorProgreso.leerEstados(archivo, articulos);

    expect(estados.get(2)).toBe('subido');
  });
});

describe('GestorProgreso - sincronizarSidecar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mueve estados del sidecar al archivo original y borra el sidecar', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);
    const gestor = new GestorProgreso(archivo);

    const spy = simularArchivoBloqueado();
    gestor.actualizar({ fila: 2, estado: 'subido' });
    gestor.actualizar({ fila: 3, estado: 'error', error: 'e1' });

    expect(fs.existsSync(archivo + '.progreso.json')).toBe(true);
    spy.mockRestore();

    const ok = gestor.intentarSincronizarSidecar();
    expect(ok).toBe(true);
    expect(fs.existsSync(archivo + '.progreso.json')).toBe(false);

    const data = leerXlsx(archivo);
    expect(data[0].estado).toBe('subido');
    expect(data[1].estado).toBe('error');
    expect(data[1].ultimo_error).toBe('e1');
  });

  it('retorna true si no hay sidecar (nada que hacer)', () => {
    const archivo = path.join(tempDir, 'test.xlsx');
    crearXlsxBase(archivo);
    const gestor = new GestorProgreso(archivo);

    expect(gestor.intentarSincronizarSidecar()).toBe(true);
  });
});
