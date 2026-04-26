import { describe, it, expect, vi } from 'vitest';
import { handleUploadFailure } from '../../src/utils/upload-failure';
import { CircuitBreaker } from '../../src/utils/circuit-breaker';
import { HttpError, NetworkError } from '../../src/utils/http-errors';

describe('handleUploadFailure', () => {
  it('aborta inmediato y trip-ea el breaker en errores de auth (401/403)', () => {
    const breaker = new CircuitBreaker({ consecutiveFailureThreshold: 100, totalFailureThreshold: 100 });
    const onWarning = vi.fn();

    const abort = handleUploadFailure(
      new HttpError(401, 'token expirado'),
      breaker,
      { rowLabel: 'Fila 5', errorMessage: 'token expirado' },
      onWarning,
    );

    expect(abort).toBe(true);
    expect(breaker.isTripped()).toBe(true);
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('token rechazado por Publindex'));
  });

  it('cuenta el fallo y NO aborta cuando el breaker aún no llega al umbral', () => {
    const breaker = new CircuitBreaker({ consecutiveFailureThreshold: 5, totalFailureThreshold: 100 });
    const onWarning = vi.fn();

    const abort = handleUploadFailure(
      new NetworkError('reset'),
      breaker,
      { rowLabel: 'Fila 5', errorMessage: 'reset' },
      onWarning,
    );

    expect(abort).toBe(false);
    expect(breaker.isTripped()).toBe(false);
    expect(breaker.snapshot().consecutive).toBe(1);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('aborta cuando el breaker cruza el umbral consecutivo', () => {
    const breaker = new CircuitBreaker({ consecutiveFailureThreshold: 2, totalFailureThreshold: 100 });
    const onWarning = vi.fn();

    handleUploadFailure(new NetworkError('boom 1'), breaker, { rowLabel: 'Fila 1', errorMessage: 'boom 1' }, onWarning);
    const abort = handleUploadFailure(
      new NetworkError('boom 2'),
      breaker,
      { rowLabel: 'Fila 2', errorMessage: 'boom 2' },
      onWarning,
    );

    expect(abort).toBe(true);
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('Circuit breaker activado'));
  });
});
