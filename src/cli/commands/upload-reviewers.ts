import {
  spinner, success, error, info, warning, showProgress,
} from '../logger';
import { promptFilePath, confirmContinue, confirmReviewersStart } from '../prompts';
import { readReviewers, ReadReviewersResult } from '../../io/reviewers-reader';
import { runReviewersUpload, estimateReviewersTimeSeconds } from '../../entities/reviewers/uploader';
import { ProgressTracker } from '../../io/progress';
import { Session } from '../../entities/auth/types';
import { Issue } from '../../entities/issues/types';
import { ReviewerRow } from '../../entities/reviewers/types';
import { PersonSearchResult } from '../../entities/persons/types';
import { buildPersonPicker } from '../pickers';
import { loginOrThrow, fetchAndSelectIssue, ensureTokenCoversEstimate, extractYear } from './shared';

export interface ReviewersContext {
  file: string;
  session: Session;
  issue: Issue;
}

export async function uploadReviewers(): Promise<void> {
  const file = await promptFilePath();
  const session = await loginOrThrow();
  const issue = await fetchAndSelectIssue(session);
  await uploadReviewersCore({ file, session, issue });
}

export async function uploadReviewersWithContext(ctx: ReviewersContext): Promise<void> {
  await uploadReviewersCore(ctx);
}

async function uploadReviewersCore(ctx: ReviewersContext): Promise<void> {
  const { file, issue } = ctx;
  let { session } = ctx;

  const readSpinner = spinner(`Leyendo hoja Evaluadores de ${file}...`);
  let readResult: ReadReviewersResult;
  try {
    readResult = readReviewers(file);
    if (readResult.missingSheet) {
      readSpinner.fail('El archivo no tiene hoja "Evaluadores"');
      error('Este flujo requiere un Excel generado por "Importar desde OJS" (con hoja Evaluadores) o uno con esa hoja agregada manualmente.');
      return;
    }
    readSpinner.succeed(`${readResult.reviewers.length} evaluadores leídos (${readResult.uploaded.length} ya vinculados, ${readResult.errored.length} con error, ${readResult.pending.length} pendientes)`);
  } catch (err) {
    readSpinner.fail('Error al leer archivo');
    error(err instanceof Error ? err.message : String(err));
    return;
  }

  const candidates = [...readResult.pending, ...readResult.errored];

  if (candidates.length === 0) {
    info('No hay evaluadores pendientes. Todo ya está vinculado o no hay datos.');
    return;
  }

  const validationIssues = validateReviewers(candidates);
  if (validationIssues.length > 0) {
    for (const msg of validationIssues) warning(msg);
    const proceed = await confirmContinue('¿Continuar saltando esas filas?');
    if (!proceed) {
      info('Operación cancelada.');
      return;
    }
  }

  // Both nacionalidad (for tpoNacionalidad) and nombre_completo (to even attempt a search) are required. identificacion is optional — uploader falls back to name search.
  const toProcess = candidates.filter(r => r.nacionalidad.trim() !== '' && r.nombre_completo.trim() !== '');

  if (toProcess.length === 0) {
    error('Ninguna fila tiene nacionalidad + nombre_completo.');
    return;
  }

  const estimatedTime = estimateReviewersTimeSeconds(toProcess.length);
  const proceed = await confirmReviewersStart(toProcess.length);
  if (!proceed) {
    info('Operación cancelada.');
    return;
  }

  const issueYear = extractYear(issue.dtaPublicacion);
  if (!issueYear) {
    error(`No se pudo determinar el año del fascículo (dtaPublicacion="${issue.dtaPublicacion}").`);
    return;
  }

  const refreshed = await ensureTokenCoversEstimate(session, estimatedTime, `vincular ${toProcess.length} evaluadores`);
  if (!refreshed) return;
  session = refreshed;

  info(`Vinculando ${toProcess.length} evaluadores al fascículo ${issue.id}...`);
  console.log('');

  const progressTracker = new ProgressTracker(file);

  const result = await runReviewersUpload(session, toProcess, {
    progressTracker,
    idFasciculo: issue.id,
    anoFasciculo: issueYear,
    onProgress: showProgress,
    onRetry: (row, attempt, err) => warning(`Fila ${row}: intento ${attempt} (${err.message})`),
    onTokenExpiring: () => warning('Token próximo a expirar. Los próximos requests podrían fallar.'),
    onWarning: warning,
    onPickPerson: buildReviewerPicker(),
    onPause: (seconds) => info(`Pausa de ${seconds}s antes del siguiente evaluador...`),
  });

  progressTracker.trySyncSidecar();

  console.log('');
  success(`Vinculaciones exitosas: ${result.successful.length}`);
  if (result.failed.length > 0) {
    warning(`Fallidas: ${result.failed.length}`);
    for (const f of result.failed) {
      console.log(`    Fila ${f.row}: ${f.nombre} — ${f.error}`);
    }
  }
  success('Proceso finalizado.');
}

function validateReviewers(reviewers: ReviewerRow[]): string[] {
  const msgs: string[] = [];
  for (const r of reviewers) {
    if (!r.nacionalidad.trim()) {
      msgs.push(`Fila ${r._fila} ("${r.nombre_completo}"): falta nacionalidad. Se saltará.`);
    }
    if (!r.nombre_completo.trim()) {
      msgs.push(`Fila ${r._fila}: falta nombre_completo. Se saltará.`);
    }
  }
  return msgs;
}

function buildReviewerPicker() {
  const picker = buildPersonPicker();
  return (candidates: PersonSearchResult[], reviewer: ReviewerRow) =>
    picker(candidates, {
      _fila: reviewer._fila,
      nombre_completo: reviewer.nombre_completo,
      nacionalidad: reviewer.nacionalidad,
      identificacion: reviewer.identificacion,
      filiacion_institucional: reviewer.filiacion_institucional,
    });
}
