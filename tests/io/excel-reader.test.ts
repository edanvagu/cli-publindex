import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as XLSX from 'xlsx';
import { readArticles, normalizeHeader } from '../../src/io/excel-reader';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publindex-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function createXlsx(rows: Record<string, string>[], headers?: string[]): string {
  const filePath = path.join(tempDir, 'test.xlsx');
  const wb = XLSX.utils.book_new();
  const hdrs = headers || (rows.length > 0 ? Object.keys(rows[0]) : []);
  const data = [hdrs, ...rows.map((f) => hdrs.map((h) => f[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, filePath);
  return filePath;
}

describe('normalizeHeader', () => {
  it('convierte a lowercase', () => {
    expect(normalizeHeader('TITULO')).toBe('titulo');
  });

  it('quita acentos', () => {
    expect(normalizeHeader('título')).toBe('titulo');
    expect(normalizeHeader('gran_área')).toBe('gran_area');
  });

  it('reemplaza espacios por underscore', () => {
    expect(normalizeHeader('gran area')).toBe('gran_area');
  });

  it('remueve caracteres especiales', () => {
    expect(normalizeHeader('palabras-clave!')).toBe('palabrasclave');
  });

  it('maneja string vacío', () => {
    expect(normalizeHeader('')).toBe('');
  });
});

describe('readArticles - XLSX', () => {
  it('lee un archivo xlsx válido', () => {
    const file = createXlsx([
      {
        titulo: 'Artículo de prueba',
        url: 'https://example.com',
        gran_area: '6',
        area: '6A',
        tipo_documento: '1',
        palabras_clave: 'test',
        titulo_ingles: 'Test Article',
        resumen: 'Resumen de prueba',
      },
    ]);

    const result = readArticles(file);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].titulo).toBe('Artículo de prueba');
    expect(result.articles[0]._fila).toBe(2);
  });

  it('lee múltiples filas', () => {
    const file = createXlsx([
      {
        titulo: 'Art 1',
        url: 'https://a.com',
        gran_area: '1',
        area: '1A',
        tipo_documento: '1',
        palabras_clave: 'a',
        titulo_ingles: 'A',
        resumen: 'r',
      },
      {
        titulo: 'Art 2',
        url: 'https://b.com',
        gran_area: '2',
        area: '2A',
        tipo_documento: '2',
        palabras_clave: 'b',
        titulo_ingles: 'B',
        resumen: 's',
      },
      {
        titulo: 'Art 3',
        url: 'https://c.com',
        gran_area: '3',
        area: '3A',
        tipo_documento: '3',
        palabras_clave: 'c',
        titulo_ingles: 'C',
        resumen: 't',
      },
    ]);

    const result = readArticles(file);
    expect(result.articles).toHaveLength(3);
    expect(result.articles.map((a) => a._fila)).toEqual([2, 3, 4]);
  });

  it('filtra filas completamente vacías', () => {
    const file = createXlsx([
      { titulo: 'Art 1', url: 'https://a.com' },
      { titulo: '', url: '' },
      { titulo: 'Art 3', url: 'https://c.com' },
    ]);

    const result = readArticles(file);
    expect(result.articles).toHaveLength(2);
  });

  it('normaliza headers con acentos y mayúsculas', () => {
    const file = createXlsx([{ Título: 'Con acento', URL: 'https://x.com', titulo_ingles: 'Title' }]);

    const result = readArticles(file);
    expect(result.articles[0].titulo).toBe('Con acento');
    expect(result.articles[0].url).toBe('https://x.com');
  });

  it('convierte celdas Date (escritas como fecha por Excel) a strings YYYY-MM-DD', () => {
    const filePath = path.join(tempDir, 'test-dates.xlsx');
    const wb = XLSX.utils.book_new();
    // Local-midnight Dates mirror how Excel itself stores dates: serial numbers without timezone, which SheetJS round-trips via the local-time convention. Using `Date.UTC` here would make the test depend on the runner's TZ.
    const ws = XLSX.utils.aoa_to_sheet([
      ['titulo', 'url', 'fecha_recepcion', 'fecha_aceptacion'],
      ['Art con fechas', 'https://x.com', new Date(2025, 3, 15), new Date(2025, 5, 20)],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    XLSX.writeFile(wb, filePath);

    const result = readArticles(filePath);
    expect(result.articles[0].fecha_recepcion).toBe('2025-04-15');
    expect(result.articles[0].fecha_aceptacion).toBe('2025-06-20');
  });
});

describe('readArticles - errores', () => {
  it('lanza error si el archivo no existe', () => {
    expect(() => readArticles('/ruta/no/existe.xlsx')).toThrow('Archivo no encontrado');
  });

  it('lanza error si el formato no es soportado', () => {
    const file = path.join(tempDir, 'test.txt');
    fs.writeFileSync(file, 'contenido');

    expect(() => readArticles(file)).toThrow('Formato no soportado');
  });
});

describe('readArticles - clasificación por estado', () => {
  it('clasifica artículos sin estado como pendientes', () => {
    const file = createXlsx([
      { titulo: 'Art 1', url: 'https://a.com' },
      { titulo: 'Art 2', url: 'https://b.com' },
    ]);

    const result = readArticles(file);
    expect(result.pending).toHaveLength(2);
    expect(result.alreadyUploaded).toHaveLength(0);
    expect(result.withError).toHaveLength(0);
  });

  it('clasifica artículos con estado "subido"', () => {
    const file = createXlsx([
      { titulo: 'Art 1', url: 'https://a.com', estado: 'subido' },
      { titulo: 'Art 2', url: 'https://b.com', estado: 'pendiente' },
      { titulo: 'Art 3', url: 'https://c.com', estado: 'error' },
    ]);

    const result = readArticles(file);
    expect(result.alreadyUploaded).toHaveLength(1);
    expect(result.pending).toHaveLength(1);
    expect(result.withError).toHaveLength(1);
  });

  it('reconoce estado en mayúsculas', () => {
    const file = createXlsx([{ titulo: 'Art 1', url: 'https://a.com', estado: 'SUBIDO' }]);

    const result = readArticles(file);
    expect(result.alreadyUploaded).toHaveLength(1);
  });
});

describe('readArticles - headers desconocidos', () => {
  it('detecta columnas no reconocidas', () => {
    const file = createXlsx([{ titulo: 'Art', url: 'https://a.com', columna_rara: 'X' }]);

    const result = readArticles(file);
    expect(result.unknownHeaders).toContain('columna_rara');
  });

  it('no reporta columnas de estado como desconocidas', () => {
    const file = createXlsx([{ titulo: 'Art', url: 'https://a.com', estado: '', fecha_subida: '', ultimo_error: '' }]);

    const result = readArticles(file);
    expect(result.unknownHeaders).not.toContain('estado');
    expect(result.unknownHeaders).not.toContain('fecha_subida');
    expect(result.unknownHeaders).not.toContain('ultimo_error');
  });

  it('retorna array vacío si todos los headers son conocidos', () => {
    const file = createXlsx([{ titulo: 'Art', url: 'https://a.com' }]);

    const result = readArticles(file);
    expect(result.unknownHeaders).toEqual([]);
  });
});
