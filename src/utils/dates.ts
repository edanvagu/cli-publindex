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

// Formato `YYYYMMDD-HHmmss` para sufijos de archivo (timestamps filename-safe).
export function formatTimestampCompact(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
