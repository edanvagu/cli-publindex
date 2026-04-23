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

// Publindex expects ISO timestamps anchored at Colombian midnight (UTC-5), which serializes as `T05:00:00.000Z`. Without this offset Publindex re-parses the date one day earlier in the UI.
export function parseDateToIso(value: string): string {
  const d = parseDate(value) ?? (isNaN(new Date(value).getTime()) ? null : new Date(value));
  if (!d) return value;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 5, 0, 0)).toISOString();
}

// Filename-safe timestamp suffix in `YYYYMMDD-HHmmss` form.
export function formatTimestampCompact(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
