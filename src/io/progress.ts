import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ArticleRow, ArticleState } from '../entities/articles/types';
import { STATE_COLUMNS, ARTICLE_STATES } from '../config/constants';
import { normalizeHeader } from './excel-reader';

export interface StateUpdate {
  row: number;
  estado: ArticleState;
  error?: string;
}

export interface ProgresoSidecar {
  file: string;
  ultimaActualizacion: string;
  registros: {
    row: number;
    estado: ArticleState;
    fechaSubida?: string;
    error?: string;
  }[];
}

interface CacheXlsx {
  workbook: XLSX.WorkBook;
  sheetName: string;
  headers: string[];
  data: Record<string, unknown>[];
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

  trySyncSidecar(): boolean {
    if (!fs.existsSync(this.rutaSidecar)) return true;

    try {
      const sidecar: ProgresoSidecar = JSON.parse(fs.readFileSync(this.rutaSidecar, 'utf-8'));

      if (this.esXlsx) {
        this.cacheXlsx = null; // forzar re-lectura (el usuario pudo haber cambiado el file)
        const cache = this.ensureXlsxCache();

        for (const reg of sidecar.registros) {
          const indice = reg.row - 2;
          if (indice >= 0 && indice < cache.data.length) {
            cache.data[indice][STATE_COLUMNS.STATE] = reg.estado;
            if (reg.fechaSubida) cache.data[indice][STATE_COLUMNS.UPLOAD_DATE] = reg.fechaSubida;
            if (reg.error) cache.data[indice][STATE_COLUMNS.LAST_ERROR] = reg.error;
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
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const headers = headerRows.length > 0 ? (headerRows[0] as string[]).map(h => String(h)) : [];
    const normalized = headers.map(normalizeHeader);
    for (const col of Object.values(STATE_COLUMNS)) {
      if (!normalized.includes(col)) headers.push(col);
    }

    this.cacheXlsx = { workbook, sheetName, headers, data };
    return this.cacheXlsx;
  }

  private escribirCacheXlsx() {
    const cache = this.cacheXlsx!;
    const sheetAnterior = cache.workbook.Sheets[cache.sheetName];
    const nuevaSheet = XLSX.utils.json_to_sheet(cache.data, { header: cache.headers });
    if (sheetAnterior?.['!cols']) {
      nuevaSheet['!cols'] = sheetAnterior['!cols'];
    }
    cache.workbook.Sheets[cache.sheetName] = nuevaSheet;
    XLSX.writeFile(cache.workbook, this.rutaArchivo);
  }

  private actualizarXlsx(actualizacion: StateUpdate) {
    const cache = this.ensureXlsxCache();

    const indice = actualizacion.row - 2;
    if (indice < 0 || indice >= cache.data.length) {
      throw new Error(`Fila ${actualizacion.row} fuera de rango`);
    }

    cache.data[indice][STATE_COLUMNS.STATE] = actualizacion.estado;
    if (actualizacion.estado === ARTICLE_STATES.UPLOADED) {
      cache.data[indice][STATE_COLUMNS.UPLOAD_DATE] = new Date().toISOString();
      cache.data[indice][STATE_COLUMNS.LAST_ERROR] = '';
    } else if (actualizacion.estado === ARTICLE_STATES.ERROR) {
      cache.data[indice][STATE_COLUMNS.LAST_ERROR] = actualizacion.error || '';
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
