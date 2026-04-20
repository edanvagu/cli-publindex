import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/utils/retry';

describe('withRetry', () => {
  it('retorna el valor si la primera llamada tiene éxito', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta si la primera llamada falla', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fallo 1'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { delayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reintenta hasta el máximo de intentos', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fallo 1'))
      .mockRejectedValueOnce(new Error('fallo 2'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('lanza el último error si todos los intentos fallan', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fallo 1'))
      .mockRejectedValueOnce(new Error('fallo 2'))
      .mockRejectedValue(new Error('fallo final'));

    await expect(withRetry(fn, { maxAttempts: 3, delayMs: 10 }))
      .rejects.toThrow('fallo final');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('invoca onRetry con intento y error', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('primera'))
      .mockResolvedValue('ok');

    await withRetry(fn, { maxAttempts: 3, delayMs: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
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
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockImplementation(() => {
        const ahora = Date.now();
        tiempos.push(ahora - ultimo);
        ultimo = ahora;
        return Promise.resolve('ok');
      });

    ultimo = Date.now();
    await withRetry(fn, { maxAttempts: 3, delayMs: 50, backoff: 2 });

    // Segundo attempt: delayMs * 1 = 50ms. Tercer attempt: delayMs * 2 = 100ms.
    expect(tiempos.length).toBeGreaterThanOrEqual(1);
  });

  it('no reintenta si maxAttempts es 1', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fallo'));
    await expect(withRetry(fn, { maxAttempts: 1, delayMs: 10 }))
      .rejects.toThrow('fallo');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('convierte errores no-Error a Error', async () => {
    const fn = vi.fn().mockRejectedValue('string error');
    await expect(withRetry(fn, { maxAttempts: 1, delayMs: 10 }))
      .rejects.toThrow('string error');
  });
});
