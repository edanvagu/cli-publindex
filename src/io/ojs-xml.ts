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

// Mapea locale OJS → label del idioma. El Excel guarda labels; el mapper
// traduce a código al construir el payload para Publindex.
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
  // Nota: se matchea hasta el primer </publication> (no </article>) para saltarse los
  // <submission_file> inline que contienen PDFs en base64 (varios MB por artículo).
  return extractBlocksStreaming(file, /<article\b[\s\S]*?<publication[\s>][\s\S]*?<\/publication>/g);
}

function extractBlocksStreaming(file: string, regex: RegExp): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 256 * 1024 });
    const blocks: string[] = [];
    // buf nunca acumula base64 de <submission_file> en curso — esos PDFs se
    // descartan en vuelo. Cuidado: <submission_file_ref/> aparece adentro de
    // <publication> y NO debe confundirse con la apertura real.
    let buf = '';
    let dentroDeSubmissionFile = false;

    stream.on('data', (rawChunk) => {
      const chunk = typeof rawChunk === 'string' ? rawChunk : rawChunk.toString('utf8');
      let aAgregar: string = chunk;

      if (dentroDeSubmissionFile) {
        const ci = chunk.indexOf(SUBMISSION_FILE_CLOSE_TAG);
        if (ci === -1) return;
        aAgregar = chunk.slice(ci + SUBMISSION_FILE_CLOSE_TAG.length);
        dentroDeSubmissionFile = false;
      }

      buf += aAgregar;
      buf = buf.replace(SUBMISSION_FILE_BLOCK_RE, '');

      const openMatch = buf.match(SUBMISSION_FILE_OPEN_RE);
      if (openMatch && openMatch.index !== undefined) {
        buf = buf.slice(0, openMatch.index);
        dentroDeSubmissionFile = true;
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

  const localePrimario: string = pub['@_locale'] ?? 'es_ES';

  const titulo = textByLocale(pub.title, localePrimario) ?? '';
  const tituloIngles = textByLocale(pub.title, 'en_US');

  const resumen = cleanHtml(textByLocale(pub.abstract, localePrimario));
  const resumenOtroIdioma = cleanHtml(textByLocale(pub.abstract, 'en_US', localePrimario));
  const resumenIdiomaAdicional = cleanHtml(thirdLocale(pub.abstract, localePrimario, 'en_US'));

  const palabrasClave = keywordsToString(pub.keywords, localePrimario);
  const palabrasClaveOtroIdioma = keywordsToString(pub.keywords, 'en_US', localePrimario);

  const doi = extractDoi(pub.id);
  const submissionId = extractInternalId(pub.id);
  const { paginaInicial, paginaFinal, raw: paginasRaw } = splitPages(pub.pages);

  const autoresArr = pub.authors?.author;
  const numeroAutores = Array.isArray(autoresArr) ? autoresArr.length : undefined;
  const autores: OjsAuthor[] = Array.isArray(autoresArr)
    ? autoresArr.map((a: any) => parseAuthor(a, localePrimario)).filter((a): a is OjsAuthor => a !== null)
    : [];

  const citasArr = pub.citations?.citation;
  const numeroReferencias = Array.isArray(citasArr) ? citasArr.length : undefined;

  const idioma = LOCALE_TO_LANGUAGE[localePrimario];
  const otroIdioma = inferOtherLanguage(pub, localePrimario);

  const fechaPublicacion = pub['@_date_published'];

  const art: OjsArticle = { titulo, autores };
  if (submissionId) art.submissionId = submissionId;
  if (tituloIngles && tituloIngles !== titulo) art.tituloIngles = tituloIngles;
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

  // El submission_id vive en el <article>, no en <publication>.
  // Tomamos el primer <id type="internal"> que aparezca antes del primer <publication>.
  const headerFin = xml.indexOf('<publication');
  const header = headerFin > 0 ? xml.slice(0, headerFin) : xml;
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
  const warnings = nonStandard.map(({ indice, valor }) =>
    `Fila ${indice + 2}: <pages>="${valor}" no es un rango estándar (posible e-locator de publicación continua). Revisar manualmente.`
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

function parseAuthor(a: any, localePrimario: string): OjsAuthor | null {
  const given = pickLocalized(a.givenname, localePrimario);
  const family = pickLocalized(a.familyname, localePrimario);
  const nombre = [given, family].filter(Boolean).join(' ').trim();
  if (!nombre) return null;

  const country = typeof a.country === 'string' ? a.country.trim().toUpperCase() : undefined;
  const nacionalidad = country === 'CO' ? 'Colombiana' : 'Extranjera';

  const filiacion = pickLocalized(a.affiliation, localePrimario);

  const result: OjsAuthor = { nombre_completo: nombre, nacionalidad };
  if (filiacion) result.filiacion_institucional = filiacion;
  return result;
}

// OJS representa campos localizados como objeto con locales como propiedades
// (p.ej. `{es_ES: 'Texto', en_US: 'Text'}`) o como string simple, o con el
// wrapper `@_locale`. Esta helper normaliza los 3 casos.
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
): { indice: number; valor: string }[] {
  const result: { indice: number; valor: string }[] = [];
  articles.forEach((art, indice) => {
    if (art.paginasRaw) result.push({ indice, valor: art.paginasRaw });
  });
  return result;
}

function textByLocale(arr: any, locale: string, excluir?: string): string | undefined {
  if (!Array.isArray(arr)) return undefined;
  const match = arr.find((n) => n['@_locale'] === locale && (!excluir || n['@_locale'] !== excluir));
  if (!match) return undefined;
  const valor = typeof match === 'object' ? match['#text'] ?? '' : String(match);
  return valor ? String(valor) : undefined;
}

function thirdLocale(arr: any, skip1: string, skip2: string): string | undefined {
  if (!Array.isArray(arr)) return undefined;
  const match = arr.find((n) => n['@_locale'] !== skip1 && n['@_locale'] !== skip2);
  if (!match) return undefined;
  const valor = typeof match === 'object' ? match['#text'] ?? '' : String(match);
  return valor ? String(valor) : undefined;
}

function keywordsToString(keywordsArr: any, locale: string, excluir?: string): string | undefined {
  if (!Array.isArray(keywordsArr)) return undefined;
  const match = keywordsArr.find((k) => k['@_locale'] === locale && (!excluir || k['@_locale'] !== excluir));
  if (!match || !Array.isArray(match.keyword)) return undefined;
  const palabras = match.keyword.map((k: any) => String(k).trim()).filter(Boolean);
  return palabras.length ? palabras.join('; ') : undefined;
}

function extractDoi(ids: any): string | undefined {
  if (!Array.isArray(ids)) return undefined;
  const doiNode = ids.find((i) => i['@_type'] === 'doi');
  if (!doiNode) return undefined;
  const valor = typeof doiNode === 'object' ? doiNode['#text'] : doiNode;
  if (!valor) return undefined;
  return String(valor).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim() || undefined;
}

function extractInternalId(ids: any): string | undefined {
  if (!Array.isArray(ids)) return undefined;
  const node = ids.find((i) => i['@_type'] === 'internal');
  if (!node) return undefined;
  const valor = typeof node === 'object' ? node['#text'] : node;
  return valor != null ? String(valor).trim() || undefined : undefined;
}

function splitPages(pages: any): { paginaInicial?: string; paginaFinal?: string; raw?: string } {
  if (!pages) return {};
  const texto = String(pages).trim();
  if (!texto) return {};
  const m = texto.match(/^(\d+)\s*[-\u2013\u2014]\s*(\d+)$/);
  if (m) return { paginaInicial: m[1], paginaFinal: m[2] };
  return { raw: texto };
}

function inferOtherLanguage(pub: any, primario: string): string | undefined {
  const localesVistos = new Set<string>();
  for (const key of ['title', 'abstract', 'keywords']) {
    const arr = pub[key];
    if (Array.isArray(arr)) {
      for (const n of arr) {
        const l = n['@_locale'];
        if (l && l !== primario) localesVistos.add(l);
      }
    }
  }
  if (localesVistos.has('en_US')) return 'Inglés';
  for (const l of localesVistos) {
    if (LOCALE_TO_LANGUAGE[l]) return LOCALE_TO_LANGUAGE[l];
  }
  return undefined;
}

