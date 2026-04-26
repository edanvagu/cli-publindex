import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../../src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  it('arranca cerrado (no aborta)', () => {
    const cb = new CircuitBreaker();
    expect(cb.shouldAbort().abort).toBe(false);
  });

  it('aborta tras N fallos consecutivos', () => {
    const cb = new CircuitBreaker({ consecutiveFailureThreshold: 3, totalFailureThreshold: 100 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.shouldAbort().abort).toBe(false);
    cb.recordFailure();
    const decision = cb.shouldAbort();
    expect(decision.abort).toBe(true);
    expect(decision.reason).toContain('consecutivos');
  });

  it('un éxito resetea la racha consecutiva', () => {
    const cb = new CircuitBreaker({ consecutiveFailureThreshold: 3, totalFailureThreshold: 100 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.shouldAbort().abort).toBe(false);
  });

  it('aborta cuando se acumulan demasiados fallos totales aunque haya éxitos intercalados', () => {
    const cb = new CircuitBreaker({ consecutiveFailureThreshold: 100, totalFailureThreshold: 4 });
    for (let i = 0; i < 4; i++) {
      cb.recordFailure();
      cb.recordSuccess();
    }
    const decision = cb.shouldAbort();
    expect(decision.abort).toBe(true);
    expect(decision.reason).toContain('totales');
  });

  it('snapshot devuelve el estado actual', () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.snapshot()).toEqual({ consecutive: 2, total: 2, tripped: false });
    cb.recordSuccess();
    expect(cb.snapshot()).toEqual({ consecutive: 0, total: 2, tripped: false });
  });

  it('trip(reason) marca el breaker como abortado independiente de los umbrales', () => {
    const cb = new CircuitBreaker({ consecutiveFailureThreshold: 100, totalFailureThreshold: 100 });
    expect(cb.isTripped()).toBe(false);
    cb.trip('token rechazado');
    expect(cb.isTripped()).toBe(true);
    expect(cb.shouldAbort().reason).toBe('token rechazado');
  });
});
