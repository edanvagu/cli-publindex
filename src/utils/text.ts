const TAG_RE = /<[^>]+>/g;
const NBSP_RE = /&nbsp;/g;
const NUMERIC_ENTITY_RE = /&#(\d+);/g;
const HEX_ENTITY_RE = /&#x([0-9a-f]+);/gi;
const WHITESPACE_RE = /\s+/g;
const SPACE_BEFORE_PUNCT_RE = /\s+([.,;:!?)])/g;
const COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;

export function cleanHtml(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const normalized = String(text)
    .replace(TAG_RE, ' ')
    .replace(NBSP_RE, ' ')
    .replace(NUMERIC_ENTITY_RE, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(HEX_ENTITY_RE, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(WHITESPACE_RE, ' ')
    .replace(SPACE_BEFORE_PUNCT_RE, '$1')
    .trim();
  return normalized || undefined;
}

// Used to compare titles between the Excel and the Publindex server-side catalog. Publindex may round-trip titles through normalization that drops accents or changes whitespace, so we strip diacritics and collapse spaces to avoid false negatives on duplicate detection.
export function normalizeTitle(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_RE, '')
    .toLowerCase()
    .replace(WHITESPACE_RE, ' ')
    .trim();
}
