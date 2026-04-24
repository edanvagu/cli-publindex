import { ArticleRow, ValidationError, ValidationWarning, ValidationResult } from './types';
import {
  getGranAreaCodeByName, getAreaCodeByName, getSubareaCodeByName,
  getGranAreas, getChildAreas, getChildSubareas,
} from '../areas/tree';
import { DOCUMENT_TYPES, SUMMARY_TYPES, SPECIALIST_TYPES, LANGUAGES } from '../../config/constants';
import {
  DocTypeCode, FieldConstraint, FIELD_CONSTRAINTS, isRequired, potentiallyRequiredFields,
} from '../../config/article-form-rules';
import { parseDate } from '../../utils/dates';

export function validateBatch(articles: ArticleRow[], unknownHeaders: string[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (articles.length === 0) {
    errors.push({ row: 0, field: 'archivo', message: 'El archivo no contiene artículos' });
    return { valid: [], errors, warnings };
  }

  for (const h of unknownHeaders) {
    const suggestion = findSimilarHeader(h);
    warnings.push({
      message: `Columna "${h}" no reconocida${suggestion ? ` (¿quiso decir "${suggestion}"?)` : ''}`,
    });
  }

  const tituloCount = new Map<string, number[]>();
  for (const art of articles) {
    const key = art.titulo.toLowerCase().trim();
    if (key) {
      const rows = tituloCount.get(key) || [];
      rows.push(art._fila);
      tituloCount.set(key, rows);
    }
  }
  for (const [titulo, rows] of tituloCount) {
    if (rows.length > 1) {
      warnings.push({
        message: `Posible duplicado: filas ${rows.join(', ')} tienen el mismo título "${titulo.substring(0, 50)}..."`,
      });
    }
  }

  for (const art of articles) {
    validateArticle(art, errors);
  }

  const rowsWithError = new Set(errors.map(e => e.row));
  const valid = articles.filter(a => !rowsWithError.has(a._fila));

  return { valid, errors, warnings };
}

function codeForLabel(label: string | undefined, dict: Record<string, string>): string | undefined {
  if (!label) return undefined;
  const match = Object.entries(dict).find(([, v]) => v === label);
  return match?.[0];
}

function validateArticle(art: ArticleRow, errors: ValidationError[]) {
  const row = art._fila;
  const docTypeCode = codeForLabel(art.tipo_documento, DOCUMENT_TYPES) as DocTypeCode | undefined;
  const record = art as unknown as Record<string, unknown>;

  for (const field of potentiallyRequiredFields()) {
    if (!isRequired(field, docTypeCode)) continue;
    const value = record[field];
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push({ row, field, message: 'Campo obligatorio' });
    }
  }

  for (const [field, constraint] of Object.entries(FIELD_CONSTRAINTS)) {
    const value = record[field];
    if (typeof value === 'string' && value !== '') {
      validateConstraint(value, field, constraint, row, errors);
    }
  }

  if (art.url && !art.url.startsWith('http://') && !art.url.startsWith('https://')) {
    errors.push({ row, field: 'url', message: `"${art.url}" debe comenzar con http:// o https://` });
  }

  validateAreaCascade(art, row, errors);

  validateEnumLabel(art.tipo_documento, 'tipo_documento', DOCUMENT_TYPES, false, row, errors);
  validateEnumLabel(art.tipo_resumen, 'tipo_resumen', SUMMARY_TYPES, false, row, errors);
  validateEnumLabel(art.tipo_especialista, 'tipo_especialista', SPECIALIST_TYPES, false, row, errors);
  validateEnumLabel(art.idioma, 'idioma', LANGUAGES, false, row, errors);
  validateEnumLabel(art.otro_idioma, 'otro_idioma', LANGUAGES, false, row, errors);

  if (art.pagina_inicial && art.pagina_final) {
    const ini = parseInt(art.pagina_inicial, 10);
    const fin = parseInt(art.pagina_final, 10);
    if (!isNaN(ini) && !isNaN(fin) && fin <= ini) {
      errors.push({ row, field: 'pagina_final', message: `pagina_final (${fin}) debe ser mayor que pagina_inicial (${ini})` });
    }
  }

  validateDate(art.fecha_recepcion, 'fecha_recepcion', row, errors);
  validateDate(art.fecha_aceptacion, 'fecha_aceptacion', row, errors);

  if (art.fecha_recepcion && art.fecha_aceptacion) {
    const recep = parseDate(art.fecha_recepcion);
    const acep = parseDate(art.fecha_aceptacion);
    if (recep && acep && acep < recep) {
      errors.push({
        row, field: 'fecha_aceptacion',
        message: `fecha_aceptacion (${art.fecha_aceptacion}) es anterior a fecha_recepcion (${art.fecha_recepcion})`,
      });
    }
  }

  if (art.idioma && art.otro_idioma && art.idioma === art.otro_idioma) {
    errors.push({ row, field: 'otro_idioma', message: `No puede ser igual a idioma ("${art.idioma}")` });
  }

  validateTF(art.eval_interna, 'eval_interna', row, errors);
  validateTF(art.eval_nacional, 'eval_nacional', row, errors);
  validateTF(art.eval_internacional, 'eval_internacional', row, errors);
}

function validateConstraint(value: string, field: string, c: FieldConstraint, row: number, errors: ValidationError[]) {
  if (c.kind === 'text') {
    if (c.min !== undefined && value.length < c.min) {
      errors.push({ row, field, message: `"${value.slice(0, 30)}" tiene ${value.length} caracteres (mínimo ${c.min})` });
      return;
    }
    if (c.max !== undefined && value.length > c.max) {
      errors.push({ row, field, message: `Tiene ${value.length} caracteres (máximo ${c.max})` });
      return;
    }
    if (c.pattern && !c.pattern.test(value)) {
      errors.push({
        row, field,
        message: `"${value}" no cumple el formato esperado`,
        suggestion: field === 'doi'
          ? 'Ejemplo válido: 10.1234/abc123. NO use formato URL (https://doi.org/...).'
          : c.patternMessage,
      });
      return;
    }
  } else if (c.kind === 'integer') {
    const n = parseInt(value, 10);
    if (isNaN(n)) {
      errors.push({ row, field, message: `"${value}" debe ser un número entero` });
      return;
    }
    if (c.min !== undefined && n < c.min) {
      errors.push({ row, field, message: `"${value}" debe ser >= ${c.min}` });
      return;
    }
    if (c.max !== undefined && n > c.max) {
      errors.push({ row, field, message: `"${value}" debe ser <= ${c.max}` });
      return;
    }
  }
}

function validateAreaCascade(art: ArticleRow, row: number, errors: ValidationError[]) {
  const granAreaCode = art.gran_area ? getGranAreaCodeByName(art.gran_area) : undefined;
  if (art.gran_area && !granAreaCode) {
    errors.push({
      row, field: 'gran_area',
      message: `"${art.gran_area}" no es una gran área válida`,
      suggestion: `Valores válidos: ${getGranAreas().map(g => g.name).join(', ')}`,
    });
  }

  let areaCode: string | undefined;
  if (art.area && granAreaCode) {
    areaCode = getAreaCodeByName(art.area, granAreaCode);
    if (!areaCode) {
      const validAreas = getChildAreas(granAreaCode);
      errors.push({
        row, field: 'area',
        message: `"${art.area}" no pertenece a ${art.gran_area}`,
        suggestion: `Áreas válidas bajo "${art.gran_area}": ${validAreas.map(a => a.name).join(', ')}`,
      });
    }
  }

  if (art.subarea && areaCode) {
    const subCode = getSubareaCodeByName(art.subarea, areaCode);
    if (!subCode) {
      const validSubs = getChildSubareas(areaCode);
      errors.push({
        row, field: 'subarea',
        message: `"${art.subarea}" no pertenece a ${art.area}`,
        suggestion: `Subáreas válidas bajo "${art.area}": ${validSubs.map(s => s.name).join(', ')}`,
      });
    }
  }
}

function validateEnumLabel(
  value: string | undefined,
  field: string,
  dict: Record<string, string>,
  required: boolean,
  row: number,
  errors: ValidationError[],
): void {
  if (!value) {
    if (required) errors.push({ row, field, message: 'Campo obligatorio' });
    return;
  }
  const valid = Object.values(dict);
  if (!valid.includes(value)) {
    errors.push({
      row, field,
      message: `"${value}" no válido`,
      suggestion: `Valores válidos: ${valid.join(', ')}`,
    });
  }
}

function validateDate(value: string | undefined, field: string, row: number, errors: ValidationError[]) {
  if (!value) return;
  if (!parseDate(value)) {
    errors.push({ row, field, message: `"${value}" no es una fecha válida (formato esperado: YYYY-MM-DD)` });
  }
}

function validateTF(value: string | undefined, field: string, row: number, errors: ValidationError[]) {
  if (!value) return;
  if (value.toUpperCase() !== 'T' && value.toUpperCase() !== 'F') {
    errors.push({ row, field, message: `"${value}" no válido. Use T (Sí) o F (No)` });
  }
}

const KNOWN_HEADERS = [
  'titulo', 'doi', 'url', 'pagina_inicial', 'pagina_final', 'numero_autores',
  'numero_pares_evaluadores', 'proyecto', 'gran_area', 'area', 'subarea',
  'numero_referencias', 'tipo_documento', 'palabras_clave', 'palabras_clave_otro_idioma',
  'titulo_ingles', 'fecha_recepcion', 'fecha_aceptacion', 'idioma', 'otro_idioma',
  'eval_interna', 'eval_nacional', 'eval_internacional', 'tipo_resumen',
  'tipo_especialista', 'resumen', 'resumen_otro_idioma', 'resumen_idioma_adicional',
];

function findSimilarHeader(header: string): string | null {
  let best: string | null = null;
  let bestDist = Infinity;

  for (const known of KNOWN_HEADERS) {
    const dist = levenshtein(header, known);
    if (dist < bestDist && dist <= 3) {
      bestDist = dist;
      best = known;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}
