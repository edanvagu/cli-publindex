import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { ArticuloRow } from './types';

export interface OjsArticulo {
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
}

export interface ImportOjsResult {
  articulos: OjsArticulo[];
  advertencias: string[];
}

const LOCALE_A_IDIOMA: Record<string, string> = {
  es_ES: 'ES', en_US: 'EN', pt_BR: 'PT', fr_FR: 'FR', de_DE: 'DE', it_IT: 'IT',
};

const ARRAY_TAGS = new Set(['title', 'abstract', 'keywords', 'keyword', 'author', 'citation', 'id']);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ARRAY_TAGS.has(name),
});

const SUBMISSION_FILE_BLOCK_RE = /<submission_file\b[\s\S]*?<\/submission_file>/g;
const SUBMISSION_FILE_OPEN_RE = /<submission_file[\s>\/]/;
const SUBMISSION_FILE_CLOSE_TAG = '</submission_file>';

export function extraerPublicationsXml(xml: string): string[] {
  const re = /<publication[\s>][\s\S]*?<\/publication>/g;
  return xml.match(re) ?? [];
}

export function extraerArticlesDeArchivo(archivo: string): Promise<string[]> {
  // Nota: se matchea hasta el primer </publication> (no </article>) para saltarse los
  // <submission_file> inline que contienen PDFs en base64 (varios MB por artículo).
  return extraerBloquesStreaming(archivo, /<article\b[\s\S]*?<publication[\s>][\s\S]*?<\/publication>/g);
}

function extraerBloquesStreaming(archivo: string, regex: RegExp): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(archivo, { encoding: 'utf8', highWaterMark: 256 * 1024 });
    const bloques: string[] = [];
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
        bloques.push(m[0]);
        lastIdx = regex.lastIndex;
      }
      if (lastIdx > 0) buf = buf.slice(lastIdx);
    });

    stream.on('end', () => resolve(bloques));
    stream.on('error', reject);
  });
}

export function parsePublication(xml: string): OjsArticulo {
  const parsed = parser.parse(xml);
  const pub = parsed.publication;
  if (!pub) {
    throw new Error('Bloque <publication> inválido');
  }

  const localePrimario: string = pub['@_locale'] ?? 'es_ES';

  const titulo = textoPorLocale(pub.title, localePrimario) ?? '';
  const tituloIngles = textoPorLocale(pub.title, 'en_US');

  const resumen = limpiarHtml(textoPorLocale(pub.abstract, localePrimario));
  const resumenOtroIdioma = limpiarHtml(textoPorLocale(pub.abstract, 'en_US', localePrimario));
  const resumenIdiomaAdicional = limpiarHtml(tercerLocale(pub.abstract, localePrimario, 'en_US'));

  const palabrasClave = keywordsAString(pub.keywords, localePrimario);
  const palabrasClaveOtroIdioma = keywordsAString(pub.keywords, 'en_US', localePrimario);

  const doi = extraerDoi(pub.id);
  const submissionId = extraerIdInterno(pub.id);
  const { paginaInicial, paginaFinal, raw: paginasRaw } = separarPaginas(pub.pages);

  const autoresArr = pub.authors?.author;
  const numeroAutores = Array.isArray(autoresArr) ? autoresArr.length : undefined;

  const citasArr = pub.citations?.citation;
  const numeroReferencias = Array.isArray(citasArr) ? citasArr.length : undefined;

  const idioma = LOCALE_A_IDIOMA[localePrimario];
  const otroIdioma = inferirOtroIdioma(pub, localePrimario);

  const fechaPublicacion = pub['@_date_published'];

  const art: OjsArticulo = { titulo };
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

export function parseArticle(xml: string): OjsArticulo {
  const publicaciones = extraerPublicationsXml(xml);
  if (publicaciones.length === 0) {
    throw new Error('<article> sin <publication> interno');
  }

  const articleOpen = xml.match(/<article\b[^>]*>/);
  const currentIdMatch = articleOpen?.[0].match(/current_publication_id="([^"]+)"/);
  const currentPublicationId = currentIdMatch?.[1];

  let pubElegida = publicaciones[0];
  if (currentPublicationId && publicaciones.length > 1) {
    const match = publicaciones.find((p) => {
      const inner = p.match(/<id\s+type="internal"[^>]*>([^<]+)<\/id>/);
      return inner?.[1] === currentPublicationId;
    });
    if (match) pubElegida = match;
  }

  const art = parsePublication(pubElegida);

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

export function ojsArticuloToRow(art: OjsArticulo, url?: string): Partial<ArticuloRow> {
  const row: Partial<ArticuloRow> = { titulo: art.titulo };
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

export async function importarDesdeOjs(archivo: string): Promise<ImportOjsResult> {
  const bloques = await extraerArticlesDeArchivo(archivo);
  const articulos = bloques.map(parseArticle);

  const noEstandar = detectarPaginasNoEstandar(articulos);
  const advertencias = noEstandar.map(({ indice, valor }) =>
    `Fila ${indice + 2}: <pages>="${valor}" no es un rango estándar (posible e-locator de publicación continua). Revisar manualmente.`
  );

  return { articulos, advertencias };
}

export function detectarPaginasNoEstandar(
  articulos: Pick<OjsArticulo, 'paginasRaw'>[]
): { indice: number; valor: string }[] {
  const result: { indice: number; valor: string }[] = [];
  articulos.forEach((art, indice) => {
    if (art.paginasRaw) result.push({ indice, valor: art.paginasRaw });
  });
  return result;
}

function textoPorLocale(arr: any, locale: string, excluir?: string): string | undefined {
  if (!Array.isArray(arr)) return undefined;
  const match = arr.find((n) => n['@_locale'] === locale && (!excluir || n['@_locale'] !== excluir));
  if (!match) return undefined;
  const valor = typeof match === 'object' ? match['#text'] ?? '' : String(match);
  return valor ? String(valor) : undefined;
}

function tercerLocale(arr: any, skip1: string, skip2: string): string | undefined {
  if (!Array.isArray(arr)) return undefined;
  const match = arr.find((n) => n['@_locale'] !== skip1 && n['@_locale'] !== skip2);
  if (!match) return undefined;
  const valor = typeof match === 'object' ? match['#text'] ?? '' : String(match);
  return valor ? String(valor) : undefined;
}

function keywordsAString(keywordsArr: any, locale: string, excluir?: string): string | undefined {
  if (!Array.isArray(keywordsArr)) return undefined;
  const match = keywordsArr.find((k) => k['@_locale'] === locale && (!excluir || k['@_locale'] !== excluir));
  if (!match || !Array.isArray(match.keyword)) return undefined;
  const palabras = match.keyword.map((k: any) => String(k).trim()).filter(Boolean);
  return palabras.length ? palabras.join('; ') : undefined;
}

function extraerDoi(ids: any): string | undefined {
  if (!Array.isArray(ids)) return undefined;
  const doiNode = ids.find((i) => i['@_type'] === 'doi');
  if (!doiNode) return undefined;
  const valor = typeof doiNode === 'object' ? doiNode['#text'] : doiNode;
  if (!valor) return undefined;
  return String(valor).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim() || undefined;
}

function extraerIdInterno(ids: any): string | undefined {
  if (!Array.isArray(ids)) return undefined;
  const node = ids.find((i) => i['@_type'] === 'internal');
  if (!node) return undefined;
  const valor = typeof node === 'object' ? node['#text'] : node;
  return valor != null ? String(valor).trim() || undefined : undefined;
}

function separarPaginas(pages: any): { paginaInicial?: string; paginaFinal?: string; raw?: string } {
  if (!pages) return {};
  const texto = String(pages).trim();
  if (!texto) return {};
  const m = texto.match(/^(\d+)\s*[-\u2013\u2014]\s*(\d+)$/);
  if (m) return { paginaInicial: m[1], paginaFinal: m[2] };
  return { raw: texto };
}

function inferirOtroIdioma(pub: any, primario: string): string | undefined {
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
  if (localesVistos.has('en_US')) return 'EN';
  for (const l of localesVistos) {
    if (LOCALE_A_IDIOMA[l]) return LOCALE_A_IDIOMA[l];
  }
  return undefined;
}

function limpiarHtml(texto: string | undefined): string | undefined {
  if (!texto) return undefined;
  const sinTags = String(texto).replace(/<[^>]+>/g, ' ');
  const normalizado = sinTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?)])/g, '$1')
    .trim();
  return normalizado || undefined;
}
