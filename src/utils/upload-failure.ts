import { isAuthError } from './http-errors';
import { CircuitBreaker } from './circuit-breaker';

export interface FailureContext {
  // User-facing label for the row, e.g. "Fila 27" or "Fila 27 (Jane Doe)". Used to prefix the warning shown to the editor.
  rowLabel: string;
  errorMessage: string;
}

// Centralizes the "what to do after a single item fails" logic shared by every uploader (articles, authors, reviewers). Returns true when the caller should break the loop.
export function handleUploadFailure(
  err: unknown,
  breaker: CircuitBreaker,
  ctx: FailureContext,
  onWarning: (msg: string) => void,
): boolean {
  if (isAuthError(err)) {
    const reason = `${ctx.rowLabel}: token rechazado por Publindex (${ctx.errorMessage}). Abortando la corrida para no insistir con un token inválido.`;
    onWarning(reason);
    breaker.trip(reason);
    return true;
  }

  breaker.recordFailure();
  const decision = breaker.shouldAbort();
  if (decision.abort) {
    onWarning(`Circuit breaker activado: ${decision.reason}`);
    return true;
  }
  return false;
}
