import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { ArticuloRow } from './types';
import { mapRawToArticuloRow, esFilaVacia } from './row-mapper';
import { normalizeHeader } from './reader';

export interface ParseResult {
  articulos: ArticuloRow[];
  headersNormalizados: string[];
}

export function parseCsv(filePath: string): ParseResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rawRows: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const headersNormalizados = rawRows.length > 0
    ? Object.keys(rawRows[0]).map(h => normalizeHeader(h))
    : [];

  const articulos = rawRows
    .map((raw, i) => mapRawToArticuloRow(raw, i + 2))
    .filter(row => !esFilaVacia(row));

  return { articulos, headersNormalizados };
}
