import { DEFAULTS } from '../config/constants';

export interface CircuitBreakerOptions {
  // After this many failures in a row (no successes in between), abort the run. Catches the "Publindex went down mid-batch" case.
  consecutiveFailureThreshold?: number;
  // After this many TOTAL failures in the run, abort regardless of consecutiveness. Catches the "everything is slowly going wrong" / dead-token / rate-limited cases.
  totalFailureThreshold?: number;
}

export interface AbortDecision {
  abort: boolean;
  reason?: string;
}

// Tracks failure cadence across a single upload run and signals when the run should stop blasting requests at an unhealthy server. Auth errors (401/403) bypass the threshold logic via `trip()` because retrying with the same dead token is guaranteed to fail.
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private totalFailures = 0;
  private trippedReason: string | null = null;
  private readonly consecutiveThreshold: number;
  private readonly totalThreshold: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.consecutiveThreshold = options.consecutiveFailureThreshold ?? DEFAULTS.CIRCUIT_CONSECUTIVE_FAILURES;
    this.totalThreshold = options.totalFailureThreshold ?? DEFAULTS.CIRCUIT_TOTAL_FAILURES;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    this.totalFailures++;
  }

  // Forcibly abort the run with a custom reason — used for terminal conditions like a 401/403 where reaching a threshold makes no sense (every subsequent request will fail the same way).
  trip(reason: string): void {
    this.trippedReason = reason;
  }

  shouldAbort(): AbortDecision {
    if (this.trippedReason) {
      return { abort: true, reason: this.trippedReason };
    }
    if (this.consecutiveFailures >= this.consecutiveThreshold) {
      return {
        abort: true,
        reason: `${this.consecutiveFailures} fallos consecutivos (umbral ${this.consecutiveThreshold}). Abortando para no sobrecargar Publindex.`,
      };
    }
    if (this.totalFailures >= this.totalThreshold) {
      return {
        abort: true,
        reason: `${this.totalFailures} fallos totales en la corrida (umbral ${this.totalThreshold}). Abortando para no sobrecargar Publindex.`,
      };
    }
    return { abort: false };
  }

  isTripped(): boolean {
    return this.shouldAbort().abort;
  }

  snapshot(): { consecutive: number; total: number; tripped: boolean } {
    return {
      consecutive: this.consecutiveFailures,
      total: this.totalFailures,
      tripped: this.isTripped(),
    };
  }
}
