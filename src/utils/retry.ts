import { DEFAULTS } from '../config/constants';
import { sleep } from './async';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = DEFAULTS.RETRY_ATTEMPTS,
    delayMs = DEFAULTS.RETRY_DELAY_MS,
    backoff = DEFAULTS.RETRY_BACKOFF,
    onRetry,
  } = options;

  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxAttempts) {
        onRetry?.(attempt, lastError);
        const wait = delayMs * Math.pow(backoff, attempt - 1);
        await sleep(wait);
      }
    }
  }

  throw lastError;
}
