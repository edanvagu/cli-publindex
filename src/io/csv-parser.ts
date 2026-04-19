import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { ArticleRow } from '../entities/articles/types';
import { mapRawToArticleRow, isEmptyRow } from './row-mapper';
import { normalizeHeader } from './excel-reader';

export interface ParseResult {
  articles: ArticleRow[];
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

  const articles = rawRows
    .map((raw, i) => mapRawToArticleRow(raw, i + 2))
    .filter(row => !isEmptyRow(row));

  return { articles, headersNormalizados };
}
