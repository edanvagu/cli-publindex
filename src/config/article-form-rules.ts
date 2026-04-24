import { DOCUMENT_TYPES } from './constants';

// Discovered by probing Publindex's "Crear artículo" form with Playwright (fascículo 37574, abril 2026). Requiredness is driven by Angular validators reacting to tipoDocumento selection — no backend endpoint exposes these rules.

export type DocTypeCode =
  | '1' | '2' | '3' | '4' | '5' | '6'
  | '7' | '8' | '9' | '10' | '11' | '12';

const ALWAYS_REQUIRED: readonly string[] = [
  'titulo',
  'url',
  'gran_area',
  'area',
  'tipo_documento',
];

// Tipos 1-6 (investigación, reflexión, revisión, corto, caso, revisión de tema) exige también resumen + palabras clave + título paralelo. Tipos 7-12 solo exigen el ALWAYS_REQUIRED.
const SUBSTANTIAL_DOC_TYPES: readonly DocTypeCode[] = ['1', '2', '3', '4', '5', '6'];
const SUBSTANTIAL_EXTRA_FIELDS: readonly string[] = ['palabras_clave', 'titulo_ingles', 'resumen'];

export const REQUIRED_FIELDS_BY_DOC_TYPE: Readonly<Record<DocTypeCode, ReadonlySet<string>>> = (() => {
  const out = {} as Record<DocTypeCode, ReadonlySet<string>>;
  for (const code of Object.keys(DOCUMENT_TYPES) as DocTypeCode[]) {
    const fields = SUBSTANTIAL_DOC_TYPES.includes(code)
      ? [...ALWAYS_REQUIRED, ...SUBSTANTIAL_EXTRA_FIELDS]
      : [...ALWAYS_REQUIRED];
    out[code] = new Set(fields);
  }
  return out;
})();

export interface FieldConstraint {
  kind: 'text' | 'integer' | 'date';
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternMessage?: string;
}

// `min`/`max` for text = character length. For integer = numeric value. Max values come from the DOM `maxlength` attribute captured in the Playwright sweep; min values marked "policy" come from project conventions, not the form.
export const FIELD_CONSTRAINTS: Readonly<Record<string, FieldConstraint>> = {
  titulo:                     { kind: 'text',    min: 10, max: 255 },
  titulo_ingles:              { kind: 'text',    min: 10, max: 255 },
  resumen:                    { kind: 'text',    min: 10, max: 4000 },
  resumen_otro_idioma:        { kind: 'text',             max: 4000 },
  resumen_idioma_adicional:   { kind: 'text',             max: 4000 },
  doi:                        {
    kind: 'text',
    min: 10,
    max: 300,
    pattern: /^10\.\S+\/\S+/,
    patternMessage: 'Formato DOI esperado: 10.xxxx/yyyy (sin URL)',
  },
  url:                        { kind: 'text',             max: 300 },
  palabras_clave:             { kind: 'text',             max: 2000 },
  palabras_clave_otro_idioma: { kind: 'text',             max: 2000 },
  proyecto:                   { kind: 'text',             max: 2000 },
  pagina_inicial:             { kind: 'integer', min: 1,  max: 9999 },
  pagina_final:               { kind: 'integer', min: 1,  max: 9999 },
  numero_autores:             { kind: 'integer', min: 1,  max: 9999 },
  numero_pares_evaluadores:   { kind: 'integer', min: 0,  max: 9999 },
  numero_referencias:         { kind: 'integer', min: 0,  max: 9999 },
  fecha_recepcion:            { kind: 'date' },
  fecha_aceptacion:           { kind: 'date' },
};

export function isRequired(field: string, docTypeCode: DocTypeCode | undefined): boolean {
  if (!docTypeCode) return ALWAYS_REQUIRED.includes(field);
  return REQUIRED_FIELDS_BY_DOC_TYPE[docTypeCode].has(field);
}

// Returns the DOCUMENT_TYPES *labels* (not codes) of tipos that require the given field. Used by excel-writer to build named ranges (REQ_<field>) consumed by conditional-formatting formulas that match the Excel cell's displayed label.
export function docTypeLabelsRequiring(field: string): string[] {
  const labels: string[] = [];
  for (const code of Object.keys(DOCUMENT_TYPES) as DocTypeCode[]) {
    if (REQUIRED_FIELDS_BY_DOC_TYPE[code].has(field)) labels.push(DOCUMENT_TYPES[code]);
  }
  return labels;
}

// Union of every field that is required for at least one doc type. Used to decide which fields get a REQ_<field> named range + conditional-formatting rule.
export function potentiallyRequiredFields(): string[] {
  const set = new Set<string>();
  for (const code of Object.keys(DOCUMENT_TYPES) as DocTypeCode[]) {
    for (const f of REQUIRED_FIELDS_BY_DOC_TYPE[code]) set.add(f);
  }
  return Array.from(set);
}

// Fields required for EVERY doc type. The Excel rule for these doesn't need to consult REQ_* ranges — blank alone triggers the yellow. This also means the rule fires even when `tipo_documento` itself is empty (otherwise the MATCH would fail and no cell would highlight).
export function alwaysRequiredFields(): string[] {
  const codes = Object.keys(DOCUMENT_TYPES) as DocTypeCode[];
  return potentiallyRequiredFields().filter(field =>
    codes.every(code => REQUIRED_FIELDS_BY_DOC_TYPE[code].has(field)),
  );
}

// Fields required for SOME tipos but not all. These need the MATCH-against-REQ_* rule in Excel.
export function conditionallyRequiredFields(): string[] {
  const codes = Object.keys(DOCUMENT_TYPES) as DocTypeCode[];
  return potentiallyRequiredFields().filter(field => {
    const hits = codes.filter(code => REQUIRED_FIELDS_BY_DOC_TYPE[code].has(field)).length;
    return hits > 0 && hits < codes.length;
  });
}
