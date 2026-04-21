import { ArticleRow, UploadResult } from './types';
import { Session } from '../auth/types';
import { createArticle } from './api';
import { rowToPayload } from './mapper';
import { tokenValid } from '../auth/session';
import { withRetry } from '../../utils/retry';
import { DEFAULTS, ARTICLE_STATES } from '../../config/constants';
import { ProgressTracker } from '../../io/progress';
import { sleep } from '../../utils/async';

export interface RunnerOptions {
  progressTracker: ProgressTracker;
  onProgress: (current: number, total: number, titulo: string, ok: boolean, timeMs: number, error?: string) => void;
  onPause: (segundos: number) => void;
  onRemainingTime: (segundos: number, processed: number, total: number) => void;
  onRetry: (row: number, attempt: number, error: Error) => void;
  onTokenExpiring: () => void;
  onWarning: (msg: string) => void;
  onArticleCreated?: (row: ArticleRow, articleId: number) => void;
  abortSignal?: AbortSignal;
}

function randomPauseMs(): number {
  return DEFAULTS.PAUSE_MIN_MS + Math.floor(Math.random() * (DEFAULTS.PAUSE_MAX_MS - DEFAULTS.PAUSE_MIN_MS));
}

export async function runUpload(
  session: Session,
  articles: ArticleRow[],
  idFasciculo: number,
  options: RunnerOptions
): Promise<UploadResult> {
  const startTime = Date.now();
  const successful: UploadResult['successful'] = [];
  const failed: UploadResult['failed'] = [];

  for (let i = 0; i < articles.length; i++) {
    if (options.abortSignal?.aborted) break;

    const article = articles[i];

    if (!tokenValid(session, 2)) {
      options.onTokenExpiring();
    }

    const start = Date.now();
    const payload = rowToPayload(article, idFasciculo);

    try {
      const articleId = await withRetry(
        () => createArticle(session, payload),
        {
          onRetry: (attempt, error) => {
            options.onRetry(article._fila, attempt, error);
          },
        }
      );

      const elapsed = Date.now() - start;
      successful.push({ row: article._fila, titulo: article.titulo });
      options.onProgress(i + 1, articles.length, article.titulo, true, elapsed);

      options.progressTracker.update(
        { row: article._fila, state: ARTICLE_STATES.UPLOADED, articleId },
        options.onWarning
      );
      options.onArticleCreated?.(article, articleId);
    } catch (err) {
      const elapsed = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      failed.push({ row: article._fila, titulo: article.titulo, error: errorMsg });
      options.onProgress(i + 1, articles.length, article.titulo, false, elapsed, errorMsg);

      options.progressTracker.update(
        { row: article._fila, state: ARTICLE_STATES.ERROR, error: errorMsg },
        options.onWarning
      );
    }

    const processed = i + 1;
    if (processed < articles.length) {
      const remaining = estimateRemainingTimeSeconds(processed, articles.length, Date.now() - startTime);
      options.onRemainingTime(remaining, processed, articles.length);

      const pausa = randomPauseMs();
      options.onPause(Math.round(pausa / 1000));
      try {
        await sleep(pausa, options.abortSignal);
      } catch {
        break;
      }
    }
  }

  return {
    successful,
    failed,
    totalTimeMs: Date.now() - startTime,
  };
}

export function estimateTimeSeconds(cantidad: number): number {
  return Math.round(cantidad * DEFAULTS.ESTIMATED_SECONDS_PER_ARTICLE);
}

export function estimateRemainingTimeSeconds(
  processed: number,
  total: number,
  elapsedMs: number,
): number {
  const remainingCount = total - processed;
  if (remainingCount <= 0) return 0;
  if (processed <= 0) return estimateTimeSeconds(remainingCount);
  const promedioMs = elapsedMs / processed;
  return Math.round((remainingCount * promedioMs) / 1000);
}
