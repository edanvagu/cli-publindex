import * as path from 'path';
import * as fs from 'fs';
import { ArticuloRow } from './types';
import { parseXlsx } from './xlsx-parser';
import { parseCsv } from './csv-parser';
import { HEADERS_EXCEL, COLUMNAS_ESTADO, ESTADOS_ARTICULO } from '../config/constants';

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export interface ReadResult {
  articulos: ArticuloRow[];
  headersDesconocidos: string[];
  yaSubidos: ArticuloRow[];
  pendientes: ArticuloRow[];
  conError: ArticuloRow[];
}

const HEADERS_CONOCIDOS: ReadonlySet<string> = new Set<string>([
  ...(HEADERS_EXCEL as readonly string[]),
  COLUMNAS_ESTADO.ESTADO,
  COLUMNAS_ESTADO.FECHA_SUBIDA,
  COLUMNAS_ESTADO.ULTIMO_ERROR,
]);

export function readArticulos(filePath: string): ReadResult {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Archivo no encontrado: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  let articulos: ArticuloRow[];
  let headersNormalizados: string[];

  if (ext === '.xlsx' || ext === '.xls') {
    ({ articulos, headersNormalizados } = parseXlsx(absolutePath));
  } else if (ext === '.csv') {
    ({ articulos, headersNormalizados } = parseCsv(absolutePath));
  } else {
    throw new Error(`Formato no soportado: ${ext}. Use .xlsx, .xls o .csv`);
  }

  const headersDesconocidos = headersNormalizados.filter(h => h && !HEADERS_CONOCIDOS.has(h));

  const yaSubidos: ArticuloRow[] = [];
  const pendientes: ArticuloRow[] = [];
  const conError: ArticuloRow[] = [];

  for (const art of articulos) {
    const estado = (art.estado || '').toLowerCase().trim();
    if (estado === ESTADOS_ARTICULO.SUBIDO) {
      yaSubidos.push(art);
    } else if (estado === ESTADOS_ARTICULO.ERROR) {
      conError.push(art);
    } else {
      pendientes.push(art);
    }
  }

  return { articulos, headersDesconocidos, yaSubidos, pendientes, conError };
}
