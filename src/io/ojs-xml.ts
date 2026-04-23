import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { ArticleRow } from '../entities/articles/types';
import { cleanHtml } from '../utils/text';

export interface OjsAuthor {
  nombre_completo: string;
  nacionalidad: string;              // "Colombiana" | "Extranjera"
  filiacion_institucional?: string;
}

export interface OjsArticle {
  titulo: string;
  submissionId?: string;
  tituloIngles?: string;
  doi?: string;
  paginaInicial?: string;
  paginaFinal?: string;
  paginasRaw?: string;
  numeroAutores?: number;
  numeroReferencias?: number;
  resumen?: string;
  resumenOtroIdioma?: string;
  resumenIdiomaAdicional?: string;
  palabrasClave?: string;
  palabrasClaveOtroIdioma?: string;
  idioma?: string;
  otroIdioma?: string;
  fechaPublicacion?: string;
  autores: OjsAuthor[];
}

export interface ImportOjsResult {
  articles: OjsArticle[];
  warnings: string[];
}

export interface OjsAuthorRow {
  titulo_articulo: string;
  nombre_completo: string;
  nacionalidad: string;
  filiacion_institucional?: string;
}

// OJS locale → user-facing language label. The Excel template stores labels; the article mapper translates label → Publindex code when building the payload.
const LOCALE_TO_LANGUAGE: Record<string, string> = {
  es_ES: 'Español', en_US: 'Inglés', pt_BR: 'Portugués', fr_FR: 'Francés', de_DE: 'Alemán', it_IT: 'Italiano',
};

const ARRAY_TAGS = new Set([
  'title', 'abstract', 'keywords', 'keyword', 'author', 'citation', 'id',
  'givenname', 'familyname', 'affiliation',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ARRAY_TAGS.has(name),
});

const SUBMISSION_FILE_BLOCK_RE = /<submission_file\b[\s\S]*?<\/submission_file>/g;
const SUBMISSION_FILE_OPEN_RE = /<submission_file[\s>\/]/;
const SUBMISSION_FILE_CLOSE_TAG = '</submission_file>';

export function extractPublicationsXml(xml: string): string[] {
  const re = /<publication[\s>][\s\S]*?<\/publication>/g;
  return xml.match(re) ?? [];
}

export function extractArticlesFromFile(file: string): Promise<string[]> {
  // Match up to the first </publication> (not </article>) so that inline <submission_file> blocks — which embed multi-MB base64-encoded PDFs per article — are skipped instead of being buffered into memory.
  return extractBlocksStreaming(file, /<article\b[\s\S]*?<publication[\s>][\s\S]*?<\/publication>/g);
}

function extractBlocksStreaming(file: string, regex: RegExp): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 256 * 1024 });
    const blocks: string[] = [];
    // `buf` must never accumulate the base64 body of an in-flight <submission_file>; those PDFs are dropped on the wire. Note: <submission_file_ref/> appears inside <publication> and must NOT be mistaken for a real opening tag.
    let buf = '';
    let insideSubmissionFile = false;

    stream.on('data', (rawChunk) => {
      const chunk = typeof rawChunk === 'string' ? rawChunk : rawChunk.toString('utf8');
      let toAppend: string = chunk;

      if (insideSubmissionFile) {
        const ci = chunk.indexOf(SUBMISSION_FILE_CLOSE_TAG);
        if (ci === -1) return;
        toAppend = chunk.slice(ci + SUBMISSION_FILE_CLOSE_TAG.length);
        insideSubmissionFile = false;
      }

      buf += toAppend;
      buf = buf.replace(SUBMISSION_FILE_BLOCK_RE, '');

      const openMatch = buf.match(SUBMISSION_FILE_OPEN_RE);
      if (openMatch && openMatch.index !== undefined) {
        buf = buf.slice(0, openMatch.index);
        insideSubmissionFile = true;
      }

      let lastIdx = 0;
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(buf)) !== null) {
        blocks.push(m[0]);
        lastIdx = regex.lastIndex;
      }
      if (lastIdx > 0) buf = buf.slice(lastIdx);
    });

    stream.on('end', () => resolve(blocks));
    stream.on('error', reject);
  });
}

export function parsePublication(xml: string): OjsArticle {
  const parsed = parser.parse(xml);
  const pub = parsed.publication;
  if (!pub) {
    throw new Error('Bloque <publication> inválido');
  }

  const primaryLocale: string = pub['@_locale'] ?? 'es_ES';

  // Publindex requires Spanish in the main columns. When the XML has no es_* locale we fall back to the primary and duplicate it into the _otro_idioma column so both slots are always populated (editor translates by hand afterward). Prefix match accepts variants like es_CO and en_GB.
  const isSpanish = (l: string) => l.toLowerCase().startsWith('es');
  const isEnglish = (l: string) => l.toLowerCase().startsWith('en');
  const isOtherLang = (l: string) => !!l && !isSpanish(l) && !isEnglish(l);

  const spanishTitle = nodeText(findLocalizedNode(pub.title, isSpanish));
  const englishTitle = nodeText(findLocalizedNode(pub.title, isEnglish));
  const primaryTitle = nodeText(findLocalizedNode(pub.title, (l) => l === primaryLocale));
  const titulo = spanishTitle ?? primaryTitle ?? '';
  const tituloIngles = englishTitle ?? (spanishTitle ? undefined : titulo || undefined);

  const spanishAbstract = cleanHtml(nodeText(findLocalizedNode(pub.abstract, isSpanish)));
  const englishAbstract = cleanHtml(nodeText(findLocalizedNode(pub.abstract, isEnglish)));
  const primaryAbstract = cleanHtml(nodeText(findLocalizedNode(pub.abstract, (l) => l === primaryLocale)));
  const resumen = spanishAbstract || primaryAbstract;
  const resumenOtroIdioma = englishAbstract || (spanishAbstract ? undefined : resumen);
  const resumenIdiomaAdicional = cleanHtml(nodeText(findLocalizedNode(pub.abstract, isOtherLang)));

  const spanishKeywords = keywordsFromNode(findLocalizedNode(pub.keywords, isSpanish));
  const englishKeywords = keywordsFromNode(findLocalizedNode(pub.keywords, isEnglish));
  const primaryKeywords = keywordsFromNode(findLocalizedNode(pub.keywords, (l) => l === primaryLocale));
  const palabrasClave = spanishKeywords ?? primaryKeywords;
  const palabrasClaveOtroIdioma = englishKeywords ?? (spanishKeywords ? undefined : palabrasClave);

  const doi = extractDoi(pub.id);
  const submissionId = extractInternalId(pub.id);
  const { paginaInicial, paginaFinal, raw: paginasRaw } = splitPages(pub.pages);

  const authorsArr = pub.authors?.author;
  const numeroAutores = Array.isArray(authorsArr) ? authorsArr.length : undefined;
  const autores: OjsAuthor[] = Array.isArray(authorsArr)
    ? authorsArr.map((a: any) => parseAuthor(a, primaryLocale)).filter((a): a is OjsAuthor => a !== null)
    : [];

  const citationsArr = pub.citations?.citation;
  const numeroReferencias = Array.isArray(citationsArr) ? citationsArr.length : undefined;

  const idioma = LOCALE_TO_LANGUAGE[primaryLocale];
  const otroIdioma = inferOtherLanguage(pub, primaryLocale);

  const fechaPublicacion = pub['@_date_published'];

  const art: OjsArticle = { titulo, autores };
  if (submissionId) art.submissionId = submissionId;
  if (tituloIngles) art.tituloIngles = tituloIngles;
  if (doi) art.doi = doi;
  if (paginaInicial) art.paginaInicial = paginaInicial;
  if (paginaFinal) art.paginaFinal = paginaFinal;
  if (paginasRaw) art.paginasRaw = paginasRaw;
  if (numeroAutores) art.numeroAutores = numeroAutores;
  if (numeroReferencias) art.numeroReferencias = numeroReferencias;
  if (resumen) art.resumen = resumen;
  if (resumenOtroIdioma) art.resumenOtroIdioma = resumenOtroIdioma;
  if (resumenIdiomaAdicional) art.resumenIdiomaAdicional = resumenIdiomaAdicional;
  if (palabrasClave) art.palabrasClave = palabrasClave;
  if (palabrasClaveOtroIdioma) art.palabrasClaveOtroIdioma = palabrasClaveOtroIdioma;
  if (idioma) art.idioma = idioma;
  if (otroIdioma) art.otroIdioma = otroIdioma;
  if (fechaPublicacion) art.fechaPublicacion = fechaPublicacion;

  return art;
}

export function parseArticle(xml: string): OjsArticle {
  const publicaciones = extractPublicationsXml(xml);
  if (publicaciones.length === 0) {
    throw new Error('<article> sin <publication> interno');
  }

  const articleOpen = xml.match(/<article\b[^>]*>/);
  const currentIdMatch = articleOpen?.[0].match(/current_publication_id="([^"]+)"/);
  const currentPublicationId = currentIdMatch?.[1];

  let chosenPub = publicaciones[0];
  if (currentPublicationId && publicaciones.length > 1) {
    const match = publicaciones.find((p) => {
      const inner = p.match(/<id\s+type="internal"[^>]*>([^<]+)<\/id>/);
      return inner?.[1] === currentPublicationId;
    });
    if (match) chosenPub = match;
  }

  const art = parsePublication(chosenPub);

  // submission_id lives on <article>, not on <publication>. Grab the first <id type="internal"> that appears before the first <publication> tag.
  const headerEnd = xml.indexOf('<publication');
  const header = headerEnd > 0 ? xml.slice(0, headerEnd) : xml;
  const articleIdMatch = header.match(/<id\s+type="internal"[^>]*>([^<]+)<\/id>/);
  if (articleIdMatch) {
    art.submissionId = articleIdMatch[1].trim();
  } else {
    delete art.submissionId;
  }

  return art;
}

export function ojsArticleToRow(art: OjsArticle, url?: string): Partial<ArticleRow> {
  const row: Partial<ArticleRow> = { titulo: art.titulo };
  if (url) row.url = url;
  if (art.tituloIngles) row.titulo_ingles = art.tituloIngles;
  if (art.doi) row.doi = art.doi;
  if (art.paginaInicial) row.pagina_inicial = art.paginaInicial;
  if (art.paginaFinal) row.pagina_final = art.paginaFinal;
  if (art.numeroAutores !== undefined) row.numero_autores = String(art.numeroAutores);
  if (art.numeroReferencias !== undefined) row.numero_referencias = String(art.numeroReferencias);
  if (art.resumen) row.resumen = art.resumen;
  if (art.resumenOtroIdioma) row.resumen_otro_idioma = art.resumenOtroIdioma;
  if (art.resumenIdiomaAdicional) row.resumen_idioma_adicional = art.resumenIdiomaAdicional;
  if (art.palabrasClave) row.palabras_clave = art.palabrasClave;
  if (art.palabrasClaveOtroIdioma) row.palabras_clave_otro_idioma = art.palabrasClaveOtroIdioma;
  if (art.idioma) row.idioma = art.idioma;
  if (art.otroIdioma) row.otro_idioma = art.otroIdioma;
  return row;
}

export async function importFromOjs(file: string): Promise<ImportOjsResult> {
  const blocks = await extractArticlesFromFile(file);
  const articles = blocks.map(parseArticle);

  const nonStandard = detectNonStandardPages(articles);
  const warnings = nonStandard.map(({ index, value }) =>
    `Fila ${index + 2}: <pages>="${value}" no es un rango estándar (posible e-locator de publicación continua). Revisar manualmente.`
  );

  return { articles, warnings };
}

export function articlesToAuthorRows(articles: OjsArticle[]): OjsAuthorRow[] {
  const rows: OjsAuthorRow[] = [];
  for (const art of articles) {
    for (const a of art.autores) {
      rows.push({
        titulo_articulo: art.titulo,
        nombre_completo: a.nombre_completo,
        nacionalidad: a.nacionalidad,
        filiacion_institucional: a.filiacion_institucional,
      });
    }
  }
  return rows;
}

function parseAuthor(a: any, primaryLocale: string): OjsAuthor | null {
  const given = pickLocalized(a.givenname, primaryLocale);
  const family = pickLocalized(a.familyname, primaryLocale);
  const fullName = [given, family].filter(Boolean).join(' ').trim();
  if (!fullName) return null;

  const country = typeof a.country === 'string' ? a.country.trim().toUpperCase() : undefined;
  const nacionalidad = country === 'CO' ? 'Colombiana' : 'Extranjera';

  const affiliation = pickLocalized(a.affiliation, primaryLocale);

  const result: OjsAuthor = { nombre_completo: fullName, nacionalidad };
  if (affiliation) result.filiacion_institucional = affiliation;
  return result;
}

// OJS represents localized fields three ways: a plain string, an object whose keys are locales (`{es_ES: 'Texto', en_US: 'Text'}`), or an array of nodes each carrying a `@_locale` attribute. This helper normalizes all three.
function pickLocalized(node: any, locale: string): string | undefined {
  if (node == null) return undefined;
  if (typeof node === 'string') return node.trim() || undefined;

  if (Array.isArray(node)) {
    const match = node.find((n: any) => n['@_locale'] === locale);
    if (match) return typeof match === 'string' ? match : (match['#text'] ?? '').toString().trim() || undefined;
    const first = node[0];
    if (first) return typeof first === 'string' ? first : (first['#text'] ?? '').toString().trim() || undefined;
    return undefined;
  }

  if (typeof node === 'object') {
    if (node[locale]) return String(node[locale]).trim() || undefined;
    if (node['#text']) return String(node['#text']).trim() || undefined;
    for (const k of Object.keys(node)) {
      if (k.startsWith('@_')) continue;
      const v = node[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return undefined;
}

export function detectNonStandardPages(
  articles: Pick<OjsArticle, 'paginasRaw'>[]
): { index: number; value: string }[] {
  const result: { index: number; value: string }[] = [];
  articles.forEach((art, index) => {
    if (art.paginasRaw) result.push({ index, value: art.paginasRaw });
  });
  return result;
}

function findLocalizedNode(arr: any, predicate: (locale: string) => boolean): any {
  if (!Array.isArray(arr)) return undefined;
  return arr.find((n) => {
    const l = typeof n['@_locale'] === 'string' ? n['@_locale'] : '';
    return predicate(l);
  });
}

function nodeText(node: any): string | undefined {
  if (!node) return undefined;
  const value = typeof node === 'object' ? node['#text'] ?? '' : String(node);
  return value ? String(value) : undefined;
}

function keywordsFromNode(node: any): string | undefined {
  if (!node || !Array.isArray(node.keyword)) return undefined;
  const words = node.keyword.map((k: any) => String(k).trim()).filter(Boolean);
  return words.length ? words.join('; ') : undefined;
}

function extractDoi(ids: any): string | undefined {
  if (!Array.isArray(ids)) return undefined;
  const doiNode = ids.find((i) => i['@_type'] === 'doi');
  if (!doiNode) return undefined;
  const value = typeof doiNode === 'object' ? doiNode['#text'] : doiNode;
  if (!value) return undefined;
  return String(value).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim() || undefined;
}

function extractInternalId(ids: any): string | undefined {
  if (!Array.isArray(ids)) return undefined;
  const node = ids.find((i) => i['@_type'] === 'internal');
  if (!node) return undefined;
  const value = typeof node === 'object' ? node['#text'] : node;
  return value != null ? String(value).trim() || undefined : undefined;
}

function splitPages(pages: any): { paginaInicial?: string; paginaFinal?: string; raw?: string } {
  if (!pages) return {};
  const text = String(pages).trim();
  if (!text) return {};
  const m = text.match(/^(\d+)\s*[-\u2013\u2014]\s*(\d+)$/);
  if (m) return { paginaInicial: m[1], paginaFinal: m[2] };
  return { raw: text };
}

function inferOtherLanguage(pub: any, primaryLocale: string): string | undefined {
  const localesSeen = new Set<string>();
  for (const key of ['title', 'abstract', 'keywords']) {
    const arr = pub[key];
    if (Array.isArray(arr)) {
      for (const n of arr) {
        const l = n['@_locale'];
        if (l && l !== primaryLocale) localesSeen.add(l);
      }
    }
  }
  if (localesSeen.has('en_US')) return 'Inglés';
  for (const l of localesSeen) {
    if (LOCALE_TO_LANGUAGE[l]) return LOCALE_TO_LANGUAGE[l];
  }
  return undefined;
}

