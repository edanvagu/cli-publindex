import { spinner, success, error, info, warning, showValidation, showProgress, showSummary, showPause, showRemainingTime } from '../logger';
import { promptFilePath, confirmContinue, confirmResume, confirmTimeEstimate } from '../prompts';
import { tokenValid } from '../../entities/auth/session';
import { formatIssue } from '../../entities/issues/api';
import { readArticles, ReadResult } from '../../io/excel-reader';
import { validateBatch } from '../../entities/articles/validator';
import { runUpload, estimateTimeSeconds } from '../../entities/articles/uploader';
import { ProgressTracker } from '../../io/progress';
import { ArticleRow } from '../../entities/articles/types';
import { uploadAuthorsWithContext } from './upload-authors';
import { loginOrThrow, fetchAndSelectIssue, ensureTokenCoversEstimate } from './shared';

export async function uploadArticles(): Promise<void> {
  const file = await promptFilePath();

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
    const action = await confirmResume(readResult.alreadyUploaded.length, readResult.pending.length + readResult.withError.length);
    if (action === 'omitir') {
      articlesToProcess = [...readResult.pending, ...readResult.withError];
      info(`Se procesarán los ${articlesToProcess.length} artículos pendientes + con error.`);
    } else {
      warning('Se procesarán TODOS los artículos, incluyendo los ya cargados.');
    }
  }

  const validation = validateBatch(articlesToProcess, readResult.unknownHeaders);
  showValidation(validation);

  if (validation.valid.length === 0) {
    error('No hay artículos válidos. Corrija el archivo y vuelva al menú principal.');
    return;
  }

  if (validation.errors.length > 0) {
    const shouldContinue = await confirmContinue(
      `¿Continuar con los ${validation.valid.length} artículos válidos?`
    );
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

  const refreshed = await ensureTokenCoversEstimate(session, estimatedTime, `cargar ${validation.valid.length} artículos`);
  if (!refreshed) return;
  session = refreshed;

  info(`Iniciando carga de ${validation.valid.length} artículos...`);
  console.log('');

  const progressTracker = new ProgressTracker(file);

  const result = await runUpload(session, validation.valid, issue.id, buildUploadOptions(progressTracker, false));
  progressTracker.trySyncSidecar();
  showSummary(result);

  if (result.failed.length > 0) {
    const shouldRetry = await confirmContinue('¿Reintentar los artículos fallidos?');
    if (shouldRetry) {
      const failedRows = new Set(result.failed.map(f => f.row));
      const articlesToRetry = validation.valid.filter(a => failedRows.has(a._fila));

      info(`Reintentando ${articlesToRetry.length} artículos...`);
      console.log('');

      const retryResult = await runUpload(session, articlesToRetry, issue.id, buildUploadOptions(progressTracker, true));
      progressTracker.trySyncSidecar();
      showSummary(retryResult);
    }
  }

  success('Carga de artículos finalizada.');

  if (result.successful.length > 0) {
    console.log('');
    const continuar = await confirmContinue('¿Continuar con la vinculación de autores?');
    if (continuar) {
      if (!tokenValid(session)) {
        warning('El token está por expirar. Si el flow falla, reinicie el CLI y vaya directo a "Vincular autores".');
      }
      await uploadAuthorsWithContext({ file, session, issue });
    } else {
      info('Puede ejecutar la vinculación de autores más tarde desde el menú principal.');
    }
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
    onArticleCreated: (article: ArticleRow, articleId: number) => {
      progressTracker.propagateArticleIdToAuthors(article.titulo, articleId, warning);
    },
  };
}
