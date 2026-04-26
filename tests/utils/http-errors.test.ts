import { describe, it, expect } from 'vitest';
import {
  HttpError,
  NetworkError,
  isAuthError,
  isRetryable,
  parseRetryAfter,
  extractErrorMessage,
} from '../../src/utils/http-errors';

describe('HttpError', () => {
  it('isAuthError() reconoce 401 y 403', () => {
    expect(new HttpError(401, 'x').isAuthError()).toBe(true);
    expect(new HttpError(403, 'x').isAuthError()).toBe(true);
    expect(new HttpError(400, 'x').isAuthError()).toBe(false);
    expect(new HttpError(500, 'x').isAuthError()).toBe(false);
  });

  it('isRetryable() solo es true para 5xx, 408 y 429', () => {
    expect(new HttpError(500, 'x').isRetryable()).toBe(true);
    expect(new HttpError(503, 'x').isRetryable()).toBe(true);
    expect(new HttpError(408, 'x').isRetryable()).toBe(true);
    expect(new HttpError(429, 'x').isRetryable()).toBe(true);
    expect(new HttpError(400, 'x').isRetryable()).toBe(false);
    expect(new HttpError(401, 'x').isRetryable()).toBe(false);
    expect(new HttpError(404, 'x').isRetryable()).toBe(false);
    expect(new HttpError(422, 'x').isRetryable()).toBe(false);
  });
});

describe('isRetryable / isAuthError predicates', () => {
  it('isRetryable acepta NetworkError', () => {
    expect(isRetryable(new NetworkError('reset'))).toBe(true);
  });

  it('isRetryable rechaza Error genéricos (fail-fast en lo desconocido)', () => {
    expect(isRetryable(new Error('?'))).toBe(false);
    expect(isRetryable('string')).toBe(false);
    expect(isRetryable(null)).toBe(false);
  });

  it('isAuthError discrimina HttpError vs otros', () => {
    expect(isAuthError(new HttpError(401, 'x'))).toBe(true);
    expect(isAuthError(new HttpError(500, 'x'))).toBe(false);
    expect(isAuthError(new NetworkError('x'))).toBe(false);
    expect(isAuthError(new Error('x'))).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('parsea delta-seconds en ms', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('parsea HTTP-date como delta hacia ahora', () => {
    const future = new Date(Date.now() + 5_000).toUTCString();
    const ms = parseRetryAfter(future);
    expect(ms).toBeGreaterThan(2_000);
    expect(ms).toBeLessThanOrEqual(5_500);
  });

  it('devuelve undefined ante header faltante o inválido', () => {
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('not-a-number-or-date')).toBeUndefined();
  });

  it('toma el primer valor cuando el header es array', () => {
    expect(parseRetryAfter(['10', '20'])).toBe(10_000);
  });
});

describe('extractErrorMessage', () => {
  it('saca campo `mensaje` de objetos JSON', () => {
    expect(extractErrorMessage({ mensaje: 'algo' }, 500)).toBe('algo');
  });

  it('saca campo `message` cuando no hay `mensaje`', () => {
    expect(extractErrorMessage({ message: 'else' }, 500)).toBe('else');
  });

  it('devuelve string crudo tal cual', () => {
    expect(extractErrorMessage('boom', 500)).toBe('boom');
  });

  it('trunca cuerpos muy largos para no inundar logs', () => {
    const long = 'x'.repeat(2000);
    const out = extractErrorMessage(long, 500);
    expect(out.length).toBeLessThan(long.length);
    expect(out).toContain('[truncado]');
  });

  it('placeholder cuando el body es nulo / no parseable', () => {
    expect(extractErrorMessage(null, 502)).toContain('502');
    expect(extractErrorMessage(undefined, 502)).toContain('502');
  });
});
