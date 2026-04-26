import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { REVIEWERS_SHEET_NAME, REVIEWER_STATES } from '../config/constants';
import { ReviewerRow, ReviewerState } from '../entities/reviewers/types';
import { normalizeHeader } from './excel-reader';

export interface ReadReviewersResult {
  reviewers: ReviewerRow[];
  pending: ReviewerRow[];
  uploaded: ReviewerRow[];
  errored: ReviewerRow[];
  missingSheet: boolean;
}

export function readReviewers(filePath: string): ReadReviewersResult {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Archivo no encontrado: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') {
    throw new Error(`La carga de evaluadores solo soporta .xlsx/.xls (recibido: ${ext})`);
  }

  const workbook = XLSX.readFile(absolutePath);
  const sheet = workbook.Sheets[REVIEWERS_SHEET_NAME];
  if (!sheet) {
    return { reviewers: [], pending: [], uploaded: [], errored: [], missingSheet: true };
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const reviewers = raw.map((r, i) => mapRawToReviewerRow(r, i + 2)).filter((r) => !isEmptyReviewer(r));

  const pending: ReviewerRow[] = [];
  const uploaded: ReviewerRow[] = [];
  const errored: ReviewerRow[] = [];
  const uploadedState: ReviewerState = REVIEWER_STATES.UPLOADED;

  for (const r of reviewers) {
    const estado = (r.estado_carga || '').toLowerCase().trim();
    if (estado === uploadedState) uploaded.push(r);
    else if (estado.startsWith(REVIEWER_STATES.ERROR)) errored.push(r);
    else pending.push(r);
  }

  return { reviewers, pending, uploaded, errored, missingSheet: false };
}

function mapRawToReviewerRow(raw: Record<string, unknown>, fila: number): ReviewerRow {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[normalizeHeader(key)] = String(value ?? '').trim();
  }
  return {
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

function isEmptyReviewer(r: ReviewerRow): boolean {
  return !r.nombre_completo && !r.identificacion;
}
