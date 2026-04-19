import * as XLSX from 'xlsx';
import { ArticuloRow } from './types';
import { mapRawToArticuloRow, esFilaVacia } from './row-mapper';
import { normalizeHeader } from './reader';

export interface ParseResult {
  articulos: ArticuloRow[];
  headersNormalizados: string[];
}

export function parseXlsx(filePath: string): ParseResult {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const headersNormalizados = headerRows.length > 0
    ? (headerRows[0] as string[]).map(h => normalizeHeader(String(h ?? '')))
    : [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const articulos = rawRows
    .map((raw, i) => mapRawToArticuloRow(raw, i + 2))
    .filter(row => !esFilaVacia(row));

  return { articulos, headersNormalizados };
}
