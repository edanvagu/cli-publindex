export type FormType = 'article' | 'author' | 'reviewer';

// Publindex uses Angular hash-routing: `/publindex/#/articulos/crear/{idFasciculo}`, `/autores/crear/{idArticulo}`, `/evaluadores/crear/{idFasciculo}`. Match against `location.href` which includes the fragment.
const URL_PATTERNS: Record<FormType, RegExp[]> = {
  article: [
    /\/publindex\/#\/articulos\/crear\/\d+/i,
    /\/publindex\/#\/articulos\/editar\/\d+/i,
  ],
  author: [
    /\/publindex\/#\/autores\/crear\/\d+/i,
    /\/publindex\/#\/autores\/editar\/\d+/i,
  ],
  reviewer: [
    /\/publindex\/#\/evaluadores\/crear\/\d+/i,
    /\/publindex\/#\/evaluadores\/editar\/\d+/i,
  ],
};

// DOM markers as a fallback when URL detection fails. `tituloArticulo` is unique to the article form. Author and reviewer share `nroDocumentoIdent` so we fall back to URL matching to tell them apart — the marker just signals "it's a person-search form".
const DOM_MARKERS: Record<FormType, string[]> = {
  article: ['[formcontrolname="tituloArticulo"]'],
  author: ['[formcontrolname="nroDocumentoIdent"]'],
  reviewer: ['[formcontrolname="nroDocumentoIdent"]'],
};

export function detectFormType(url: string, doc: Document): FormType | null {
  for (const [type, patterns] of Object.entries(URL_PATTERNS) as [FormType, RegExp[]][]) {
    if (patterns.some((p) => p.test(url))) return type;
  }
  for (const [type, markers] of Object.entries(DOM_MARKERS) as [FormType, string[]][]) {
    if (markers.some((m) => doc.querySelector(m))) return type;
  }
  return null;
}
