import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ArticleRow, ArticleState } from '../entities/articles/types';
import {
  STATE_COLUMNS, ARTICLE_STATES, ARTICLES_SHEET_NAME, AUTHORS_SHEET_NAME,
  ARTICLE_ID_COLUMN, AUTHORS_SHEET_HEADERS,
} from '../config/constants';
import { normalizeHeader } from './excel-reader';

export interface StateUpdate {
  row: number;
  estado: ArticleState;
  error?: string;
  idArticulo?: number;
}

export interface AuthorStateUpdate {
  row: number;
  estadoCarga?: string;
  tieneCvlac?: string;
  accionRequerida?: string;
  idArticulo?: number;
}

export interface ProgresoSidecar {
  file: string;
  ultimaActualizacion: string;
  registros: {
    row: number;
    estado: ArticleState;
    fechaSubida?: string;
    error?: string;
    idArticulo?: number;
  }[];
  // Autores progress guardado en sidecar cuando el Excel está abierto.
  autores?: AuthorSidecarRecord[];
}

interface AuthorSidecarRecord {
  row: number;
  estadoCarga?: string;
  tieneCvlac?: string;
  accionRequerida?: string;
  idArticulo?: number;
}

interface SheetCache {
  headers: string[];
  data: Record<string, unknown>[];
}

interface CacheXlsx {
  workbook: XLSX.WorkBook;
  articulosSheetName: string;
  autoresSheetName: string | null;
  sheets: Map<string, SheetCache>;
}

/**
 * Encapsula la escritura del estado de carga al file Excel/CSV original.
 * Si el archivo está bloqueado (Excel abierto), usa un sidecar JSON como fallback.
 */
export class ProgressTracker {
  private rutaArchivo: string;
  private rutaSidecar: string;
  private esXlsx: boolean;
  private usarSidecar: boolean = false;
  private advertenciaMostrada: boolean = false;
  private cacheXlsx: CacheXlsx | null = null;

  constructor(rutaArchivo: string) {
    this.rutaArchivo = path.resolve(rutaArchivo);
    this.rutaSidecar = this.rutaArchivo + '.progreso.json';
    const ext = path.extname(this.rutaArchivo).toLowerCase();
    this.esXlsx = ext === '.xlsx' || ext === '.xls';
  }

  actualizar(actualizacion: StateUpdate, onWarning?: (msg: string) => void): boolean {
    if (this.usarSidecar) {
      this.actualizarSidecar(actualizacion);
      return false;
    }

    try {
      if (this.esXlsx) {
        this.actualizarXlsx(actualizacion);
      } else {
        this.actualizarCsv(actualizacion);
      }
      return true;
    } catch (err) {
      if (!this.advertenciaMostrada) {
        this.advertenciaMostrada = true;
        this.usarSidecar = true;
        this.cacheXlsx = null;
        onWarning?.(
          `No se puede escribir al archivo original (probablemente está abierto en Excel). ` +
          `Guardando progreso en ${path.basename(this.rutaSidecar)}. ` +
          `Cierre el archivo Excel para que el progreso se guarde ahí directamente.`
        );
      }
      this.actualizarSidecar(actualizacion);
      return false;
    }
  }

  /**
   * Después de crear un artículo, escribe el `idArticulo` a todas las filas
   * de la hoja Autores cuyo `titulo_articulo` matchee. Silencioso si no hay
   * hoja Autores (p.ej. CSV o plantillas viejas).
   */
  propagateArticleIdToAuthors(
    tituloArticulo: string,
    idArticulo: number,
    onWarning?: (msg: string) => void,
  ): number {
    if (!this.esXlsx) return 0;

    try {
      const cache = this.ensureXlsxCache();
      const autoresName = cache.autoresSheetName;
      if (!autoresName) return 0;

      const sheetCache = cache.sheets.get(autoresName)!;
      const tituloCol = findHeader(sheetCache.headers, 'titulo_articulo');
      const idCol = findHeader(sheetCache.headers, ARTICLE_ID_COLUMN);
      if (!tituloCol || !idCol) return 0;

      const target = (tituloArticulo || '').trim();
      let count = 0;
      for (const fila of sheetCache.data) {
        const v = String(fila[tituloCol] ?? '').trim();
        if (v === target) {
          fila[idCol] = idArticulo;
          count++;
        }
      }

      if (count > 0) this.escribirCacheXlsx();
      return count;
    } catch (err) {
      onWarning?.(`No se pudo propagar id_articulo a hoja Autores: ${(err as Error).message}`);
      return 0;
    }
  }

  actualizarAutor(actualizacion: AuthorStateUpdate, onWarning?: (msg: string) => void): boolean {
    if (this.usarSidecar) {
      this.actualizarAutorSidecar(actualizacion);
      return false;
    }

    if (!this.esXlsx) {
      // CSV no soporta autores; dejar sidecar.
      this.actualizarAutorSidecar(actualizacion);
      return false;
    }

    try {
      const cache = this.ensureXlsxCache();
      if (!cache.autoresSheetName) {
        throw new Error('Hoja Autores no existe en el archivo');
      }

      const sheetCache = cache.sheets.get(cache.autoresSheetName)!;
      const indice = actualizacion.row - 2;
      if (indice < 0 || indice >= sheetCache.data.length) {
        throw new Error(`Fila ${actualizacion.row} fuera de rango en hoja Autores`);
      }

      const fila = sheetCache.data[indice];
      if (actualizacion.estadoCarga !== undefined) fila['estado_carga'] = actualizacion.estadoCarga;
      if (actualizacion.tieneCvlac !== undefined) fila['tiene_cvlac'] = actualizacion.tieneCvlac;
      if (actualizacion.accionRequerida !== undefined) fila['accion_requerida'] = actualizacion.accionRequerida;
      if (actualizacion.idArticulo !== undefined) fila[ARTICLE_ID_COLUMN] = actualizacion.idArticulo;

      this.escribirCacheXlsx();
      return true;
    } catch (err) {
      if (!this.advertenciaMostrada) {
        this.advertenciaMostrada = true;
        this.usarSidecar = true;
        this.cacheXlsx = null;
        onWarning?.(
          `No se puede escribir al archivo original (probablemente está abierto en Excel). ` +
          `Guardando progreso en ${path.basename(this.rutaSidecar)}. ` +
          `Cierre el archivo Excel para que el progreso se guarde ahí directamente.`
        );
      }
      this.actualizarAutorSidecar(actualizacion);
      return false;
    }
  }

  trySyncSidecar(): boolean {
    if (!fs.existsSync(this.rutaSidecar)) return true;

    try {
      const sidecar: ProgresoSidecar = JSON.parse(fs.readFileSync(this.rutaSidecar, 'utf-8'));

      if (this.esXlsx) {
        this.cacheXlsx = null; // forzar re-lectura (el usuario pudo haber cambiado el file)
        const cache = this.ensureXlsxCache();
        const articulosCache = cache.sheets.get(cache.articulosSheetName)!;

        for (const reg of sidecar.registros) {
          const indice = reg.row - 2;
          if (indice >= 0 && indice < articulosCache.data.length) {
            articulosCache.data[indice][STATE_COLUMNS.STATE] = reg.estado;
            if (reg.fechaSubida) articulosCache.data[indice][STATE_COLUMNS.UPLOAD_DATE] = reg.fechaSubida;
            if (reg.error) articulosCache.data[indice][STATE_COLUMNS.LAST_ERROR] = reg.error;
            if (reg.idArticulo !== undefined) articulosCache.data[indice][ARTICLE_ID_COLUMN] = reg.idArticulo;
          }
        }

        if (sidecar.autores && cache.autoresSheetName) {
          const autoresCache = cache.sheets.get(cache.autoresSheetName)!;
          for (const reg of sidecar.autores) {
            const indice = reg.row - 2;
            if (indice >= 0 && indice < autoresCache.data.length) {
              const fila = autoresCache.data[indice];
              if (reg.estadoCarga !== undefined) fila['estado_carga'] = reg.estadoCarga;
              if (reg.tieneCvlac !== undefined) fila['tiene_cvlac'] = reg.tieneCvlac;
              if (reg.accionRequerida !== undefined) fila['accion_requerida'] = reg.accionRequerida;
              if (reg.idArticulo !== undefined) fila[ARTICLE_ID_COLUMN] = reg.idArticulo;
            }
          }
        }

        this.escribirCacheXlsx();
      } else {
        for (const reg of sidecar.registros) {
          this.actualizarCsv({ row: reg.row, estado: reg.estado, error: reg.error });
        }
      }

      fs.unlinkSync(this.rutaSidecar);
      this.usarSidecar = false;
      return true;
    } catch {
      return false;
    }
  }

  static readStates(rutaArchivo: string, articles: ArticleRow[]): Map<number, ArticleState> {
    const estados = new Map<number, ArticleState>();
    const valoresValidos: ArticleState[] = [ARTICLE_STATES.UPLOADED, ARTICLE_STATES.ERROR, ARTICLE_STATES.PENDING];

    for (const art of articles) {
      if (!art.estado) continue;
      const estado = art.estado.toLowerCase() as ArticleState;
      if (valoresValidos.includes(estado)) {
        estados.set(art._fila, estado);
      }
    }

    const rutaSidecar = path.resolve(rutaArchivo) + '.progreso.json';
    if (fs.existsSync(rutaSidecar)) {
      try {
        const sidecar: ProgresoSidecar = JSON.parse(fs.readFileSync(rutaSidecar, 'utf-8'));
        for (const reg of sidecar.registros) {
          estados.set(reg.row, reg.estado);
        }
      } catch {
        // sidecar corrupto: ignorar
      }
    }

    return estados;
  }

  private ensureXlsxCache(): CacheXlsx {
    if (this.cacheXlsx) return this.cacheXlsx;

    const workbook = XLSX.readFile(this.rutaArchivo);
    const sheets = new Map<string, SheetCache>();

    // La primera hoja es siempre la de artículos (por compatibilidad con plantillas viejas
    // que no tenían nombre estandarizado). Buscamos también por nombre explícito.
    let articulosSheetName = workbook.SheetNames.find(n => n === ARTICLES_SHEET_NAME) ?? workbook.SheetNames[0];
    let autoresSheetName: string | null = workbook.SheetNames.find(n => n === AUTHORS_SHEET_NAME) ?? null;

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      const headers = headerRows.length > 0 ? (headerRows[0] as string[]).map(h => String(h)) : [];

      if (name === articulosSheetName) {
        const normalized = headers.map(normalizeHeader);
        for (const col of Object.values(STATE_COLUMNS)) {
          if (!normalized.includes(col)) headers.push(col);
        }
        if (!normalized.includes(ARTICLE_ID_COLUMN)) headers.push(ARTICLE_ID_COLUMN);
      }
      if (name === autoresSheetName) {
        const normalized = headers.map(normalizeHeader);
        for (const col of AUTHORS_SHEET_HEADERS) {
          if (!normalized.includes(col)) headers.push(col);
        }
      }

      sheets.set(name, { headers, data });
    }

    this.cacheXlsx = { workbook, articulosSheetName, autoresSheetName, sheets };
    return this.cacheXlsx;
  }

  private escribirCacheXlsx() {
    const cache = this.cacheXlsx!;
    for (const [name, sheetCache] of cache.sheets) {
      const sheetAnterior = cache.workbook.Sheets[name];
      const nuevaSheet = XLSX.utils.json_to_sheet(sheetCache.data, { header: sheetCache.headers });
      if (sheetAnterior?.['!cols']) {
        nuevaSheet['!cols'] = sheetAnterior['!cols'];
      }
      cache.workbook.Sheets[name] = nuevaSheet;
    }
    XLSX.writeFile(cache.workbook, this.rutaArchivo);
  }

  private actualizarXlsx(actualizacion: StateUpdate) {
    const cache = this.ensureXlsxCache();
    const articulosCache = cache.sheets.get(cache.articulosSheetName)!;

    const indice = actualizacion.row - 2;
    if (indice < 0 || indice >= articulosCache.data.length) {
      throw new Error(`Fila ${actualizacion.row} fuera de rango`);
    }

    articulosCache.data[indice][STATE_COLUMNS.STATE] = actualizacion.estado;
    if (actualizacion.estado === ARTICLE_STATES.UPLOADED) {
      articulosCache.data[indice][STATE_COLUMNS.UPLOAD_DATE] = new Date().toISOString();
      articulosCache.data[indice][STATE_COLUMNS.LAST_ERROR] = '';
    } else if (actualizacion.estado === ARTICLE_STATES.ERROR) {
      articulosCache.data[indice][STATE_COLUMNS.LAST_ERROR] = actualizacion.error || '';
    }
    if (actualizacion.idArticulo !== undefined) {
      articulosCache.data[indice][ARTICLE_ID_COLUMN] = actualizacion.idArticulo;
    }

    this.escribirCacheXlsx();
  }

  private actualizarCsv(actualizacion: StateUpdate) {
    const contenido = fs.readFileSync(this.rutaArchivo, 'utf-8');
    const lineas = contenido.split(/\r?\n/);
    if (lineas.length < 2) throw new Error('CSV vacío');

    let headers = parseCsvLine(lineas[0]);
    const headersNormalized = headers.map(normalizeHeader);
    let idxEstado = headersNormalized.indexOf(STATE_COLUMNS.STATE);
    let idxFecha = headersNormalized.indexOf(STATE_COLUMNS.UPLOAD_DATE);
    let idxError = headersNormalized.indexOf(STATE_COLUMNS.LAST_ERROR);

    if (idxEstado === -1) { headers.push(STATE_COLUMNS.STATE); idxEstado = headers.length - 1; }
    if (idxFecha === -1) { headers.push(STATE_COLUMNS.UPLOAD_DATE); idxFecha = headers.length - 1; }
    if (idxError === -1) { headers.push(STATE_COLUMNS.LAST_ERROR); idxError = headers.length - 1; }
    lineas[0] = headers.map(escapeCsv).join(',');

    const idxLinea = actualizacion.row - 1;
    if (idxLinea >= lineas.length || !lineas[idxLinea]) {
      throw new Error(`Fila ${actualizacion.row} fuera de rango`);
    }

    const fields = parseCsvLine(lineas[idxLinea]);
    while (fields.length < headers.length) fields.push('');

    fields[idxEstado] = actualizacion.estado;
    if (actualizacion.estado === ARTICLE_STATES.UPLOADED) {
      fields[idxFecha] = new Date().toISOString();
      fields[idxError] = '';
    } else if (actualizacion.estado === ARTICLE_STATES.ERROR) {
      fields[idxError] = actualizacion.error || '';
    }

    lineas[idxLinea] = fields.map(escapeCsv).join(',');
    fs.writeFileSync(this.rutaArchivo, lineas.join('\n'), 'utf-8');
  }

  private actualizarSidecar(actualizacion: StateUpdate) {
    const sidecar = this.leerSidecar();
    const reg = {
      row: actualizacion.row,
      estado: actualizacion.estado,
      fechaSubida: actualizacion.estado === ARTICLE_STATES.UPLOADED ? new Date().toISOString() : undefined,
      error: actualizacion.error,
      idArticulo: actualizacion.idArticulo,
    };

    const idx = sidecar.registros.findIndex(r => r.row === actualizacion.row);
    if (idx >= 0) {
      sidecar.registros[idx] = reg;
    } else {
      sidecar.registros.push(reg);
    }
    sidecar.ultimaActualizacion = new Date().toISOString();

    fs.writeFileSync(this.rutaSidecar, JSON.stringify(sidecar, null, 2), 'utf-8');
  }

  private actualizarAutorSidecar(actualizacion: AuthorStateUpdate) {
    const sidecar = this.leerSidecar();
    sidecar.autores = sidecar.autores ?? [];

    const idx = sidecar.autores.findIndex(r => r.row === actualizacion.row);
    const reg: AuthorSidecarRecord = {
      row: actualizacion.row,
      estadoCarga: actualizacion.estadoCarga,
      tieneCvlac: actualizacion.tieneCvlac,
      accionRequerida: actualizacion.accionRequerida,
      idArticulo: actualizacion.idArticulo,
    };
    if (idx >= 0) sidecar.autores[idx] = reg;
    else sidecar.autores.push(reg);
    sidecar.ultimaActualizacion = new Date().toISOString();

    fs.writeFileSync(this.rutaSidecar, JSON.stringify(sidecar, null, 2), 'utf-8');
  }

  private leerSidecar(): ProgresoSidecar {
    if (fs.existsSync(this.rutaSidecar)) {
      try {
        return JSON.parse(fs.readFileSync(this.rutaSidecar, 'utf-8'));
      } catch {
        // corrupto: sobrescribir con vacío
      }
    }
    return { file: this.rutaArchivo, ultimaActualizacion: '', registros: [] };
  }
}

function findHeader(headers: string[], wanted: string): string | null {
  const target = normalizeHeader(wanted);
  for (const h of headers) {
    if (normalizeHeader(h) === target) return h;
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let actual = '';
  let dentroComillas = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (dentroComillas && line[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        dentroComillas = !dentroComillas;
      }
    } else if (c === ',' && !dentroComillas) {
      result.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  result.push(actual);
  return result;
}

function escapeCsv(valor: string): string {
  const s = String(valor ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
