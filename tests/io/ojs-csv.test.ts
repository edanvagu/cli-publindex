import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseReviewsCsv } from '../../src/io/ojs-csv';

function tempCsv(rows: string[][]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publindex-csv-'));
  const file = path.join(dir, 'reviews.csv');
  const csv = rows
    .map(r => r.map(cell => /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell).join(','))
    .join('\n');
  fs.writeFileSync(file, csv, 'utf-8');
  return file;
}

const HEADERS = [
  'Fase', 'Ronda', 'Título del envío', 'ID del envío',
  'Revisor/a', 'Nombre', 'Apellidos', 'Identificador ORCID',
  'País', 'Afiliación', 'Correo electrónico', 'Intereses de revisión',
  'Fecha asignada', 'Fecha notificada', 'Fecha confirmada',
  'Fecha completada', 'Fecha confirmada 2', 'Sin considerar',
  'Fecha recordatorio', 'Fecha límite de la contestación',
  'Días de vencimiento de la respuesta', 'Fecha límite de la revisión',
  'Días de vencimiento de la revisión', 'Rechazado', 'Cancelado',
  'Recomendación', 'Comentarios sobre el envío',
];

function row(opts: {
  phase?: string; submissionId: string; username: string;
  firstName?: string; lastName?: string; country?: string;
  affiliation?: string; email?: string; orcid?: string;
  dateCompleted?: string; excluded?: string;
  rejected?: string; canceled?: string;
}): string[] {
  return [
    opts.phase ?? 'Revisión', '1', 'Título Ficticio', opts.submissionId,
    opts.username, opts.firstName ?? 'Jane', opts.lastName ?? 'Doe', opts.orcid ?? '',
    opts.country ?? '', opts.affiliation ?? '', opts.email ?? '', '',
    '', '', '',
    opts.dateCompleted ?? '2025-09-01 12:00:00', '', opts.excluded ?? '',
    '', '',
    '', '',
    '', opts.rejected ?? 'Núm.', opts.canceled ?? 'Núm.',
    'Publicable con modificaciones', '',
  ];
}

describe('parseReviewsCsv', () => {
  it('filtra solo reviewers de submissions en el set y devuelve registros únicos', () => {
    const file = tempCsv([
      HEADERS,
      row({ submissionId: '1001', username: 'janedoe', country: 'CO' }),
      row({ submissionId: '2000', username: 'other',   country: 'US' }),  // submissionId fuera del set
    ]);
    const result = parseReviewsCsv(file, new Set(['1001']));
    expect(result.reviewers).toHaveLength(1);
    expect(result.reviewers[0].username_ojs).toBe('janedoe');
    expect(result.reviewers[0].nacionalidad).toBe('Colombiana');
  });

  it('mapea País ISO-2 a nacionalidad (CO → Colombiana, resto → Extranjera)', () => {
    const file = tempCsv([
      HEADERS,
      row({ submissionId: '1001', username: 'co_user', country: 'CO' }),
      row({ submissionId: '1001', username: 'mx_user', country: 'MX' }),
      row({ submissionId: '1001', username: 'no_country', country: '' }),
    ]);
    const result = parseReviewsCsv(file, new Set(['1001']));
    const byUser = Object.fromEntries(result.reviewers.map(r => [r.username_ojs, r]));
    expect(byUser['co_user'].nacionalidad).toBe('Colombiana');
    expect(byUser['mx_user'].nacionalidad).toBe('Extranjera');
    expect(byUser['no_country'].nacionalidad).toBe('Extranjera');
    expect(result.warnings.some(w => /sin País/.test(w))).toBe(true);
  });

  it('excluye reviewers con Fecha completada vacía, Cancelado=Sí, Rechazado=Sí o Sin considerar=Sí', () => {
    const file = tempCsv([
      HEADERS,
      row({ submissionId: '1001', username: 'ok_user',       country: 'CO' }),
      row({ submissionId: '1001', username: 'not_completed', country: 'CO', dateCompleted: '' }),
      row({ submissionId: '1001', username: 'canceled',      country: 'CO', canceled: 'Sí' }),
      row({ submissionId: '1001', username: 'rejected',      country: 'CO', rejected: 'Sí' }),
      row({ submissionId: '1001', username: 'excluded',      country: 'CO', excluded: 'Sí' }),
    ]);
    const result = parseReviewsCsv(file, new Set(['1001']));
    const usernames = result.reviewers.map(r => r.username_ojs).sort();
    expect(usernames).toEqual(['ok_user']);
  });

  it('deduplica por username incluso cuando el mismo reviewer aparece en varios envíos', () => {
    const file = tempCsv([
      HEADERS,
      row({ submissionId: '1001', username: 'repeat_user', country: 'CO' }),
      row({ submissionId: '1001', username: 'repeat_user', country: 'CO' }),  // dup exacto
      row({ submissionId: '1002', username: 'repeat_user', country: 'CO' }),  // mismo user, otro envío
    ]);
    const result = parseReviewsCsv(file, new Set(['1001', '1002']));
    expect(result.reviewers).toHaveLength(1);
    expect(result.reviewers[0].username_ojs).toBe('repeat_user');
  });

  it('ignora filas cuya Fase no es "Revisión"', () => {
    const file = tempCsv([
      HEADERS,
      row({ submissionId: '1001', username: 'jane', country: 'CO' }),
      row({ submissionId: '1001', username: 'other_phase', country: 'CO', phase: 'Envío' }),
    ]);
    const result = parseReviewsCsv(file, new Set(['1001']));
    expect(result.reviewers.map(r => r.username_ojs)).toEqual(['jane']);
  });

  it('reporta matchedForFasciculo y totalRowsInCsv', () => {
    const file = tempCsv([
      HEADERS,
      row({ submissionId: '1001', username: 'a', country: 'CO' }),
      row({ submissionId: '2000', username: 'b', country: 'CO' }),
      row({ submissionId: '1001', username: 'c', country: 'CO' }),
    ]);
    const result = parseReviewsCsv(file, new Set(['1001']));
    expect(result.totalRowsInCsv).toBe(3);
    expect(result.matchedForFasciculo).toBe(2);
  });
});
