import { ArticleRow, UploadResult } from './types';
import { Session } from '../auth/types';
import { createArticle, listArticlesByFasciculo, ServerArticle } from './api';
import { rowToPayload } from './mapper';
import { tokenValid } from '../auth/session';
import { withRetry } from '../../utils/retry';
import { DEFAULTS, ARTICLE_STATES } from '../../config/constants';
import { ProgressTracker } from '../../io/progress';
import { sleep } from '../../utils/async';
import { normalizeTitle } from '../../utils/text';

export interface RunnerOptions {
  progressTracker: ProgressTracker;
  onProgress: (current: number, total: number, titulo: string, ok: boolean, timeMs: number, error?: string) => void;
  onPause: (seconds: number) => void;
  onRemainingTime: (seconds: number, processed: number, total: number) => void;
  onRetry: (row: number, attempt: number, error: Error) => void;
  onTokenExpiring: () => void;
  onWarning: (msg: string) => void;
  onArticleCreated?: (row: ArticleRow, articleId: number) => void | Promise<void>;
  abortSignal?: AbortSignal;
}

function randomPauseMs(): number {
  return DEFAULTS.PAUSE_MIN_MS + Math.floor(Math.random() * (DEFAULTS.PAUSE_MAX_MS - DEFAULTS.PAUSE_MIN_MS));
}

export async function runUpload(
  session: Session,
  articles: ArticleRow[],
  idFasciculo: number,
  options: RunnerOptions,
): Promise<UploadResult> {
  const startTime = Date.now();
  const successful: UploadResult['successful'] = [];
  const failed: UploadResult['failed'] = [];

  const alreadyOnServer = await fetchAlreadyUploadedArticles(session, idFasciculo, options.onWarning);
  if (alreadyOnServer.size > 0) {
    options.onWarning(
      `Pre-check: ${alreadyOnServer.size} artículo(s) ya están en el fascículo. Se saltarán si su título coincide.`,
    );
  }

  for (let i = 0; i < articles.length; i++) {
    if (options.abortSignal?.aborted) break;

    const article = articles[i];

    if (!tokenValid(session, 2)) {
      options.onTokenExpiring();
    }

    const start = Date.now();

    const existingId = alreadyOnServer.get(normalizeTitle(article.titulo));
    if (existingId !== undefined) {
      successful.push({ row: article._fila, titulo: article.titulo });
      options.onProgress(i + 1, articles.length, article.titulo, true, Date.now() - start);
      await options.progressTracker.update(
        { row: article._fila, state: ARTICLE_STATES.UPLOADED, articleId: existingId },
        options.onWarning,
      );
      await options.onArticleCreated?.(article, existingId);
      options.onWarning(`Fila ${article._fila}: ya existe en el servidor (id=${existingId}), saltando POST.`);
      continue;
    }

    const payload = rowToPayload(article, idFasciculo);

    try {
      const articleId = await withRetry(() => createArticle(session, payload), {
        onRetry: (attempt, error) => {
          options.onRetry(article._fila, attempt, error);
        },
      });

      const elapsed = Date.now() - start;
      successful.push({ row: article._fila, titulo: article.titulo });
      options.onProgress(i + 1, articles.length, article.titulo, true, elapsed);

      await options.progressTracker.update(
        { row: article._fila, state: ARTICLE_STATES.UPLOADED, articleId },
        options.onWarning,
      );
      await options.onArticleCreated?.(article, articleId);
      alreadyOnServer.set(normalizeTitle(article.titulo), articleId);
    } catch (err) {
      const elapsed = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      failed.push({ row: article._fila, titulo: article.titulo, error: errorMsg });
      options.onProgress(i + 1, articles.length, article.titulo, false, elapsed, errorMsg);

      await options.progressTracker.update(
        { row: article._fila, state: ARTICLE_STATES.ERROR, error: errorMsg },
        options.onWarning,
      );
    }

    const processed = i + 1;
    if (processed < articles.length) {
      const remaining = estimateRemainingTimeSeconds(processed, articles.length, Date.now() - startTime);
      options.onRemainingTime(remaining, processed, articles.length);

      const pauseMs = randomPauseMs();
      options.onPause(Math.round(pauseMs / 1000));
      try {
        await sleep(pauseMs, options.abortSignal);
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

// Idempotency guard: if the editor manually created some articles in the UI, skip them here to avoid duplicates. Matching is by normalized title (accents stripped, lowercased, whitespace collapsed) because Publindex may round-trip the stored title through its own normalization.
async function fetchAlreadyUploadedArticles(
  session: Session,
  idFasciculo: number,
  onWarning: (msg: string) => void,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const existing = await listArticlesByFasciculo(session, idFasciculo);
    for (const a of existing) {
      if (!a.txtTituloArticulo || typeof a.id !== 'number') continue;
      map.set(normalizeTitle(a.txtTituloArticulo), a.id);
    }
  } catch (err) {
    onWarning(
      `No se pudo obtener la lista de artículos ya cargados del fascículo: ${(err as Error).message}. Se continuará sin pre-filtro de duplicados.`,
    );
  }
  return map;
}

export function estimateTimeSeconds(count: number): number {
  return Math.round(count * DEFAULTS.ESTIMATED_SECONDS_PER_ARTICLE);
}

export function estimateRemainingTimeSeconds(processed: number, total: number, elapsedMs: number): number {
  const remainingCount = total - processed;
  if (remainingCount <= 0) return 0;
  if (processed <= 0) return estimateTimeSeconds(remainingCount);
  const averageMs = elapsedMs / processed;
  return Math.round((remainingCount * averageMs) / 1000);
}
