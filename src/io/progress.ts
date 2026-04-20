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
  dirty: Set<string>;
}

/**
 * Encapsula la escritura del estado de carga al archivo Excel original.
 * Si el archivo está bloqueado (Excel abierto), usa un sidecar JSON como fallback.
 */
export class ProgressTracker {
  private rutaArchivo: string;
  private rutaSidecar: string;
  private usarSidecar: boolean = false;
  private advertenciaMostrada: boolean = false;
  private cacheXlsx: CacheXlsx | null = null;

  constructor(rutaArchivo: string) {
    this.rutaArchivo = path.resolve(rutaArchivo);
    this.rutaSidecar = this.rutaArchivo + '.progreso.json';
  }

  actualizar(actualizacion: StateUpdate, onWarning?: (msg: string) => void): boolean {
    if (this.usarSidecar) {
      this.actualizarSidecar(actualizacion);
      return false;
    }

    try {
      this.actualizarXlsx(actualizacion);
      return true;
    } catch (err) {
      this.fallbackASidecar(onWarning);
      this.actualizarSidecar(actualizacion);
      return false;
    }
  }

  /**
   * Tras crear un artículo, escribe el `idArticulo` a todas las filas de la
   * hoja Autores cuyo `titulo_articulo` matchee. Silencioso si no hay hoja Autores.
   */
  propagateArticleIdToAuthors(
    tituloArticulo: string,
    idArticulo: number,
    onWarning?: (msg: string) => void,
  ): number {
    try {
      const cache = this.ensureXlsxCache();
      const autoresName = cache.autoresSheetName;
      if (!autoresName) return 0;

      const sheetCache = cache.sheets.get(autoresName)!;
      const tituloCol = findHeader(sheetCache.headers, AUTHOR_COLUMNS.TITULO_ARTICULO);
      const idCol = findHeader(sheetCache.headers, AUTHOR_COLUMNS.ID_ARTICULO);
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

      if (count > 0) this.escribirCacheXlsx(autoresName);
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
      const setCol = (key: string, value: unknown) => {
        const col = findHeader(sheetCache.headers, key) ?? key;
        fila[col] = value;
      };
      if (actualizacion.estadoCarga !== undefined) setCol(AUTHOR_COLUMNS.ESTADO_CARGA, actualizacion.estadoCarga);
      if (actualizacion.tieneCvlac !== undefined) setCol(AUTHOR_COLUMNS.TIENE_CVLAC, actualizacion.tieneCvlac);
      if (actualizacion.accionRequerida !== undefined) setCol(AUTHOR_COLUMNS.ACCION_REQUERIDA, actualizacion.accionRequerida);
      if (actualizacion.idArticulo !== undefined) setCol(AUTHOR_COLUMNS.ID_ARTICULO, actualizacion.idArticulo);

      this.escribirCacheXlsx(cache.autoresSheetName);
      return true;
    } catch (err) {
      this.fallbackASidecar(onWarning);
      this.actualizarAutorSidecar(actualizacion);
      return false;
    }
  }

  trySyncSidecar(): boolean {
    if (!fs.existsSync(this.rutaSidecar)) return true;

    try {
      const sidecar: ProgresoSidecar = JSON.parse(fs.readFileSync(this.rutaSidecar, 'utf-8'));
      this.cacheXlsx = null; // forzar re-lectura (el usuario pudo haber cambiado el file)
      const cache = this.ensureXlsxCache();
      const articulosCache = cache.sheets.get(cache.articulosSheetName)!;

      if (sidecar.registros.length > 0) {
        for (const reg of sidecar.registros) {
          const indice = reg.row - 2;
          if (indice >= 0 && indice < articulosCache.data.length) {
            articulosCache.data[indice][STATE_COLUMNS.STATE] = reg.estado;
            if (reg.fechaSubida) articulosCache.data[indice][STATE_COLUMNS.UPLOAD_DATE] = reg.fechaSubida;
            if (reg.error) articulosCache.data[indice][STATE_COLUMNS.LAST_ERROR] = reg.error;
            if (reg.idArticulo !== undefined) articulosCache.data[indice][ARTICLE_ID_COLUMN] = reg.idArticulo;
          }
        }
        cache.dirty.add(cache.articulosSheetName);
      }

      if (sidecar.autores && cache.autoresSheetName && sidecar.autores.length > 0) {
        const autoresCache = cache.sheets.get(cache.autoresSheetName)!;
        const resolveCol = (key: string) => findHeader(autoresCache.headers, key) ?? key;
        for (const reg of sidecar.autores) {
          const indice = reg.row - 2;
          if (indice >= 0 && indice < autoresCache.data.length) {
            const fila = autoresCache.data[indice];
            if (reg.estadoCarga !== undefined) fila[resolveCol(AUTHOR_COLUMNS.ESTADO_CARGA)] = reg.estadoCarga;
            if (reg.tieneCvlac !== undefined) fila[resolveCol(AUTHOR_COLUMNS.TIENE_CVLAC)] = reg.tieneCvlac;
            if (reg.accionRequerida !== undefined) fila[resolveCol(AUTHOR_COLUMNS.ACCION_REQUERIDA)] = reg.accionRequerida;
            if (reg.idArticulo !== undefined) fila[resolveCol(AUTHOR_COLUMNS.ID_ARTICULO)] = reg.idArticulo;
          }
        }
        cache.dirty.add(cache.autoresSheetName);
      }

      this.escribirCacheXlsx();
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

  private fallbackASidecar(onWarning?: (msg: string) => void): void {
    if (this.advertenciaMostrada) return;
    this.advertenciaMostrada = true;
    this.usarSidecar = true;
    this.cacheXlsx = null;
    onWarning?.(
      `No se puede escribir al archivo original (probablemente está abierto en Excel). ` +
      `Guardando progreso en ${path.basename(this.rutaSidecar)}. ` +
      `Cierre el archivo Excel para que el progreso se guarde ahí directamente.`
    );
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

    this.cacheXlsx = { workbook, articulosSheetName, autoresSheetName, sheets, dirty: new Set() };
    return this.cacheXlsx;
  }

  /**
   * Re-serializa SOLO las hojas marcadas como dirty (las que tuvieron updates
   * desde el último flush) y graba el workbook. Cada `json_to_sheet` sobre una
   * hoja de 500 filas × 30 cols cuesta O(filas × cols); limitarlo a hojas
   * modificadas ahorra la mitad del trabajo cuando un update afecta solo una.
   */
  private escribirCacheXlsx(dirty?: string) {
    const cache = this.cacheXlsx!;
    if (dirty) cache.dirty.add(dirty);

    for (const name of cache.dirty) {
      const sheetCache = cache.sheets.get(name);
      if (!sheetCache) continue;
      const sheetAnterior = cache.workbook.Sheets[name];
      const nuevaSheet = XLSX.utils.json_to_sheet(sheetCache.data, { header: sheetCache.headers });
      if (sheetAnterior?.['!cols']) {
        nuevaSheet['!cols'] = sheetAnterior['!cols'];
      }
      cache.workbook.Sheets[name] = nuevaSheet;
    }
    XLSX.writeFile(cache.workbook, this.rutaArchivo);
    cache.dirty.clear();
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

    this.escribirCacheXlsx(cache.articulosSheetName);
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
    if (idx >= 0) sidecar.registros[idx] = reg;
    else sidecar.registros.push(reg);
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
