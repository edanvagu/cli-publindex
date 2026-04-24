import * as XLSX from 'xlsx';
import type { ArticleRow } from '../../../src/entities/articles/types';
import type { AuthorRow } from '../../../src/entities/authors/types';
import type { ReviewerRow } from '../../../src/entities/reviewers/types';
import {
  ARTICLES_SHEET_NAME,
  AUTHORS_SHEET_NAME,
  REVIEWERS_SHEET_NAME,
} from './constants';

export interface ParsedWorkbook {
  articles: ArticleRow[];
  authors: AuthorRow[];
  reviewers: ReviewerRow[];
}

export function parseWorkbookFromBuffer(buf: ArrayBuffer): ParsedWorkbook {
  const wb = XLSX.read(buf, { type: 'array' });
  return {
    articles: readSheet<ArticleRow>(wb, ARTICLES_SHEET_NAME),
    authors: readSheet<AuthorRow>(wb, AUTHORS_SHEET_NAME),
    reviewers: readSheet<ReviewerRow>(wb, REVIEWERS_SHEET_NAME),
  };
}

export async function parseExcelFile(file: File): Promise<ParsedWorkbook> {
  const buf = await file.arrayBuffer();
  return parseWorkbookFromBuffer(buf);
}

function readSheet<T extends { _fila: number }>(
  wb: XLSX.WorkBook,
  sheetName: string,
): T[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  return raw.map((r, i) => ({ ...r, _fila: i + 2 } as unknown as T));
}
