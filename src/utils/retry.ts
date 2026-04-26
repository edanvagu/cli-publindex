import { DEFAULTS } from '../config/constants';
import { sleep } from './async';
import { HttpError, isRetryable as defaultIsRetryable } from './http-errors';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: number;
  onRetry?: (attempt: number, error: Error) => void;
  // Override which errors trigger a retry. Defaults to: 5xx + 408 + 429 + network errors. 4xx (deterministic client errors) and unknown errors fail fast.
  isRetryable?: (err: unknown) => boolean;
  // Aborts the inter-attempt sleep so a long Retry-After (up to RETRY_AFTER_CAP_MS) doesn't block Ctrl-C / abortController-driven cancellation.
  abortSignal?: AbortSignal;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = DEFAULTS.RETRY_ATTEMPTS,
    delayMs = DEFAULTS.RETRY_DELAY_MS,
    backoff = DEFAULTS.RETRY_BACKOFF,
    onRetry,
    isRetryable = defaultIsRetryable,
    abortSignal,
  } = options;

  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Fail-fast on deterministic errors (4xx other than 408/429, unknown errors). No reason to keep hitting Publindex with a request that will fail the same way.
      if (!isRetryable(lastError)) throw lastError;

      if (attempt < maxAttempts) {
        onRetry?.(attempt, lastError);
        const wait = waitMs(lastError, attempt, delayMs, backoff);
        await sleep(wait, abortSignal);
      }
    }
  }

  throw lastError;
}

// 429/503 with Retry-After overrides the exponential schedule (Publindex tells us how long to wait — respect it). Capped to avoid a misconfigured 600s header freezing the CLI.
function waitMs(err: Error, attempt: number, delayMs: number, backoff: number): number {
  if (err instanceof HttpError && err.retryAfterMs !== undefined) {
    return Math.min(err.retryAfterMs, DEFAULTS.RETRY_AFTER_CAP_MS);
  }
  return delayMs * Math.pow(backoff, attempt - 1);
}
