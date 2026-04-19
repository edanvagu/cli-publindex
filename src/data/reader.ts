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
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
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

export function readArticulos(filePath: string): ReadResult {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Archivo no encontrado: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  let articulos: ArticuloRow[];

  if (ext === '.xlsx' || ext === '.xls') {
    articulos = parseXlsx(absolutePath);
  } else if (ext === '.csv') {
    articulos = parseCsv(absolutePath);
  } else {
    throw new Error(`Formato no soportado: ${ext}. Use .xlsx, .xls o .csv`);
  }

  // Detectar headers desconocidos
  const headersDesconocidos = detectHeadersDesconocidos(absolutePath, ext);

  // Clasificar por estado
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

function detectHeadersDesconocidos(filePath: string, ext: string): string[] {
  // Incluir columnas de estado como conocidas
  const known = new Set<string>([
    ...(HEADERS_EXCEL as readonly string[]),
    COLUMNAS_ESTADO.ESTADO,
    COLUMNAS_ESTADO.FECHA_SUBIDA,
    COLUMNAS_ESTADO.ULTIMO_ERROR,
  ]);
  let fileHeaders: string[] = [];

  if (ext === '.xlsx' || ext === '.xls') {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    if (rows.length > 0) {
      fileHeaders = (rows[0] as string[]).map(h => normalizeHeader(String(h)));
    }
  } else {
    const content = fs.readFileSync(filePath, 'utf-8');
    const firstLine = content.split('\n')[0];
    fileHeaders = firstLine.split(',').map(h => normalizeHeader(h.trim()));
  }

  return fileHeaders.filter(h => h && !known.has(h));
}
