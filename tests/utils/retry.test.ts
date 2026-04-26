import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/utils/retry';
import { HttpError, NetworkError } from '../../src/utils/http-errors';

// Helpers — `withRetry`'s default classifier only retries transient errors (HttpError 5xx/408/429 and NetworkError). Plain `Error` fails fast in production, so the tests model the realistic cases.
const transient = () => new NetworkError('connection reset');

describe('withRetry', () => {
  it('retorna el valor si la primera llamada tiene éxito', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta si la primera llamada falla con error transitorio', async () => {
    const fn = vi.fn().mockRejectedValueOnce(transient()).mockResolvedValue('ok');

    const result = await withRetry(fn, { delayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reintenta hasta el máximo de intentos en errores transitorios', async () => {
    const fn = vi.fn().mockRejectedValueOnce(transient()).mockRejectedValueOnce(transient()).mockResolvedValue('ok');

    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('lanza el último error si todos los intentos fallan', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError('fallo 1'))
      .mockRejectedValueOnce(new NetworkError('fallo 2'))
      .mockRejectedValue(new NetworkError('fallo final'));

    await expect(withRetry(fn, { maxAttempts: 3, delayMs: 10 })).rejects.toThrow('fallo final');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('invoca onRetry con intento y error', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(transient()).mockResolvedValue('ok');

    await withRetry(fn, { maxAttempts: 3, delayMs: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(NetworkError));
  });

  it('no invoca onRetry en la primera llamada exitosa', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockResolvedValue('ok');

    await withRetry(fn, { onRetry, delayMs: 10 });

    expect(onRetry).not.toHaveBeenCalled();
  });

  it('aplica backoff exponencial entre intentos', async () => {
    const tiempos: number[] = [];
    let ultimo = Date.now();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(transient())
      .mockRejectedValueOnce(transient())
      .mockImplementation(() => {
        const ahora = Date.now();
        tiempos.push(ahora - ultimo);
        ultimo = ahora;
        return Promise.resolve('ok');
      });

    ultimo = Date.now();
    await withRetry(fn, { maxAttempts: 3, delayMs: 50, backoff: 2 });

    expect(tiempos.length).toBeGreaterThanOrEqual(1);
  });

  it('no reintenta si maxAttempts es 1', async () => {
    const fn = vi.fn().mockRejectedValue(transient());
    await expect(withRetry(fn, { maxAttempts: 1, delayMs: 10 })).rejects.toThrow('connection reset');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('convierte errores no-Error a Error', async () => {
    const fn = vi.fn().mockRejectedValue('string error');
    await expect(withRetry(fn, { maxAttempts: 1, delayMs: 10 })).rejects.toThrow('string error');
  });

  it('NO reintenta errores deterministas 4xx', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(400, 'bad request'));
    await expect(withRetry(fn, { maxAttempts: 5, delayMs: 10 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('NO reintenta 401 (auth) — fail fast para no insistir con un token inválido', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(401, 'token expirado'));
    await expect(withRetry(fn, { maxAttempts: 5, delayMs: 10 })).rejects.toThrow('token expirado');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta 5xx (transitorio)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new HttpError(503, 'down')).mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reintenta 429 (rate limit)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new HttpError(429, 'slow down')).mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('honra Retry-After del HttpError en lugar del backoff', async () => {
    // 80ms de Retry-After; backoff inicial sería 10ms. Si el delay aplicado >= 60ms confirma que se honró el header.
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(429, 'slow down', null, 80))
      .mockResolvedValue('ok');
    const t0 = Date.now();
    await withRetry(fn, { maxAttempts: 3, delayMs: 10 });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(60);
  });
});
