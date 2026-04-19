import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ArticuloRow, EstadoArticulo } from './types';
import { COLUMNAS_ESTADO, ESTADOS_ARTICULO } from '../config/constants';
import { normalizeHeader } from './reader';

export interface ActualizacionEstado {
  fila: number;
  estado: EstadoArticulo;
  error?: string;
}

export interface ProgresoSidecar {
  archivo: string;
  ultimaActualizacion: string;
  registros: {
    fila: number;
    estado: EstadoArticulo;
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
 * Encapsula la escritura del estado de carga al archivo Excel/CSV original.
 * Si el archivo está bloqueado (Excel abierto), usa un sidecar JSON como fallback.
 */
export class GestorProgreso {
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

  actualizar(actualizacion: ActualizacionEstado, onAdvertencia?: (msg: string) => void): boolean {
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
        onAdvertencia?.(
          `No se puede escribir al archivo original (probablemente está abierto en Excel). ` +
          `Guardando progreso en ${path.basename(this.rutaSidecar)}. ` +
          `Cierre el archivo Excel para que el progreso se guarde ahí directamente.`
        );
      }
      this.actualizarSidecar(actualizacion);
      return false;
    }
  }

  intentarSincronizarSidecar(): boolean {
    if (!fs.existsSync(this.rutaSidecar)) return true;

    try {
      const sidecar: ProgresoSidecar = JSON.parse(fs.readFileSync(this.rutaSidecar, 'utf-8'));

      if (this.esXlsx) {
        this.cacheXlsx = null; // forzar re-lectura (el usuario pudo haber cambiado el archivo)
        const cache = this.asegurarCacheXlsx();

        for (const reg of sidecar.registros) {
          const indice = reg.fila - 2;
          if (indice >= 0 && indice < cache.data.length) {
            cache.data[indice][COLUMNAS_ESTADO.ESTADO] = reg.estado;
            if (reg.fechaSubida) cache.data[indice][COLUMNAS_ESTADO.FECHA_SUBIDA] = reg.fechaSubida;
            if (reg.error) cache.data[indice][COLUMNAS_ESTADO.ULTIMO_ERROR] = reg.error;
          }
        }

        this.escribirCacheXlsx();
      } else {
        for (const reg of sidecar.registros) {
          this.actualizarCsv({ fila: reg.fila, estado: reg.estado, error: reg.error });
        }
      }

      fs.unlinkSync(this.rutaSidecar);
      this.usarSidecar = false;
      return true;
    } catch {
      return false;
    }
  }

  static leerEstados(rutaArchivo: string, articulos: ArticuloRow[]): Map<number, EstadoArticulo> {
    const estados = new Map<number, EstadoArticulo>();
    const valoresValidos: EstadoArticulo[] = [ESTADOS_ARTICULO.SUBIDO, ESTADOS_ARTICULO.ERROR, ESTADOS_ARTICULO.PENDIENTE];

    for (const art of articulos) {
      if (!art.estado) continue;
      const estado = art.estado.toLowerCase() as EstadoArticulo;
      if (valoresValidos.includes(estado)) {
        estados.set(art._fila, estado);
      }
    }

    const rutaSidecar = path.resolve(rutaArchivo) + '.progreso.json';
    if (fs.existsSync(rutaSidecar)) {
      try {
        const sidecar: ProgresoSidecar = JSON.parse(fs.readFileSync(rutaSidecar, 'utf-8'));
        for (const reg of sidecar.registros) {
          estados.set(reg.fila, reg.estado);
        }
      } catch {
        // sidecar corrupto: ignorar
      }
    }

    return estados;
  }

  private asegurarCacheXlsx(): CacheXlsx {
    if (this.cacheXlsx) return this.cacheXlsx;

    const workbook = XLSX.readFile(this.rutaArchivo);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const headers = headerRows.length > 0 ? (headerRows[0] as string[]).map(h => String(h)) : [];
    const normalized = headers.map(normalizeHeader);
    for (const col of Object.values(COLUMNAS_ESTADO)) {
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

  private actualizarXlsx(actualizacion: ActualizacionEstado) {
    const cache = this.asegurarCacheXlsx();

    const indice = actualizacion.fila - 2;
    if (indice < 0 || indice >= cache.data.length) {
      throw new Error(`Fila ${actualizacion.fila} fuera de rango`);
    }

    cache.data[indice][COLUMNAS_ESTADO.ESTADO] = actualizacion.estado;
    if (actualizacion.estado === ESTADOS_ARTICULO.SUBIDO) {
      cache.data[indice][COLUMNAS_ESTADO.FECHA_SUBIDA] = new Date().toISOString();
      cache.data[indice][COLUMNAS_ESTADO.ULTIMO_ERROR] = '';
    } else if (actualizacion.estado === ESTADOS_ARTICULO.ERROR) {
      cache.data[indice][COLUMNAS_ESTADO.ULTIMO_ERROR] = actualizacion.error || '';
    }

    this.escribirCacheXlsx();
  }

  private actualizarCsv(actualizacion: ActualizacionEstado) {
    const contenido = fs.readFileSync(this.rutaArchivo, 'utf-8');
    const lineas = contenido.split(/\r?\n/);
    if (lineas.length < 2) throw new Error('CSV vacío');

    let headers = parsearLineaCsv(lineas[0]);
    const headersNormalized = headers.map(normalizeHeader);
    let idxEstado = headersNormalized.indexOf(COLUMNAS_ESTADO.ESTADO);
    let idxFecha = headersNormalized.indexOf(COLUMNAS_ESTADO.FECHA_SUBIDA);
    let idxError = headersNormalized.indexOf(COLUMNAS_ESTADO.ULTIMO_ERROR);

    if (idxEstado === -1) { headers.push(COLUMNAS_ESTADO.ESTADO); idxEstado = headers.length - 1; }
    if (idxFecha === -1) { headers.push(COLUMNAS_ESTADO.FECHA_SUBIDA); idxFecha = headers.length - 1; }
    if (idxError === -1) { headers.push(COLUMNAS_ESTADO.ULTIMO_ERROR); idxError = headers.length - 1; }
    lineas[0] = headers.map(escaparCsv).join(',');

    const idxLinea = actualizacion.fila - 1;
    if (idxLinea >= lineas.length || !lineas[idxLinea]) {
      throw new Error(`Fila ${actualizacion.fila} fuera de rango`);
    }

    const campos = parsearLineaCsv(lineas[idxLinea]);
    while (campos.length < headers.length) campos.push('');

    campos[idxEstado] = actualizacion.estado;
    if (actualizacion.estado === ESTADOS_ARTICULO.SUBIDO) {
      campos[idxFecha] = new Date().toISOString();
      campos[idxError] = '';
    } else if (actualizacion.estado === ESTADOS_ARTICULO.ERROR) {
      campos[idxError] = actualizacion.error || '';
    }

    lineas[idxLinea] = campos.map(escaparCsv).join(',');
    fs.writeFileSync(this.rutaArchivo, lineas.join('\n'), 'utf-8');
  }

  private actualizarSidecar(actualizacion: ActualizacionEstado) {
    const sidecar = this.leerSidecar();
    const reg = {
      fila: actualizacion.fila,
      estado: actualizacion.estado,
      fechaSubida: actualizacion.estado === ESTADOS_ARTICULO.SUBIDO ? new Date().toISOString() : undefined,
      error: actualizacion.error,
    };

    const idx = sidecar.registros.findIndex(r => r.fila === actualizacion.fila);
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
    return { archivo: this.rutaArchivo, ultimaActualizacion: '', registros: [] };
  }
}

function parsearLineaCsv(linea: string): string[] {
  const resultado: string[] = [];
  let actual = '';
  let dentroComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (dentroComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        dentroComillas = !dentroComillas;
      }
    } else if (c === ',' && !dentroComillas) {
      resultado.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  resultado.push(actual);
  return resultado;
}

function escaparCsv(valor: string): string {
  const s = String(valor ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
