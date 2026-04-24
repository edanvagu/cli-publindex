import {
  spinner, success, error, info, warning,
  showProgress,
} from '../logger';
import { promptFilePath, confirmContinue, confirmAuthorsStart } from '../prompts';
import { readAuthors, ReadAuthorsResult } from '../../io/authors-reader';
import { runAuthorsUpload, estimateAuthorsTimeSeconds } from '../../entities/authors/uploader';
import { ProgressTracker } from '../../io/progress';
import { Session } from '../../entities/auth/types';
import { Issue } from '../../entities/issues/types';
import { AuthorRow, PersonSearchResult } from '../../entities/authors/types';
import { buildPersonPicker } from '../pickers';
import { loginOrThrow, fetchAndSelectIssue, ensureTokenCoversEstimate, extractYear, flushProgressInteractive } from './shared';
import { uploadReviewersWithContext } from './upload-reviewers';

export interface AuthorsContext {
  file: string;
  session: Session;
  issue: Issue;
}

export async function uploadAuthors(): Promise<void> {
  const file = await promptFilePath();
  new ProgressTracker(file).trySyncSidecar();
  const session = await loginOrThrow();
  const issue = await fetchAndSelectIssue(session);
  await uploadAuthorsCore({ file, session, issue });
}

export async function uploadAuthorsWithContext(ctx: AuthorsContext): Promise<void> {
  await uploadAuthorsCore(ctx);
}

async function uploadAuthorsCore(ctx: AuthorsContext): Promise<void> {
  const { file, issue } = ctx;
  let { session } = ctx;

  const readSpinner = spinner(`Leyendo hoja Autores de ${file}...`);
  let readResult: ReadAuthorsResult;
  try {
    readResult = readAuthors(file);
    if (readResult.missingSheet) {
      readSpinner.fail('El archivo no tiene hoja "Autores"');
      error('Este flujo requiere un Excel generado por "Importar desde OJS" (tiene hoja Artículos + hoja Autores).');
      return;
    }
    readSpinner.succeed(`${readResult.authors.length} autores leídos (${readResult.uploaded.length} ya subidos, ${readResult.errored.length} con error, ${readResult.pending.length} pendientes)`);
  } catch (err) {
    readSpinner.fail('Error al leer archivo');
    error(err instanceof Error ? err.message : String(err));
    return;
  }

  const withArticleId = [...readResult.pending, ...readResult.errored].filter(a => a.id_articulo.trim() !== '');
  const withoutArticleId = [...readResult.pending, ...readResult.errored].filter(a => a.id_articulo.trim() === '');

  if (withoutArticleId.length > 0) {
    warning(`${withoutArticleId.length} autores sin id_articulo — probablemente el artículo asociado aún no se ha cargado. Se saltan.`);
  }

  if (withArticleId.length === 0) {
    error('No hay autores pendientes con id_articulo. Primero ejecute "Validar y cargar artículos".');
    return;
  }

  const validationIssues = validateAuthors(withArticleId);
  if (validationIssues.length > 0) {
    for (const msg of validationIssues) warning(msg);
    const proceed = await confirmContinue('¿Continuar saltando esas filas?');
    if (!proceed) {
      info('Operación cancelada.');
      return;
    }
  }

  // `identificacion` is optional: when missing, the uploader falls back to name search. Only rows without nacionalidad (required for the tpoNacionalidad query param) or without nombre_completo are excluded — both are needed to even attempt a search.
  const toProcess = withArticleId.filter(a => a.nacionalidad.trim() !== '' && a.nombre_completo.trim() !== '');

  if (toProcess.length === 0) {
    error('Ninguna fila tiene nacionalidad + nombre_completo.');
    return;
  }

  const estimatedTime = estimateAuthorsTimeSeconds(toProcess.length);
  const proceed = await confirmAuthorsStart(toProcess.length);
  if (!proceed) {
    info('Operación cancelada.');
    return;
  }

  const issueYear = extractYear(issue.dtaPublicacion);
  if (!issueYear) {
    error(`No se pudo determinar el año del fascículo (dtaPublicacion="${issue.dtaPublicacion}").`);
    return;
  }

  const refreshed = await ensureTokenCoversEstimate(session, estimatedTime, `vincular ${toProcess.length} autores`);
  if (!refreshed) return;
  session = refreshed;

  info(`Vinculando ${toProcess.length} autores...`);
  console.log('');

  const progressTracker = new ProgressTracker(file);

  const result = await runAuthorsUpload(session, toProcess, {
    progressTracker,
    anoFasciculo: issueYear,
    onProgress: showProgress,
    onRetry: (row, attempt, err) => warning(`Fila ${row}: intento ${attempt} (${err.message})`),
    onTokenExpiring: () => warning('Token próximo a expirar. Los próximos requests podrían fallar.'),
    onWarning: warning,
    onPickPerson: buildAuthorPicker(),
    onPause: (seconds) => info(`Pausa de ${seconds}s antes del siguiente autor...`),
  });

  await flushProgressInteractive(progressTracker);

  console.log('');
  success(`Vinculaciones exitosas: ${result.successful.length}`);
  if (result.failed.length > 0) {
    warning(`Fallidas: ${result.failed.length}`);
    for (const f of result.failed) {
      console.log(`    Fila ${f.row}: ${f.nombre} — ${f.error}`);
    }
  }
  success('Proceso finalizado.');

  const continueToReviewers = await confirmContinue('¿Continuar con la vinculación de evaluadores ahora (sin volver a pedir credenciales)?');
  if (continueToReviewers) {
    console.log('');
    await uploadReviewersWithContext({ file, session, issue });
  }
}

function validateAuthors(authors: AuthorRow[]): string[] {
  const msgs: string[] = [];
  for (const a of authors) {
    if (!a.nacionalidad.trim()) {
      msgs.push(`Fila ${a._fila} ("${a.nombre_completo}"): falta nacionalidad. Se saltará.`);
    }
    if (!a.nombre_completo.trim()) {
      msgs.push(`Fila ${a._fila}: falta nombre_completo. Se saltará.`);
    }
  }
  return msgs;
}

function buildAuthorPicker() {
  const picker = buildPersonPicker();
  return (candidates: PersonSearchResult[], author: AuthorRow) =>
    picker(candidates, {
      _fila: author._fila,
      nombre_completo: author.nombre_completo,
      nacionalidad: author.nacionalidad,
      identificacion: author.identificacion,
      filiacion_institucional: author.filiacion_institucional,
    });
}
