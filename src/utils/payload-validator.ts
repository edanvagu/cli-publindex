import type { ZodType } from 'zod';

// The retry layer treats plain Error as non-retryable, so a bad payload fails the row immediately instead of burning retries. ZodError would be retryable by default; that's why we re-throw.
export function assertPayload<T>(schema: ZodType<T>, payload: unknown, entityLabel: string): void {
  const result = schema.safeParse(payload);
  if (result.success) return;
  const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  throw new Error(`Payload de ${entityLabel} inválido — ${issues}`);
}
