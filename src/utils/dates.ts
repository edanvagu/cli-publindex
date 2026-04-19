export function parseDate(value: string): Date | null {
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const d = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Publindex espera timestamps con hora Colombia (UTC-5): T05:00:00.000Z
export function parseDateToIso(value: string): string {
  const d = parseDate(value) ?? (isNaN(new Date(value).getTime()) ? null : new Date(value));
  if (!d) return value;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 5, 0, 0)).toISOString();
}
