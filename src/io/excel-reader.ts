import * as path from 'path';
import * as fs from 'fs';
import { ArticleRow } from '../entities/articles/types';
import { parseXlsx } from './xlsx-parser';
import { EXCEL_HEADERS, STATE_COLUMNS, ARTICLE_STATES, ARTICLE_ID_COLUMN } from '../config/constants';

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
  articles: ArticleRow[];
  unknownHeaders: string[];
  alreadyUploaded: ArticleRow[];
  pending: ArticleRow[];
  withError: ArticleRow[];
}

const KNOWN_HEADERS: ReadonlySet<string> = new Set<string>([
  ...(EXCEL_HEADERS as readonly string[]),
  STATE_COLUMNS.STATE,
  STATE_COLUMNS.UPLOAD_DATE,
  STATE_COLUMNS.LAST_ERROR,
  ARTICLE_ID_COLUMN,
]);

export function readArticles(filePath: string): ReadResult {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Archivo no encontrado: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') {
    throw new Error(`Formato no soportado: ${ext}. Use .xlsx o .xls`);
  }

  const { articles, normalizedHeaders } = parseXlsx(absolutePath);

  const unknownHeaders = normalizedHeaders.filter(h => h && !KNOWN_HEADERS.has(h));

  const alreadyUploaded: ArticleRow[] = [];
  const pending: ArticleRow[] = [];
  const withError: ArticleRow[] = [];

  for (const art of articles) {
    const estado = (art.estado || '').toLowerCase().trim();
    if (estado === ARTICLE_STATES.UPLOADED) {
      alreadyUploaded.push(art);
    } else if (estado === ARTICLE_STATES.ERROR) {
      withError.push(art);
    } else {
      pending.push(art);
    }
  }

  return { articles, unknownHeaders, alreadyUploaded, pending, withError };
}
