// Typed error layer that lets the retry / circuit-breaker logic make decisions based on what actually went wrong instead of treating every Error the same.

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
    // Server-suggested wait, in ms, parsed from the Retry-After header. Honored by `withRetry` for 429 / 503.
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  // Only transient categories. 4xx other than 408/429 are deterministic client errors — retrying produces the same outcome and just burns requests against Publindex.
  isRetryable(): boolean {
    if (this.status >= 500) return true;
    if (this.status === 408) return true;
    if (this.status === 429) return true;
    return false;
  }
}

// Wraps low-level network failures (DNS, connection reset, TLS, timeout) so callers can distinguish "Publindex said no" from "we never reached Publindex".
export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export function isAuthError(err: unknown): boolean {
  return err instanceof HttpError && err.isAuthError();
}

// Default retry predicate. Network blips and 5xx/408/429 are retried; 4xx and unknown errors are NOT — for unknown errors, if we don't understand it, retrying is unsafe (it could be a malformed request that would be replayed N times).
export function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) return err.isRetryable();
  if (err instanceof NetworkError) return true;
  return false;
}

// Parses Retry-After. Spec allows either delta-seconds or HTTP-date; we accept both.
export function parseRetryAfter(header: string | string[] | undefined): number | undefined {
  if (!header) return undefined;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return undefined;
  const seconds = parseInt(raw, 10);
  if (!isNaN(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(raw);
  if (!isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? delta : 0;
  }
  return undefined;
}

// Truncates a body to keep error messages and logs from ballooning when Publindex returns an HTML error page or a verbose stack.
const MAX_DETAIL_LENGTH = 500;
export function extractErrorMessage(data: unknown, status: number): string {
  let raw: string;
  if (typeof data === 'string') {
    raw = data;
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    raw = (d.mensaje as string) || (d.message as string) || JSON.stringify(d);
  } else {
    return `sin detalle (status ${status})`;
  }
  return raw.length > MAX_DETAIL_LENGTH ? raw.slice(0, MAX_DETAIL_LENGTH) + '…[truncado]' : raw;
}
