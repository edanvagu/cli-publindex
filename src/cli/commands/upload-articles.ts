import {
  spinner,
  success,
  error,
  info,
  warning,
  showValidation,
  showProgress,
  showSummary,
  showPause,
  showRemainingTime,
} from '../logger';
import {
  promptFilePath,
  confirmContinue,
  confirmResume,
  confirmTimeEstimate,
  promptArticlesToUpload,
} from '../prompts';
import { formatIssue } from '../../entities/issues/api';
import { readArticles, ReadResult } from '../../io/excel-reader';
import { validateBatch } from '../../entities/articles/validator';
import { runUpload, estimateTimeSeconds } from '../../entities/articles/uploader';
import { ProgressTracker } from '../../io/progress';
import { ArticleRow } from '../../entities/articles/types';
import { loginOrThrow, fetchAndSelectIssue, ensureTokenCoversEstimate, flushProgressInteractive } from './shared';
import { uploadAuthorsWithContext } from './upload-authors';

export async function uploadArticles(): Promise<void> {
  const file = await promptFilePath();

  // Absorb any leftover sidecar from a previous run where Excel was open. Silent: if the file is still locked, the upload loop's fallback + the end-of-run interactive flush will handle it.
  new ProgressTracker(file).trySyncSidecar();

  const readSpinner = spinner(`Leyendo ${file}...`);
  let readResult: ReadResult;
  try {
    readResult = readArticles(file);
    readSpinner.succeed(`${readResult.articles.length} artículos leídos`);
  } catch (err) {
    readSpinner.fail('Error al leer archivo');
    error(err instanceof Error ? err.message : String(err));
    return;
  }

  let articlesToProcess: ArticleRow[] = readResult.articles;

  if (readResult.alreadyUploaded.length > 0) {
    info(`Se detectaron ${readResult.alreadyUploaded.length} artículos ya cargados previamente.`);
    const action = await confirmResume(
      readResult.alreadyUploaded.length,
      readResult.pending.length + readResult.withError.length,
    );
    if (action === 'skip') {
      articlesToProcess = [...readResult.pending, ...readResult.withError];
      info(`Se procesarán los ${articlesToProcess.length} artículos pendientes + con error.`);
    } else {
      warning('Se procesarán TODOS los artículos, incluyendo los ya cargados.');
    }
  }

  if (articlesToProcess.length === 0) {
    error('No hay artículos para cargar.');
    return;
  }

  // Picker BEFORE validation so editors can exclude rows they haven't filled yet — only picked rows go through validate + POST, the rest stay untouched in the Excel.
  articlesToProcess = await promptArticlesToUpload(articlesToProcess);
  if (articlesToProcess.length === 0) {
    info('No se seleccionó ningún artículo. Operación cancelada.');
    return;
  }

  const validation = validateBatch(articlesToProcess, readResult.unknownHeaders);
  showValidation(validation);

  if (validation.valid.length === 0) {
    error('No hay artículos válidos. Corrija el archivo y vuelva al menú principal.');
    return;
  }

  if (validation.errors.length > 0) {
    const shouldContinue = await confirmContinue(`¿Continuar con los ${validation.valid.length} artículos válidos?`);
    if (!shouldContinue) {
      info('Operación cancelada. Corrija los errores y vuelva a intentar.');
      return;
    }
  }

  let session = await loginOrThrow();
  const issue = await fetchAndSelectIssue(session);
  success(`Fascículo seleccionado: ${formatIssue(issue)} (ID: ${issue.id})`);

  const estimatedTime = estimateTimeSeconds(validation.valid.length);
  const shouldProceed = await confirmTimeEstimate(validation.valid.length, estimatedTime);
  if (!shouldProceed) {
    info('Operación cancelada.');
    return;
  }

  const refreshed = await ensureTokenCoversEstimate(
    session,
    estimatedTime,
    `cargar ${validation.valid.length} artículos`,
  );
  if (!refreshed) return;
  session = refreshed;

  info(`Iniciando carga de ${validation.valid.length} artículos...`);
  console.log('');

  const progressTracker = new ProgressTracker(file);

  const result = await runUpload(session, validation.valid, issue.id, buildUploadOptions(progressTracker, false));
  showSummary(result);

  if (result.failed.length > 0) {
    const shouldRetry = await confirmContinue('¿Reintentar los artículos fallidos?');
    if (shouldRetry) {
      const failedRows = new Set(result.failed.map((f) => f.row));
      const articlesToRetry = validation.valid.filter((a) => failedRows.has(a._fila));

      info(`Reintentando ${articlesToRetry.length} artículos...`);
      console.log('');

      const retryResult = await runUpload(
        session,
        articlesToRetry,
        issue.id,
        buildUploadOptions(progressTracker, true),
      );
      showSummary(retryResult);
    }
  }

  await flushProgressInteractive(progressTracker);
  success('Carga de artículos finalizada.');

  const continueToAuthors = await confirmContinue(
    '¿Continuar con la vinculación de autores ahora (sin volver a pedir credenciales)?',
  );
  if (continueToAuthors) {
    console.log('');
    await uploadAuthorsWithContext({ file, session, issue });
  }
}

function buildUploadOptions(progressTracker: ProgressTracker, isRetry: boolean) {
  return {
    progressTracker,
    onProgress: showProgress,
    onPause: showPause,
    onRemainingTime: showRemainingTime,
    onRetry: (row: number, attempt: number, err: Error) => {
      const label = isRetry ? 'reintento' : 'intento';
      const suffix = isRetry ? '' : ' falló. Reintentando...';
      warning(`Fila ${row}: ${label} ${attempt} (${err.message})${suffix}`);
    },
    onTokenExpiring: () => {
      warning('Token próximo a expirar. Los próximos requests podrían fallar.');
    },
    onWarning: warning,
    onArticleCreated: async (article: ArticleRow, articleId: number) => {
      await progressTracker.propagateArticleIdToAuthors(article.titulo, articleId, warning);
    },
  };
}
