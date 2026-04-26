export function parseDate(value: string): Date | null {
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return buildDateStrict(parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10));
  }
  match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    return buildDateStrict(parseInt(match[3], 10), parseInt(match[2], 10), parseInt(match[1], 10));
  }
  return null;
}

// JavaScript's Date constructor silently overflows: `new Date(2025, 9, 36)` becomes November 5 instead of failing. We re-read the components and reject if they were normalized — that catches "36 de octubre" and similar nonsense before it reaches the CLI or the payload schema.
function buildDateStrict(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
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
