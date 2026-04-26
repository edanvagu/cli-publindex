import { describe, it, expect } from 'vitest';
import { compareSemver } from '../../src/utils/version-compare';

describe('compareSemver', () => {
  it('returns 0 for identical versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });

  it('compares major versions numerically', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.9.9', '2.0.0')).toBe(-1);
  });

  it('compares minor versions numerically (10 > 9, not lexicographic)', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
    expect(compareSemver('1.9.0', '1.10.0')).toBe(-1);
  });

  it('compares patch versions numerically', () => {
    expect(compareSemver('1.2.10', '1.2.9')).toBe(1);
    expect(compareSemver('1.2.9', '1.2.10')).toBe(-1);
  });

  it('strips a leading "v" prefix on either side', () => {
    expect(compareSemver('v1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('v1.3.0', 'v1.2.0')).toBe(1);
  });

  it('treats a missing segment as 0 (1.2 == 1.2.0)', () => {
    expect(compareSemver('1.2', '1.2.0')).toBe(0);
    expect(compareSemver('1', '1.0.0')).toBe(0);
  });

  it('sorts pre-release BEFORE the corresponding release', () => {
    expect(compareSemver('1.2.0-rc.1', '1.2.0')).toBe(-1);
    expect(compareSemver('1.2.0', '1.2.0-rc.1')).toBe(1);
  });

  it('compares two pre-releases lexicographically', () => {
    expect(compareSemver('1.2.0-rc.1', '1.2.0-rc.2')).toBe(-1);
    expect(compareSemver('1.2.0-rc.2', '1.2.0-rc.1')).toBe(1);
    expect(compareSemver('1.2.0-alpha', '1.2.0-beta')).toBe(-1);
  });

  it('release > pre-release across different patch levels still respects main version order', () => {
    expect(compareSemver('1.2.1', '1.2.0-rc.99')).toBe(1);
    expect(compareSemver('1.2.0-rc.1', '1.3.0')).toBe(-1);
  });
});
