import { DEFAULTS } from '../config/constants';

export interface RetryOptions {
  maxIntentos?: number;
  delayMs?: number;
  backoff?: number;
  onRetry?: (intento: number, error: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxIntentos = DEFAULTS.RETRY_ATTEMPTS,
    delayMs = DEFAULTS.RETRY_DELAY_MS,
    backoff = DEFAULTS.RETRY_BACKOFF,
    onRetry,
  } = options;

  let lastError: Error = new Error('Sin intentos');

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (intento < maxIntentos) {
        onRetry?.(intento, lastError);
        const wait = delayMs * Math.pow(backoff, intento - 1);
        await sleep(wait);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
