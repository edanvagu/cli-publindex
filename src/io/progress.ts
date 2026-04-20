import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ArticleRow, ArticleState } from '../entities/articles/types';
import {
  STATE_COLUMNS, ARTICLE_STATES, ARTICLES_SHEET_NAME, AUTHORS_SHEET_NAME,
  ARTICLE_ID_COLUMN, AUTHORS_SHEET_HEADERS, AUTHOR_COLUMNS,
} from '../config/constants';
import { normalizeHeader } from './excel-reader';

export interface StateUpdate {
  row: number;
  state: ArticleState;
  error?: string;
  articleId?: number;
}

export interface AuthorStateUpdate {
  row: number;
  uploadState?: string;
  hasCvlac?: string;
  requiredAction?: string;
  articleId?: number;
}

export interface ProgressSidecar {
  file: string;
  lastUpdated: string;
  records: {
    row: number;
    state: ArticleState;
    uploadDate?: string;
    error?: string;
    articleId?: number;
  }[];
  authors?: AuthorSidecarRecord[];
}

interface AuthorSidecarRecord {
  row: number;
  uploadState?: string;
  hasCvlac?: string;
  requiredAction?: string;
  articleId?: number;
}

interface SheetCache {
  headers: string[];
  data: Record<string, unknown>[];
}

interface XlsxCache {
  workbook: XLSX.WorkBook;
  articlesSheetName: string;
  authorsSheetName: string | null;
  sheets: Map<string, SheetCache>;
  dirty: Set<string>;
}

/**
 * Encapsula la escritura del estado de carga al archivo Excel original.
 * Si el archivo está bloqueado (Excel abierto), usa un sidecar JSON como fallback.
 */
export class ProgressTracker {
  private filePath: string;
  private sidecarPath: string;
  private useSidecar: boolean = false;
  private warningShown: boolean = false;
  private xlsxCache: XlsxCache | null = null;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.sidecarPath = this.filePath + '.progreso.json';
  }

  update(update: StateUpdate, onWarning?: (msg: string) => void): boolean {
    if (this.useSidecar) {
      this.updateSidecar(update);
      return false;
    }

    try {
      this.updateXlsx(update);
      return true;
    } catch {
      this.fallbackToSidecar(onWarning);
      this.updateSidecar(update);
      return false;
    }
  }

  /**
   * Tras crear un artículo, escribe el `articleId` a todas las filas de la
   * hoja Autores cuyo `titulo_articulo` matchee. Silencioso si no hay hoja Autores.
   */
  propagateArticleIdToAuthors(
    articleTitle: string,
    articleId: number,
    onWarning?: (msg: string) => void,
  ): number {
    try {
      const cache = this.ensureXlsxCache();
      const authorsName = cache.authorsSheetName;
      if (!authorsName) return 0;

      const sheetCache = cache.sheets.get(authorsName)!;
      const titleCol = findHeader(sheetCache.headers, AUTHOR_COLUMNS.TITULO_ARTICULO);
      const idCol = findHeader(sheetCache.headers, AUTHOR_COLUMNS.ID_ARTICULO);
      if (!titleCol || !idCol) return 0;

      const target = (articleTitle || '').trim();
      let count = 0;
      for (const row of sheetCache.data) {
        const v = String(row[titleCol] ?? '').trim();
        if (v === target) {
          row[idCol] = articleId;
          count++;
        }
      }

      if (count > 0) this.flushXlsxCache(authorsName);
      return count;
    } catch (err) {
      onWarning?.(`No se pudo propagar id_articulo a hoja Autores: ${(err as Error).message}`);
      return 0;
    }
  }

  updateAuthor(update: AuthorStateUpdate, onWarning?: (msg: string) => void): boolean {
    if (this.useSidecar) {
      this.updateAuthorSidecar(update);
      return false;
    }

    try {
      const cache = this.ensureXlsxCache();
      if (!cache.authorsSheetName) {
        throw new Error('Hoja Autores no existe en el archivo');
      }

      const sheetCache = cache.sheets.get(cache.authorsSheetName)!;
      const index = update.row - 2;
      if (index < 0 || index >= sheetCache.data.length) {
        throw new Error(`Fila ${update.row} fuera de rango en hoja Autores`);
      }

      const row = sheetCache.data[index];
      const setCol = (key: string, value: unknown) => {
        const col = findHeader(sheetCache.headers, key) ?? key;
        row[col] = value;
      };
      if (update.uploadState !== undefined) setCol(AUTHOR_COLUMNS.ESTADO_CARGA, update.uploadState);
      if (update.hasCvlac !== undefined) setCol(AUTHOR_COLUMNS.TIENE_CVLAC, update.hasCvlac);
      if (update.requiredAction !== undefined) setCol(AUTHOR_COLUMNS.ACCION_REQUERIDA, update.requiredAction);
      if (update.articleId !== undefined) setCol(AUTHOR_COLUMNS.ID_ARTICULO, update.articleId);

      this.flushXlsxCache(cache.authorsSheetName);
      return true;
    } catch {
      this.fallbackToSidecar(onWarning);
      this.updateAuthorSidecar(update);
      return false;
    }
  }

  trySyncSidecar(): boolean {
    if (!fs.existsSync(this.sidecarPath)) return true;

    try {
      const sidecar: ProgressSidecar = JSON.parse(fs.readFileSync(this.sidecarPath, 'utf-8'));
      this.xlsxCache = null; // force re-read: the user may have edited the file
      const cache = this.ensureXlsxCache();
      const articlesCache = cache.sheets.get(cache.articlesSheetName)!;

      if (sidecar.records.length > 0) {
        for (const rec of sidecar.records) {
          const index = rec.row - 2;
          if (index >= 0 && index < articlesCache.data.length) {
            articlesCache.data[index][STATE_COLUMNS.STATE] = rec.state;
            if (rec.uploadDate) articlesCache.data[index][STATE_COLUMNS.UPLOAD_DATE] = rec.uploadDate;
            if (rec.error) articlesCache.data[index][STATE_COLUMNS.LAST_ERROR] = rec.error;
            if (rec.articleId !== undefined) articlesCache.data[index][ARTICLE_ID_COLUMN] = rec.articleId;
          }
        }
        cache.dirty.add(cache.articlesSheetName);
      }

      if (sidecar.authors && cache.authorsSheetName && sidecar.authors.length > 0) {
        const authorsCache = cache.sheets.get(cache.authorsSheetName)!;
        const resolveCol = (key: string) => findHeader(authorsCache.headers, key) ?? key;
        for (const rec of sidecar.authors) {
          const index = rec.row - 2;
          if (index >= 0 && index < authorsCache.data.length) {
            const row = authorsCache.data[index];
            if (rec.uploadState !== undefined) row[resolveCol(AUTHOR_COLUMNS.ESTADO_CARGA)] = rec.uploadState;
            if (rec.hasCvlac !== undefined) row[resolveCol(AUTHOR_COLUMNS.TIENE_CVLAC)] = rec.hasCvlac;
            if (rec.requiredAction !== undefined) row[resolveCol(AUTHOR_COLUMNS.ACCION_REQUERIDA)] = rec.requiredAction;
            if (rec.articleId !== undefined) row[resolveCol(AUTHOR_COLUMNS.ID_ARTICULO)] = rec.articleId;
          }
        }
        cache.dirty.add(cache.authorsSheetName);
      }

      this.flushXlsxCache();
      fs.unlinkSync(this.sidecarPath);
      this.useSidecar = false;
      return true;
    } catch {
      return false;
    }
  }

  static readStates(filePath: string, articles: ArticleRow[]): Map<number, ArticleState> {
    const states = new Map<number, ArticleState>();
    const validValues: ArticleState[] = [ARTICLE_STATES.UPLOADED, ARTICLE_STATES.ERROR, ARTICLE_STATES.PENDING];

    for (const art of articles) {
      if (!art.estado) continue;
      const state = art.estado.toLowerCase() as ArticleState;
      if (validValues.includes(state)) {
        states.set(art._fila, state);
      }
    }

    const sidecarPath = path.resolve(filePath) + '.progreso.json';
    if (fs.existsSync(sidecarPath)) {
      try {
        const sidecar: ProgressSidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8'));
        for (const rec of sidecar.records) {
          states.set(rec.row, rec.state);
        }
      } catch {
        // sidecar corrupto: ignorar
      }
    }

    return states;
  }

  private fallbackToSidecar(onWarning?: (msg: string) => void): void {
    if (this.warningShown) return;
    this.warningShown = true;
    this.useSidecar = true;
    this.xlsxCache = null;
    onWarning?.(
      `No se puede escribir al archivo original (probablemente está abierto en Excel). ` +
      `Guardando progreso en ${path.basename(this.sidecarPath)}. ` +
      `Cierre el archivo Excel para que el progreso se guarde ahí directamente.`
    );
  }

  private ensureXlsxCache(): XlsxCache {
    if (this.xlsxCache) return this.xlsxCache;

    const workbook = XLSX.readFile(this.filePath);
    const sheets = new Map<string, SheetCache>();

    // La primera hoja es siempre la de artículos (por compat con plantillas viejas
    // sin nombres estandarizados). Buscamos también por nombre explícito.
    const articlesSheetName = workbook.SheetNames.find(n => n === ARTICLES_SHEET_NAME) ?? workbook.SheetNames[0];
    const authorsSheetName: string | null = workbook.SheetNames.find(n => n === AUTHORS_SHEET_NAME) ?? null;

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      const headers = headerRows.length > 0 ? (headerRows[0] as string[]).map(h => String(h)) : [];

      if (name === articlesSheetName) {
        const normalized = headers.map(normalizeHeader);
        for (const col of Object.values(STATE_COLUMNS)) {
          if (!normalized.includes(col)) headers.push(col);
        }
        if (!normalized.includes(ARTICLE_ID_COLUMN)) headers.push(ARTICLE_ID_COLUMN);
      }
      if (name === authorsSheetName) {
        const normalized = headers.map(normalizeHeader);
        for (const col of AUTHORS_SHEET_HEADERS) {
          if (!normalized.includes(col)) headers.push(col);
        }
      }

      sheets.set(name, { headers, data });
    }

    this.xlsxCache = { workbook, articlesSheetName, authorsSheetName, sheets, dirty: new Set() };
    return this.xlsxCache;
  }

  /**
   * Re-serializa SOLO las hojas marcadas como dirty y graba el workbook.
   * Cada `json_to_sheet` es O(filas × cols); limitar re-serialización a las
   * hojas modificadas ahorra trabajo cuando un update afecta solo una.
   */
  private flushXlsxCache(dirty?: string) {
    const cache = this.xlsxCache!;
    if (dirty) cache.dirty.add(dirty);

    for (const name of cache.dirty) {
      const sheetCache = cache.sheets.get(name);
      if (!sheetCache) continue;
      const previousSheet = cache.workbook.Sheets[name];
      const newSheet = XLSX.utils.json_to_sheet(sheetCache.data, { header: sheetCache.headers });
      if (previousSheet?.['!cols']) {
        newSheet['!cols'] = previousSheet['!cols'];
      }
      cache.workbook.Sheets[name] = newSheet;
    }
    XLSX.writeFile(cache.workbook, this.filePath);
    cache.dirty.clear();
  }

  private updateXlsx(update: StateUpdate) {
    const cache = this.ensureXlsxCache();
    const articlesCache = cache.sheets.get(cache.articlesSheetName)!;

    const index = update.row - 2;
    if (index < 0 || index >= articlesCache.data.length) {
      throw new Error(`Fila ${update.row} fuera de rango`);
    }

    articlesCache.data[index][STATE_COLUMNS.STATE] = update.state;
    if (update.state === ARTICLE_STATES.UPLOADED) {
      articlesCache.data[index][STATE_COLUMNS.UPLOAD_DATE] = new Date().toISOString();
      articlesCache.data[index][STATE_COLUMNS.LAST_ERROR] = '';
    } else if (update.state === ARTICLE_STATES.ERROR) {
      articlesCache.data[index][STATE_COLUMNS.LAST_ERROR] = update.error || '';
    }
    if (update.articleId !== undefined) {
      articlesCache.data[index][ARTICLE_ID_COLUMN] = update.articleId;
    }

    this.flushXlsxCache(cache.articlesSheetName);
  }

  private updateSidecar(update: StateUpdate) {
    const sidecar = this.readSidecar();
    const rec = {
      row: update.row,
      state: update.state,
      uploadDate: update.state === ARTICLE_STATES.UPLOADED ? new Date().toISOString() : undefined,
      error: update.error,
      articleId: update.articleId,
    };

    const idx = sidecar.records.findIndex(r => r.row === update.row);
    if (idx >= 0) sidecar.records[idx] = rec;
    else sidecar.records.push(rec);
    sidecar.lastUpdated = new Date().toISOString();

    fs.writeFileSync(this.sidecarPath, JSON.stringify(sidecar, null, 2), 'utf-8');
  }

  private updateAuthorSidecar(update: AuthorStateUpdate) {
    const sidecar = this.readSidecar();
    sidecar.authors = sidecar.authors ?? [];

    const idx = sidecar.authors.findIndex(r => r.row === update.row);
    const rec: AuthorSidecarRecord = {
      row: update.row,
      uploadState: update.uploadState,
      hasCvlac: update.hasCvlac,
      requiredAction: update.requiredAction,
      articleId: update.articleId,
    };
    if (idx >= 0) sidecar.authors[idx] = rec;
    else sidecar.authors.push(rec);
    sidecar.lastUpdated = new Date().toISOString();

    fs.writeFileSync(this.sidecarPath, JSON.stringify(sidecar, null, 2), 'utf-8');
  }

  private readSidecar(): ProgressSidecar {
    if (fs.existsSync(this.sidecarPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.sidecarPath, 'utf-8'));
      } catch {
        // corrupto: sobrescribir
      }
    }
    return { file: this.filePath, lastUpdated: '', records: [] };
  }
}

function findHeader(headers: string[], wanted: string): string | null {
  const target = normalizeHeader(wanted);
  for (const h of headers) {
    if (normalizeHeader(h) === target) return h;
  }
  return null;
}
