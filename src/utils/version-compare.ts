// Numeric segments compare numerically ('1.10.0' > '1.9.0', not lexicographic). Pre-release suffixes sort BEFORE the corresponding release per semver spec ('1.2.0-rc.1' < '1.2.0').
export function compareSemver(a: string, b: string): number {
  const [aMain, aPre] = stripV(a).split('-', 2);
  const [bMain, bPre] = stripV(b).split('-', 2);
  const aParts = aMain.split('.').map((n) => parseInt(n, 10) || 0);
  const bParts = bMain.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  if (aPre && !bPre) return -1;
  if (!aPre && bPre) return 1;
  if (aPre && bPre) {
    if (aPre < bPre) return -1;
    if (aPre > bPre) return 1;
  }
  return 0;
}

function stripV(v: string): string {
  return v.startsWith('v') ? v.slice(1) : v;
}
