import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

export interface ReviewerRow {
  nombre_completo: string;
  nacionalidad: string; // "Colombiana" | "Extranjera"
  filiacion_institucional?: string;
  username_ojs: string; // kept internally as dedup key; not written to the Excel
}

export interface ParseReviewsResult {
  reviewers: ReviewerRow[];
  warnings: string[];
  totalRowsInCsv: number;
  matchedForFasciculo: number;
}

// OJS column names (Spanish, matching CSV export verbatim).
const COL = {
  PHASE: 'Fase',
  SUBMISSION_ID: 'ID del envío',
  USERNAME: 'Revisor/a',
  FIRST_NAME: 'Nombre',
  LAST_NAME: 'Apellidos',
  COUNTRY: 'País',
  AFFILIATION: 'Afiliación',
  DATE_COMPLETED: 'Fecha completada',
  EXCLUDED: 'Sin considerar',
  REJECTED: 'Rechazado',
  CANCELED: 'Cancelado',
} as const;

const PHASE_REVIEW = 'Revisión';
const YES = 'Sí';

export function parseReviewsCsv(filePath: string, submissionIdSet: Set<string>): ParseReviewsResult {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Archivo no encontrado: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (ext !== '.csv') {
    throw new Error(`El CSV de revisiones debe tener extensión .csv (recibido: ${ext})`);
  }

  // Read as UTF-8 string first and strip the optional BOM. XLSX.readFile on .csv defaults to latin1 decoding, which mangles accented headers like "ID del envío" → "ID del envÃ­o".
  const raw = fs.readFileSync(absolutePath, 'utf-8').replace(/^﻿/, '');
  const workbook = XLSX.read(raw, { type: 'string' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { reviewers: [], warnings: [], totalRowsInCsv: 0, matchedForFasciculo: 0 };
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], { defval: '' });

  const byUsername = new Map<string, ReviewerRow>();
  const warnings: string[] = [];
  const countriesMissing = new Set<string>();
  let matched = 0;

  for (const raw of rows) {
    const row = normalizeRow(raw);

    if (row[COL.PHASE] !== PHASE_REVIEW) continue;
    if (row[COL.CANCELED] === YES) continue;
    if (row[COL.REJECTED] === YES) continue;
    if (row[COL.EXCLUDED] === YES) continue;
    if (!row[COL.DATE_COMPLETED]) continue;

    const submissionId = row[COL.SUBMISSION_ID];
    if (!submissionId || !submissionIdSet.has(submissionId)) continue;
    matched++;

    const username = row[COL.USERNAME];
    if (!username) continue;

    const first = row[COL.FIRST_NAME];
    const last = row[COL.LAST_NAME];
    const fullName = [first, last].filter(Boolean).join(' ').trim();
    if (!fullName) continue;

    if (byUsername.has(username)) continue;

    const country = row[COL.COUNTRY];
    const nacionalidad = country === 'CO' ? 'Colombiana' : 'Extranjera';
    if (!country) countriesMissing.add(username);

    byUsername.set(username, {
      nombre_completo: fullName,
      nacionalidad,
      filiacion_institucional: row[COL.AFFILIATION] || undefined,
      username_ojs: username,
    });
  }

  if (countriesMissing.size > 0) {
    warnings.push(
      `${countriesMissing.size} reviewer(s) sin País en OJS — se asumieron como Extranjeros. ` +
        `Revisar la columna nacionalidad antes de vincular.`,
    );
  }

  return {
    reviewers: Array.from(byUsername.values()),
    warnings,
    totalRowsInCsv: rows.length,
    matchedForFasciculo: matched,
  };
}

function normalizeRow(raw: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    result[key.trim()] = String(value ?? '').trim();
  }
  return result;
}
