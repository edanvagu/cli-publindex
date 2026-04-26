import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { AUTHORS_SHEET_NAME, AUTHOR_STATES } from '../config/constants';
import { AuthorRow, AuthorState } from '../entities/authors/types';
import { normalizeHeader } from './excel-reader';

export interface ReadAuthorsResult {
  authors: AuthorRow[];
  pending: AuthorRow[];
  uploaded: AuthorRow[];
  errored: AuthorRow[];
  missingSheet: boolean;
}

export function readAuthors(filePath: string): ReadAuthorsResult {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Archivo no encontrado: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') {
    throw new Error(`La carga de autores solo soporta .xlsx/.xls (recibido: ${ext})`);
  }

  const workbook = XLSX.readFile(absolutePath);
  const sheet = workbook.Sheets[AUTHORS_SHEET_NAME];
  if (!sheet) {
    return { authors: [], pending: [], uploaded: [], errored: [], missingSheet: true };
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const authors = raw.map((r, i) => mapRawToAuthorRow(r, i + 2)).filter((a) => !isEmptyAuthor(a));

  const pending: AuthorRow[] = [];
  const uploaded: AuthorRow[] = [];
  const errored: AuthorRow[] = [];
  const uploadedState: AuthorState = AUTHOR_STATES.UPLOADED;

  for (const a of authors) {
    const estado = (a.estado_carga || '').toLowerCase().trim();
    if (estado === uploadedState) uploaded.push(a);
    else if (estado.startsWith(AUTHOR_STATES.ERROR)) errored.push(a);
    else pending.push(a);
  }

  return { authors, pending, uploaded, errored, missingSheet: false };
}

function mapRawToAuthorRow(raw: Record<string, unknown>, fila: number): AuthorRow {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[normalizeHeader(key)] = String(value ?? '').trim();
  }
  return {
    titulo_articulo: normalized['titulo_articulo'] || '',
    id_articulo: normalized['id_articulo'] || '',
    nombre_completo: normalized['nombre_completo'] || '',
    identificacion: normalized['identificacion'] || '',
    nacionalidad: normalized['nacionalidad'] || '',
    filiacion_institucional: normalized['filiacion_institucional'] || undefined,
    tiene_cvlac: normalized['tiene_cvlac'] || undefined,
    estado_carga: normalized['estado_carga'] || undefined,
    accion_requerida: normalized['accion_requerida'] || undefined,
    _fila: fila,
  };
}

function isEmptyAuthor(a: AuthorRow): boolean {
  return !a.nombre_completo && !a.identificacion && !a.titulo_articulo;
}
