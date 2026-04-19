export function normalizeBaseUrl(base: string): string {
  const trimmed = base.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, '');
}

export function buildArticleUrl(base: string, submissionId: string): string {
  return `${normalizeBaseUrl(base)}/article/view/${submissionId}`;
}
