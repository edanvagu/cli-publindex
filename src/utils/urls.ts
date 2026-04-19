export function normalizarBaseUrl(base: string): string {
  const trimmed = base.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, '');
}

export function construirUrlArticulo(base: string, submissionId: string): string {
  return `${normalizarBaseUrl(base)}/article/view/${submissionId}`;
}
