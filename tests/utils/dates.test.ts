import { describe, it, expect } from 'vitest';
import { parseDate } from '../../src/utils/dates';

describe('parseDate', () => {
  it('acepta YYYY-MM-DD válida', () => {
    const d = parseDate('2025-04-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(15);
  });

  it('acepta DD/MM/YYYY válida', () => {
    const d = parseDate('15/04/2025');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
  });

  it('rechaza día fuera de rango (overflow del constructor de Date)', () => {
    expect(parseDate('2025-10-36')).toBeNull();
    expect(parseDate('2025-02-30')).toBeNull();
    expect(parseDate('36/10/2025')).toBeNull();
  });

  it('rechaza mes fuera de rango', () => {
    expect(parseDate('2025-13-01')).toBeNull();
    expect(parseDate('2025-00-15')).toBeNull();
  });

  it('rechaza día 0', () => {
    expect(parseDate('2025-04-00')).toBeNull();
  });

  it('rechaza string sin formato válido', () => {
    expect(parseDate('no es fecha')).toBeNull();
    expect(parseDate('2025/04/15')).toBeNull(); // separador con slash en formato YYYY no soportado
  });
});
