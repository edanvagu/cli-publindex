import * as XLSX from 'xlsx';
import { ArticleRow } from '../entities/articles/types';
import { mapRawToArticleRow, isEmptyRow } from './row-mapper';
import { normalizeHeader } from './excel-reader';

export interface ParseResult {
  articles: ArticleRow[];
  normalizedHeaders: string[];
}

export function parseXlsx(filePath: string): ParseResult {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const normalizedHeaders = headerRows.length > 0
    ? (headerRows[0] as string[]).map(h => normalizeHeader(String(h ?? '')))
    : [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const articles = rawRows
    .map((raw, i) => mapRawToArticleRow(raw, i + 2))
    .filter(row => !isEmptyRow(row));

  return { articles, normalizedHeaders };
}
