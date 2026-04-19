import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as XLSX from 'xlsx';
import { readArticulos, normalizeHeader } from '../../src/data/reader';

// === Helper para crear archivos temporales ===
let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publindex-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function crearXlsx(filas: Record<string, string>[], headers?: string[]): string {
  const filePath = path.join(tempDir, 'test.xlsx');
  const wb = XLSX.utils.book_new();
  const hdrs = headers || (filas.length > 0 ? Object.keys(filas[0]) : []);
  const data = [hdrs, ...filas.map(f => hdrs.map(h => f[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, filePath);
  return filePath;
}

function crearCsv(contenido: string): string {
  const filePath = path.join(tempDir, 'test.csv');
  fs.writeFileSync(filePath, contenido, 'utf-8');
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

describe('readArticulos - XLSX', () => {
  it('lee un archivo xlsx válido', () => {
    const archivo = crearXlsx([
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

    const result = readArticulos(archivo);
    expect(result.articulos).toHaveLength(1);
    expect(result.articulos[0].titulo).toBe('Artículo de prueba');
    expect(result.articulos[0]._fila).toBe(2);
  });

  it('lee múltiples filas', () => {
    const archivo = crearXlsx([
      { titulo: 'Art 1', url: 'https://a.com', gran_area: '1', area: '1A', tipo_documento: '1', palabras_clave: 'a', titulo_ingles: 'A', resumen: 'r' },
      { titulo: 'Art 2', url: 'https://b.com', gran_area: '2', area: '2A', tipo_documento: '2', palabras_clave: 'b', titulo_ingles: 'B', resumen: 's' },
      { titulo: 'Art 3', url: 'https://c.com', gran_area: '3', area: '3A', tipo_documento: '3', palabras_clave: 'c', titulo_ingles: 'C', resumen: 't' },
    ]);

    const result = readArticulos(archivo);
    expect(result.articulos).toHaveLength(3);
    expect(result.articulos.map(a => a._fila)).toEqual([2, 3, 4]);
  });

  it('filtra filas completamente vacías', () => {
    const archivo = crearXlsx([
      { titulo: 'Art 1', url: 'https://a.com' },
      { titulo: '', url: '' },
      { titulo: 'Art 3', url: 'https://c.com' },
    ]);

    const result = readArticulos(archivo);
    expect(result.articulos).toHaveLength(2);
  });

  it('normaliza headers con acentos y mayúsculas', () => {
    const archivo = crearXlsx(
      [{ Título: 'Con acento', URL: 'https://x.com', titulo_ingles: 'Title' }],
    );

    const result = readArticulos(archivo);
    expect(result.articulos[0].titulo).toBe('Con acento');
    expect(result.articulos[0].url).toBe('https://x.com');
  });
});

describe('readArticulos - CSV', () => {
  it('lee un archivo CSV válido', () => {
    const archivo = crearCsv(
      'titulo,url,gran_area,area,tipo_documento,palabras_clave,titulo_ingles,resumen\n' +
      '"Artículo CSV",https://example.com,5,5A,1,test,English Title,Resumen\n'
    );

    const result = readArticulos(archivo);
    expect(result.articulos).toHaveLength(1);
    expect(result.articulos[0].titulo).toBe('Artículo CSV');
  });

  it('maneja BOM al inicio del archivo', () => {
    const archivo = crearCsv(
      '\uFEFFtitulo,url\n"Con BOM",https://example.com\n'
    );

    const result = readArticulos(archivo);
    expect(result.articulos[0].titulo).toBe('Con BOM');
  });
});

describe('readArticulos - errores', () => {
  it('lanza error si el archivo no existe', () => {
    expect(() => readArticulos('/ruta/no/existe.xlsx'))
      .toThrow('Archivo no encontrado');
  });

  it('lanza error si el formato no es soportado', () => {
    const archivo = path.join(tempDir, 'test.txt');
    fs.writeFileSync(archivo, 'contenido');

    expect(() => readArticulos(archivo))
      .toThrow('Formato no soportado');
  });
});

describe('readArticulos - clasificación por estado', () => {
  it('clasifica artículos sin estado como pendientes', () => {
    const archivo = crearXlsx([
      { titulo: 'Art 1', url: 'https://a.com' },
      { titulo: 'Art 2', url: 'https://b.com' },
    ]);

    const result = readArticulos(archivo);
    expect(result.pendientes).toHaveLength(2);
    expect(result.yaSubidos).toHaveLength(0);
    expect(result.conError).toHaveLength(0);
  });

  it('clasifica artículos con estado "subido"', () => {
    const archivo = crearXlsx([
      { titulo: 'Art 1', url: 'https://a.com', estado: 'subido' },
      { titulo: 'Art 2', url: 'https://b.com', estado: 'pendiente' },
      { titulo: 'Art 3', url: 'https://c.com', estado: 'error' },
    ]);

    const result = readArticulos(archivo);
    expect(result.yaSubidos).toHaveLength(1);
    expect(result.pendientes).toHaveLength(1);
    expect(result.conError).toHaveLength(1);
  });

  it('reconoce estado en mayúsculas', () => {
    const archivo = crearXlsx([
      { titulo: 'Art 1', url: 'https://a.com', estado: 'SUBIDO' },
    ]);

    const result = readArticulos(archivo);
    expect(result.yaSubidos).toHaveLength(1);
  });
});

describe('readArticulos - headers desconocidos', () => {
  it('detecta columnas no reconocidas', () => {
    const archivo = crearXlsx([
      { titulo: 'Art', url: 'https://a.com', columna_rara: 'X' },
    ]);

    const result = readArticulos(archivo);
    expect(result.headersDesconocidos).toContain('columna_rara');
  });

  it('no reporta columnas de estado como desconocidas', () => {
    const archivo = crearXlsx([
      { titulo: 'Art', url: 'https://a.com', estado: '', fecha_subida: '', ultimo_error: '' },
    ]);

    const result = readArticulos(archivo);
    expect(result.headersDesconocidos).not.toContain('estado');
    expect(result.headersDesconocidos).not.toContain('fecha_subida');
    expect(result.headersDesconocidos).not.toContain('ultimo_error');
  });

  it('retorna array vacío si todos los headers son conocidos', () => {
    const archivo = crearXlsx([
      { titulo: 'Art', url: 'https://a.com' },
    ]);

    const result = readArticulos(archivo);
    expect(result.headersDesconocidos).toEqual([]);
  });
});
