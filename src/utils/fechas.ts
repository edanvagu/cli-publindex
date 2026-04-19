export function parseFechaToDate(valor: string): Date | null {
  let match = valor.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  match = valor.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const d = new Date(parseInt(match[3], 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Publindex espera timestamps con hora Colombia (UTC-5): T05:00:00.000Z
export function parseFechaToISO(valor: string): string {
  const d = parseFechaToDate(valor) ?? (isNaN(new Date(valor).getTime()) ? null : new Date(valor));
  if (!d) return valor;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 5, 0, 0)).toISOString();
}
