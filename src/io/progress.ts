import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { ArticleRow, ArticleState } from '../entities/articles/types';
import {
  STATE_COLUMNS,
  ARTICLE_STATES,
  ARTICLES_SHEET_NAME,
  AUTHORS_SHEET_NAME,
  REVIEWERS_SHEET_NAME,
  ARTICLE_ID_COLUMN,
  AUTHORS_SHEET_HEADERS,
  AUTHOR_COLUMNS,
  REVIEWERS_SHEET_HEADERS,
  REVIEWER_COLUMNS,
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

export interface ReviewerStateUpdate {
  row: number;
  uploadState?: string;
  hasCvlac?: string;
  requiredAction?: string;
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
  reviewers?: ReviewerSidecarRecord[];
}

interface AuthorSidecarRecord {
  row: number;
  uploadState?: string;
  hasCvlac?: string;
  requiredAction?: string;
  articleId?: number;
}

interface ReviewerSidecarRecord {
  row: number;
  uploadState?: string;
  hasCvlac?: string;
  requiredAction?: string;
}

interface SheetIndex {
  ws: ExcelJS.Worksheet;
  // Map normalized header name → 1-based column index. Built from row 1 plus any columns we appended ourselves.
  headerCols: Map<string, number>;
}

interface WorkbookCache {
  workbook: ExcelJS.Workbook;
  articles: SheetIndex;
  authors: SheetIndex | null;
  reviewers: SheetIndex | null;
}

// Persists upload state into the original Excel file. Cells are updated in place via ExcelJS so the original styling (italics, dropdowns, conditional formatting, fills) survives every write. If the file is locked (Excel has it open), writes fall back to a JSON sidecar that is merged back into the workbook on the next `trySyncSidecar` call.
export class ProgressTracker {
  private filePath: string;
  private sidecarPath: string;
  private useSidecar: boolean = false;
  private warningShown: boolean = false;
  private cache: WorkbookCache | null = null;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.sidecarPath = this.filePath + '.progreso.json';
  }

  async update(update: StateUpdate, onWarning?: (msg: string) => void): Promise<boolean> {
    if (this.useSidecar) {
      this.updateSidecar(update);
      return false;
    }

    try {
      await this.updateXlsx(update);
      return true;
    } catch {
      this.fallbackToSidecar(onWarning);
      this.updateSidecar(update);
      return false;
    }
  }

  // After an article is created, writes its `articleId` to every row in the Autores sheet whose `titulo_articulo` matches. No-op when the workbook has no Autores sheet (older templates without the second sheet). When the tracker already fell back to sidecar mode, defer: trySyncSidecar() will fan the ID out to the Autores rows when it merges the article records, so attempting an xlsx write here would only surface a misleading EBUSY warning.
  async propagateArticleIdToAuthors(
    articleTitle: string,
    articleId: number,
    onWarning?: (msg: string) => void,
  ): Promise<number> {
    if (this.useSidecar) return 0;
    try {
      const cache = await this.ensureCache();
      if (!cache.authors) return 0;

      const titleCol = cache.authors.headerCols.get(AUTHOR_COLUMNS.TITULO_ARTICULO);
      const idCol = cache.authors.headerCols.get(AUTHOR_COLUMNS.ID_ARTICULO);
      if (!titleCol || !idCol) return 0;

      const target = (articleTitle || '').trim();
      let count = 0;
      const ws = cache.authors.ws;
      // Row 1 is the header; data rows start at 2. ws.rowCount tracks the highest used row.
      for (let r = 2; r <= ws.rowCount; r++) {
        const v = String(ws.getCell(r, titleCol).value ?? '').trim();
        if (v === target) {
          ws.getCell(r, idCol).value = articleId;
          count++;
        }
      }

      if (count > 0) await this.writeWorkbook();
      return count;
    } catch (err) {
      onWarning?.(`No se pudo propagar id_articulo a hoja Autores: ${(err as Error).message}`);
      return 0;
    }
  }

  async updateAuthor(update: AuthorStateUpdate, onWarning?: (msg: string) => void): Promise<boolean> {
    if (this.useSidecar) {
      this.updateAuthorSidecar(update);
      return false;
    }

    try {
      const cache = await this.ensureCache();
      if (!cache.authors) {
        throw new Error('Hoja Autores no existe en el archivo');
      }

      const ws = cache.authors.ws;
      if (update.row < 2) {
        throw new Error(`Fila ${update.row} fuera de rango en hoja Autores`);
      }

      const setCol = (key: string, value: unknown) => {
        const col = cache.authors!.headerCols.get(key);
        if (col) ws.getCell(update.row, col).value = value as ExcelJS.CellValue;
      };
      if (update.uploadState !== undefined) setCol(AUTHOR_COLUMNS.ESTADO_CARGA, update.uploadState);
      if (update.hasCvlac !== undefined) setCol(AUTHOR_COLUMNS.TIENE_CVLAC, update.hasCvlac);
      if (update.requiredAction !== undefined) setCol(AUTHOR_COLUMNS.ACCION_REQUERIDA, update.requiredAction);
      if (update.articleId !== undefined) setCol(AUTHOR_COLUMNS.ID_ARTICULO, update.articleId);

      await this.writeWorkbook();
      return true;
    } catch {
      this.fallbackToSidecar(onWarning);
      this.updateAuthorSidecar(update);
      return false;
    }
  }

  async updateReviewer(update: ReviewerStateUpdate, onWarning?: (msg: string) => void): Promise<boolean> {
    if (this.useSidecar) {
      this.updateReviewerSidecar(update);
      return false;
    }

    try {
      const cache = await this.ensureCache();
      if (!cache.reviewers) {
        throw new Error('Hoja Evaluadores no existe en el archivo');
      }

      const ws = cache.reviewers.ws;
      if (update.row < 2) {
        throw new Error(`Fila ${update.row} fuera de rango en hoja Evaluadores`);
      }

      const setCol = (key: string, value: unknown) => {
        const col = cache.reviewers!.headerCols.get(key);
        if (col) ws.getCell(update.row, col).value = value as ExcelJS.CellValue;
      };
      if (update.uploadState !== undefined) setCol(REVIEWER_COLUMNS.ESTADO_CARGA, update.uploadState);
      if (update.hasCvlac !== undefined) setCol(REVIEWER_COLUMNS.TIENE_CVLAC, update.hasCvlac);
      if (update.requiredAction !== undefined) setCol(REVIEWER_COLUMNS.ACCION_REQUERIDA, update.requiredAction);

      await this.writeWorkbook();
      return true;
    } catch {
      this.fallbackToSidecar(onWarning);
      this.updateReviewerSidecar(update);
      return false;
    }
  }

  async trySyncSidecar(): Promise<boolean> {
    if (!fs.existsSync(this.sidecarPath)) return true;

    try {
      const sidecar: ProgressSidecar = JSON.parse(fs.readFileSync(this.sidecarPath, 'utf-8'));
      this.cache = null; // force re-read: the user may have edited the file
      const cache = await this.ensureCache();

      if (sidecar.records.length > 0) {
        const articlesWs = cache.articles.ws;
        const stateCol = cache.articles.headerCols.get(STATE_COLUMNS.STATE);
        const dateCol = cache.articles.headerCols.get(STATE_COLUMNS.UPLOAD_DATE);
        const errorCol = cache.articles.headerCols.get(STATE_COLUMNS.LAST_ERROR);
        const idCol = cache.articles.headerCols.get(ARTICLE_ID_COLUMN);

        for (const rec of sidecar.records) {
          if (rec.row < 2) continue;
          if (stateCol) articlesWs.getCell(rec.row, stateCol).value = rec.state;
          if (dateCol && rec.uploadDate) articlesWs.getCell(rec.row, dateCol).value = rec.uploadDate;
          if (errorCol && rec.error) articlesWs.getCell(rec.row, errorCol).value = rec.error;
          if (idCol && rec.articleId !== undefined) articlesWs.getCell(rec.row, idCol).value = rec.articleId;
        }
        this.propagateSidecarArticleIdsToAuthors(cache, sidecar.records);
      }

      if (sidecar.authors && cache.authors && sidecar.authors.length > 0) {
        const ws = cache.authors.ws;
        const cols = cache.authors.headerCols;
        for (const rec of sidecar.authors) {
          if (rec.row < 2) continue;
          const setCol = (key: string, value: unknown) => {
            const c = cols.get(key);
            if (c) ws.getCell(rec.row, c).value = value as ExcelJS.CellValue;
          };
          if (rec.uploadState !== undefined) setCol(AUTHOR_COLUMNS.ESTADO_CARGA, rec.uploadState);
          if (rec.hasCvlac !== undefined) setCol(AUTHOR_COLUMNS.TIENE_CVLAC, rec.hasCvlac);
          if (rec.requiredAction !== undefined) setCol(AUTHOR_COLUMNS.ACCION_REQUERIDA, rec.requiredAction);
          if (rec.articleId !== undefined) setCol(AUTHOR_COLUMNS.ID_ARTICULO, rec.articleId);
        }
      }

      if (sidecar.reviewers && cache.reviewers && sidecar.reviewers.length > 0) {
        const ws = cache.reviewers.ws;
        const cols = cache.reviewers.headerCols;
        for (const rec of sidecar.reviewers) {
          if (rec.row < 2) continue;
          const setCol = (key: string, value: unknown) => {
            const c = cols.get(key);
            if (c) ws.getCell(rec.row, c).value = value as ExcelJS.CellValue;
          };
          if (rec.uploadState !== undefined) setCol(REVIEWER_COLUMNS.ESTADO_CARGA, rec.uploadState);
          if (rec.hasCvlac !== undefined) setCol(REVIEWER_COLUMNS.TIENE_CVLAC, rec.hasCvlac);
          if (rec.requiredAction !== undefined) setCol(REVIEWER_COLUMNS.ACCION_REQUERIDA, rec.requiredAction);
        }
      }

      await this.writeWorkbook();
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
        // Corrupt sidecar — fall back to whatever state lives in the workbook.
      }
    }

    return states;
  }

  // Mirrors the live `propagateArticleIdToAuthors` but drives off the articles' own titulo stored in the cache (not passed in) — so trySyncSidecar can recover the live propagation that was skipped while useSidecar was active.
  private propagateSidecarArticleIdsToAuthors(cache: WorkbookCache, records: ProgressSidecar['records']): void {
    if (!cache.authors) return;
    const articlesTituloCol = cache.articles.headerCols.get('titulo');
    const authorsTituloCol = cache.authors.headerCols.get(AUTHOR_COLUMNS.TITULO_ARTICULO);
    const authorsIdCol = cache.authors.headerCols.get(AUTHOR_COLUMNS.ID_ARTICULO);
    if (!articlesTituloCol || !authorsTituloCol || !authorsIdCol) return;

    const articlesWs = cache.articles.ws;
    const authorsWs = cache.authors.ws;

    for (const rec of records) {
      if (rec.articleId === undefined || rec.row < 2) continue;
      const titulo = String(articlesWs.getCell(rec.row, articlesTituloCol).value ?? '').trim();
      if (!titulo) continue;
      for (let r = 2; r <= authorsWs.rowCount; r++) {
        if (String(authorsWs.getCell(r, authorsTituloCol).value ?? '').trim() === titulo) {
          authorsWs.getCell(r, authorsIdCol).value = rec.articleId;
        }
      }
    }
  }

  private fallbackToSidecar(onWarning?: (msg: string) => void): void {
    if (this.warningShown) return;
    this.warningShown = true;
    this.useSidecar = true;
    this.cache = null;
    onWarning?.(
      `No se puede escribir al archivo original (probablemente está abierto en Excel). ` +
        `Guardando progreso en ${path.basename(this.sidecarPath)}. ` +
        `Cierre el archivo Excel para que el progreso se guarde ahí directamente.`,
    );
  }

  private async ensureCache(): Promise<WorkbookCache> {
    if (this.cache) return this.cache;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);

    const articlesWs = workbook.getWorksheet(ARTICLES_SHEET_NAME) ?? workbook.worksheets[0];
    if (!articlesWs) {
      throw new Error('El archivo no contiene hojas');
    }
    const authorsWs = workbook.getWorksheet(AUTHORS_SHEET_NAME) ?? null;
    const reviewersWs = workbook.getWorksheet(REVIEWERS_SHEET_NAME) ?? null;

    const articles: SheetIndex = {
      ws: articlesWs,
      headerCols: indexHeaders(articlesWs, [
        STATE_COLUMNS.STATE,
        STATE_COLUMNS.UPLOAD_DATE,
        STATE_COLUMNS.LAST_ERROR,
        ARTICLE_ID_COLUMN,
      ]),
    };
    const authors: SheetIndex | null = authorsWs
      ? { ws: authorsWs, headerCols: indexHeaders(authorsWs, AUTHORS_SHEET_HEADERS) }
      : null;
    const reviewers: SheetIndex | null = reviewersWs
      ? { ws: reviewersWs, headerCols: indexHeaders(reviewersWs, REVIEWERS_SHEET_HEADERS) }
      : null;

    this.cache = { workbook, articles, authors, reviewers };
    return this.cache;
  }

  // Pulled out so tests can stub it via `vi.spyOn(ProgressTracker.prototype as any, 'writeWorkbook')` to simulate a locked-file scenario without touching the real filesystem.
  private async writeWorkbook(): Promise<void> {
    if (!this.cache) return;
    await this.cache.workbook.xlsx.writeFile(this.filePath);
  }

  private async updateXlsx(update: StateUpdate): Promise<void> {
    const cache = await this.ensureCache();
    const ws = cache.articles.ws;

    if (update.row < 2) {
      throw new Error(`Fila ${update.row} fuera de rango`);
    }

    const stateCol = cache.articles.headerCols.get(STATE_COLUMNS.STATE);
    const dateCol = cache.articles.headerCols.get(STATE_COLUMNS.UPLOAD_DATE);
    const errorCol = cache.articles.headerCols.get(STATE_COLUMNS.LAST_ERROR);
    const idCol = cache.articles.headerCols.get(ARTICLE_ID_COLUMN);

    if (stateCol) ws.getCell(update.row, stateCol).value = update.state;
    if (update.state === ARTICLE_STATES.UPLOADED) {
      if (dateCol) ws.getCell(update.row, dateCol).value = new Date().toISOString();
      if (errorCol) ws.getCell(update.row, errorCol).value = '';
    } else if (update.state === ARTICLE_STATES.ERROR) {
      if (errorCol) ws.getCell(update.row, errorCol).value = update.error || '';
    }
    if (update.articleId !== undefined && idCol) {
      ws.getCell(update.row, idCol).value = update.articleId;
    }

    await this.writeWorkbook();
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

    const idx = sidecar.records.findIndex((r) => r.row === update.row);
    if (idx >= 0) sidecar.records[idx] = rec;
    else sidecar.records.push(rec);
    sidecar.lastUpdated = new Date().toISOString();

    fs.writeFileSync(this.sidecarPath, JSON.stringify(sidecar, null, 2), 'utf-8');
  }

  private updateAuthorSidecar(update: AuthorStateUpdate) {
    const sidecar = this.readSidecar();
    sidecar.authors = sidecar.authors ?? [];

    const idx = sidecar.authors.findIndex((r) => r.row === update.row);
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

  private updateReviewerSidecar(update: ReviewerStateUpdate) {
    const sidecar = this.readSidecar();
    sidecar.reviewers = sidecar.reviewers ?? [];

    const idx = sidecar.reviewers.findIndex((r) => r.row === update.row);
    const rec: ReviewerSidecarRecord = {
      row: update.row,
      uploadState: update.uploadState,
      hasCvlac: update.hasCvlac,
      requiredAction: update.requiredAction,
    };
    if (idx >= 0) sidecar.reviewers[idx] = rec;
    else sidecar.reviewers.push(rec);
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

// Builds a normalized-header → column index map. If any of `appendIfMissing` headers are absent, appends them at the end of row 1 (preserving every existing styled cell). The append path covers older templates that were created before the state columns were standardized.
function indexHeaders(ws: ExcelJS.Worksheet, appendIfMissing: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  const headerRow = ws.getRow(1);
  // ws.columnCount can lag behind getRow(1) when columns were added implicitly; iterate a generous bound.
  const max = Math.max(ws.columnCount, headerRow.cellCount, 1);
  for (let c = 1; c <= max; c++) {
    const raw = headerRow.getCell(c).value;
    if (raw === null || raw === undefined || raw === '') continue;
    const key = normalizeHeader(String(raw));
    if (!map.has(key)) map.set(key, c);
  }

  let next = max + 1;
  for (const wanted of appendIfMissing) {
    const key = normalizeHeader(wanted);
    if (map.has(key)) continue;
    headerRow.getCell(next).value = wanted;
    map.set(key, next);
    next++;
  }
  return map;
}
