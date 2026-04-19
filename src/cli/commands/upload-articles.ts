import { spinner, success, error, info, warning, showValidation, showProgress, showSummary, showPause, showRemainingTime } from '../logger';
import { promptCredentials, selectIssue, promptFilePath, confirmContinue, confirmResume, confirmTimeEstimate } from '../prompts';
import { login } from '../../entities/auth/api';
import { tokenValid } from '../../entities/auth/session';
import { listIssues, formatIssue } from '../../entities/issues/api';
import { readArticles, ReadResult } from '../../io/excel-reader';
import { validateBatch } from '../../entities/articles/validator';
import { runUpload, estimateTimeSeconds } from '../../entities/articles/uploader';
import { ProgressTracker } from '../../io/progress';
import { Session } from '../../entities/auth/types';
import { ArticleRow } from '../../entities/articles/types';

type Mode = 'validate' | 'upload';

export async function uploadArticles(mode: Mode): Promise<void> {
  const file = await promptFilePath();

  const readSpinner = spinner(`Leyendo ${file}...`);
  let readResult: ReadResult;
  try {
    readResult = readArticles(file);
    readSpinner.succeed(`${readResult.articles.length} artículos leídos`);
  } catch (err) {
    readSpinner.fail('Error al leer archivo');
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  let articlesToProcess: ArticleRow[] = readResult.articles;

  if (readResult.alreadyUploaded.length > 0) {
    info(`Se detectaron ${readResult.alreadyUploaded.length} artículos ya cargados previamente.`);
    if (mode === 'upload') {
      const action = await confirmResume(readResult.alreadyUploaded.length, readResult.pending.length + readResult.withError.length);
      if (action === 'omitir') {
        articlesToProcess = [...readResult.pending, ...readResult.withError];
        info(`Se procesarán los ${articlesToProcess.length} artículos pendientes + con error.`);
      } else {
        warning('Se procesarán TODOS los artículos, incluyendo los ya cargados.');
      }
    } else {
      info('Modo solo validar: se validarán todos los artículos.');
    }
  }

  const validation = validateBatch(articlesToProcess, readResult.unknownHeaders);
  showValidation(validation);

  if (validation.valid.length === 0) {
    error('No hay artículos válidos.');
    process.exit(1);
  }

  if (mode === 'validate') {
    success('Validación completada.');
    if (validation.errors.length > 0) {
      info(`Corrija los ${new Set(validation.errors.map(e => e.row)).size} errores antes de cargar.`);
    } else {
      info('Todo listo para cargar. Ejecute de nuevo y seleccione "Validar y cargar artículos".');
    }
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

  const { username, password } = await promptCredentials();

  const loginSpinner = spinner('Iniciando sesión...');
  let session: Session;
  try {
    session = await login(username, password);
    loginSpinner.succeed(`Sesión iniciada: ${session.nmeRevista}`);
  } catch (err) {
    loginSpinner.fail('Login fallido');
    error(err instanceof Error ? err.message : String(err));
    error('Verifique sus credenciales. NO se reintentará para evitar bloqueo de cuenta.');
    process.exit(1);
  }

  const issuesSpinner = spinner('Obteniendo fascículos...');
  let issues;
  try {
    issues = await listIssues(session.token);
    issuesSpinner.succeed(`${issues.length} fascículos encontrados`);
  } catch (err) {
    issuesSpinner.fail('Error al obtener fascículos');
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (issues.length === 0) {
    error('No se encontraron fascículos en esta revista.');
    process.exit(1);
  }

  const issue = await selectIssue(issues);
  success(`Fascículo seleccionado: ${formatIssue(issue)} (ID: ${issue.id})`);

  const estimatedTime = estimateTimeSeconds(validation.valid.length);
  const shouldProceed = await confirmTimeEstimate(validation.valid.length, estimatedTime);
  if (!shouldProceed) {
    info('Operación cancelada.');
    return;
  }

  if (!tokenValid(session)) {
    warning('El token de sesión está próximo a expirar. Considere reiniciar el proceso.');
  }

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

  success('Proceso finalizado.');
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
  };
}
