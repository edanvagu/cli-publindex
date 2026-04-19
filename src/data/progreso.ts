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

  constructor(rutaArchivo: string) {
    this.rutaArchivo = path.resolve(rutaArchivo);
    this.rutaSidecar = this.rutaArchivo + '.progreso.json';
    const ext = path.extname(this.rutaArchivo).toLowerCase();
    this.esXlsx = ext === '.xlsx' || ext === '.xls';
  }

  /**
   * Actualiza el estado de un artículo específico en el archivo original.
   * Devuelve true si se escribió al archivo, false si cayó al sidecar.
   */
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

  /**
   * Intenta mover los estados del sidecar al archivo original.
   * Útil al final del proceso cuando el usuario ya cerró el Excel.
   */
  intentarSincronizarSidecar(): boolean {
    if (!fs.existsSync(this.rutaSidecar)) return true;

    try {
      const sidecar: ProgresoSidecar = JSON.parse(fs.readFileSync(this.rutaSidecar, 'utf-8'));

      if (this.esXlsx) {
        const wb = XLSX.readFile(this.rutaArchivo);
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const headers = this.obtenerHeaders(sheet);
        this.asegurarColumnasEstado(headers);

        for (const reg of sidecar.registros) {
          const indice = reg.fila - 2; // fila 2 → index 0
          if (indice >= 0 && indice < data.length) {
            data[indice][COLUMNAS_ESTADO.ESTADO] = reg.estado;
            if (reg.fechaSubida) data[indice][COLUMNAS_ESTADO.FECHA_SUBIDA] = reg.fechaSubida;
            if (reg.error) data[indice][COLUMNAS_ESTADO.ULTIMO_ERROR] = reg.error;
          }
        }

        const nuevaSheet = XLSX.utils.json_to_sheet(data, { header: headers });
        wb.Sheets[sheetName] = nuevaSheet;
        XLSX.writeFile(wb, this.rutaArchivo);
      } else {
        // CSV: reescribir todo
        this.sincronizarCsvDesdesidecar(sidecar);
      }

      // Si todo salió bien, borrar el sidecar
      fs.unlinkSync(this.rutaSidecar);
      this.usarSidecar = false;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lee el estado actual del archivo + sidecar (sidecar tiene prioridad).
   * Devuelve un mapa fila → estado.
   */
  static leerEstados(rutaArchivo: string, articulos: ArticuloRow[]): Map<number, EstadoArticulo> {
    const estados = new Map<number, EstadoArticulo>();

    // 1. Leer del archivo principal (ya viene en los ArticuloRow)
    for (const art of articulos) {
      if (art.estado) {
        const estado = art.estado.toLowerCase() as EstadoArticulo;
        if (estado === ESTADOS_ARTICULO.SUBIDO || estado === ESTADOS_ARTICULO.ERROR || estado === ESTADOS_ARTICULO.PENDIENTE) {
          estados.set(art._fila, estado);
        }
      }
    }

    // 2. Sobreescribir con sidecar si existe
    const rutaSidecar = path.resolve(rutaArchivo) + '.progreso.json';
    if (fs.existsSync(rutaSidecar)) {
      try {
        const sidecar: ProgresoSidecar = JSON.parse(fs.readFileSync(rutaSidecar, 'utf-8'));
        for (const reg of sidecar.registros) {
          estados.set(reg.fila, reg.estado);
        }
      } catch {
        // Sidecar corrupto, ignorar
      }
    }

    return estados;
  }

  // ============ Implementación interna ============

  private actualizarXlsx(actualizacion: ActualizacionEstado) {
    const wb = XLSX.readFile(this.rutaArchivo);
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers = this.obtenerHeaders(sheet);
    this.asegurarColumnasEstado(headers);

    const indice = actualizacion.fila - 2;
    if (indice < 0 || indice >= data.length) {
      throw new Error(`Fila ${actualizacion.fila} fuera de rango`);
    }

    data[indice][COLUMNAS_ESTADO.ESTADO] = actualizacion.estado;
    if (actualizacion.estado === ESTADOS_ARTICULO.SUBIDO) {
      data[indice][COLUMNAS_ESTADO.FECHA_SUBIDA] = new Date().toISOString();
      data[indice][COLUMNAS_ESTADO.ULTIMO_ERROR] = '';
    } else if (actualizacion.estado === ESTADOS_ARTICULO.ERROR) {
      data[indice][COLUMNAS_ESTADO.ULTIMO_ERROR] = actualizacion.error || '';
    }

    const nuevaSheet = XLSX.utils.json_to_sheet(data, { header: headers });
    // Preservar anchos de columna
    if (sheet['!cols']) {
      nuevaSheet['!cols'] = sheet['!cols'];
    }
    wb.Sheets[sheetName] = nuevaSheet;
    XLSX.writeFile(wb, this.rutaArchivo);
  }

  private obtenerHeaders(sheet: XLSX.WorkSheet): string[] {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    if (rows.length === 0) return [];
    return (rows[0] as string[]).map(h => String(h));
  }

  private asegurarColumnasEstado(headers: string[]) {
    const normalized = headers.map(h => normalizeHeader(h));
    if (!normalized.includes(COLUMNAS_ESTADO.ESTADO)) {
      headers.push(COLUMNAS_ESTADO.ESTADO);
    }
    if (!normalized.includes(COLUMNAS_ESTADO.FECHA_SUBIDA)) {
      headers.push(COLUMNAS_ESTADO.FECHA_SUBIDA);
    }
    if (!normalized.includes(COLUMNAS_ESTADO.ULTIMO_ERROR)) {
      headers.push(COLUMNAS_ESTADO.ULTIMO_ERROR);
    }
  }

  private actualizarCsv(actualizacion: ActualizacionEstado) {
    const contenido = fs.readFileSync(this.rutaArchivo, 'utf-8');
    const lineas = contenido.split(/\r?\n/);
    if (lineas.length < 2) throw new Error('CSV vacío');

    let headers = this.parsearLineaCsv(lineas[0]);
    let headersNormalized = headers.map(h => normalizeHeader(h));
    let idxEstado = headersNormalized.indexOf(COLUMNAS_ESTADO.ESTADO);
    let idxFecha = headersNormalized.indexOf(COLUMNAS_ESTADO.FECHA_SUBIDA);
    let idxError = headersNormalized.indexOf(COLUMNAS_ESTADO.ULTIMO_ERROR);

    if (idxEstado === -1) {
      headers.push(COLUMNAS_ESTADO.ESTADO);
      idxEstado = headers.length - 1;
    }
    if (idxFecha === -1) {
      headers.push(COLUMNAS_ESTADO.FECHA_SUBIDA);
      idxFecha = headers.length - 1;
    }
    if (idxError === -1) {
      headers.push(COLUMNAS_ESTADO.ULTIMO_ERROR);
      idxError = headers.length - 1;
    }
    lineas[0] = headers.map(escaparCsv).join(',');

    const idxLinea = actualizacion.fila - 1; // fila 2 del Excel = linea 1 (0-indexed)
    if (idxLinea >= lineas.length || !lineas[idxLinea]) {
      throw new Error(`Fila ${actualizacion.fila} fuera de rango`);
    }

    const campos = this.parsearLineaCsv(lineas[idxLinea]);
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

  private parsearLineaCsv(linea: string): string[] {
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

  private sincronizarCsvDesdesidecar(sidecar: ProgresoSidecar) {
    for (const reg of sidecar.registros) {
      this.actualizarCsv({
        fila: reg.fila,
        estado: reg.estado,
        error: reg.error,
      });
    }
  }

  private actualizarSidecar(actualizacion: ActualizacionEstado) {
    let sidecar: ProgresoSidecar;
    if (fs.existsSync(this.rutaSidecar)) {
      try {
        sidecar = JSON.parse(fs.readFileSync(this.rutaSidecar, 'utf-8'));
      } catch {
        sidecar = { archivo: this.rutaArchivo, ultimaActualizacion: '', registros: [] };
      }
    } else {
      sidecar = { archivo: this.rutaArchivo, ultimaActualizacion: '', registros: [] };
    }

    const idx = sidecar.registros.findIndex(r => r.fila === actualizacion.fila);
    const reg = {
      fila: actualizacion.fila,
      estado: actualizacion.estado,
      fechaSubida: actualizacion.estado === ESTADOS_ARTICULO.SUBIDO ? new Date().toISOString() : undefined,
      error: actualizacion.error,
    };

    if (idx >= 0) {
      sidecar.registros[idx] = reg;
    } else {
      sidecar.registros.push(reg);
    }
    sidecar.ultimaActualizacion = new Date().toISOString();

    fs.writeFileSync(this.rutaSidecar, JSON.stringify(sidecar, null, 2), 'utf-8');
  }
}

function escaparCsv(valor: string): string {
  const s = String(valor ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
