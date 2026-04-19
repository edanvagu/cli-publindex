import { ArticleRow, ValidationError, ValidationWarning, ValidationResult } from './types';
import { areaExists, areaBelongsToParent, subareaBelongsToArea, getAreaName, getChildAreas, getChildSubareas } from '../areas/tree';
import { DOCUMENT_TYPES, SUMMARY_TYPES, SPECIALIST_TYPES, LANGUAGES } from '../../config/constants';
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
        message: `Posible duplicado: rows ${rows.join(', ')} tienen el mismo título "${titulo.substring(0, 50)}..."`,
      });
    }
  }

  for (const art of articles) {
    validateArticle(art, errors);
  }

  const filasConError = new Set(errors.map(e => e.row));
  const valid = articles.filter(a => !filasConError.has(a._fila));

  return { valid, errors, warnings };
}

function validateArticle(art: ArticleRow, errors: ValidationError[]) {
  const row = art._fila;

  if (!art.titulo) {
    errors.push({ row, field: 'titulo', message: 'Campo obligatorio' });
  } else if (art.titulo.length < 10) {
    errors.push({ row, field: 'titulo', message: `"${art.titulo}" tiene ${art.titulo.length} caracteres (mínimo 10)` });
  }

  if (!art.url) {
    errors.push({ row, field: 'url', message: 'Campo obligatorio' });
  } else if (!art.url.startsWith('http://') && !art.url.startsWith('https://')) {
    errors.push({ row, field: 'url', message: `"${art.url}" debe comenzar con http:// o https://` });
  }

  if (!art.gran_area) {
    errors.push({ row, field: 'gran_area', message: 'Campo obligatorio' });
  } else if (!areaExists(art.gran_area)) {
    errors.push({
      row, field: 'gran_area',
      message: `Código "${art.gran_area}" no existe`,
      suggestion: 'Valores válidos: 1 (Ciencias Naturales), 2 (Ingeniería y Tecnología), 3 (Ciencias Médicas), 4 (Ciencias Agrícolas), 5 (Ciencias Sociales), 6 (Humanidades)',
    });
  }

  if (!art.area) {
    errors.push({ row, field: 'area', message: 'Campo obligatorio' });
  } else if (!areaExists(art.area)) {
    errors.push({ row, field: 'area', message: `Código "${art.area}" no existe` });
  } else if (art.gran_area && areaExists(art.gran_area) && !areaBelongsToParent(art.area, art.gran_area)) {
    const areasValidas = getChildAreas(art.gran_area);
    errors.push({
      row, field: 'area',
      message: `"${art.area}" no pertenece a gran_area "${art.gran_area}" (${getAreaName(art.gran_area)})`,
      suggestion: `Áreas válidas: ${areasValidas.map(a => `${a.codigo} (${a.nombre})`).join(', ')}`,
    });
  }

  if (!art.tipo_documento) {
    errors.push({ row, field: 'tipo_documento', message: 'Campo obligatorio' });
  } else if (!DOCUMENT_TYPES[art.tipo_documento]) {
    errors.push({
      row, field: 'tipo_documento',
      message: `Valor "${art.tipo_documento}" no válido`,
      suggestion: `Valores: ${Object.entries(DOCUMENT_TYPES).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    });
  }

  if (!art.palabras_clave) {
    errors.push({ row, field: 'palabras_clave', message: 'Campo obligatorio' });
  }

  if (!art.titulo_ingles) {
    errors.push({ row, field: 'titulo_ingles', message: 'Campo obligatorio' });
  } else if (art.titulo_ingles.length < 10) {
    errors.push({ row, field: 'titulo_ingles', message: `"${art.titulo_ingles}" tiene ${art.titulo_ingles.length} caracteres (mínimo 10)` });
  }

  if (!art.resumen) {
    errors.push({ row, field: 'resumen', message: 'Campo obligatorio' });
  } else if (art.resumen.length < 10) {
    errors.push({ row, field: 'resumen', message: `Tiene ${art.resumen.length} caracteres (mínimo 10)` });
  }

  if (art.doi) {
    if (art.doi.length < 10) {
      errors.push({ row, field: 'doi', message: `"${art.doi}" tiene ${art.doi.length} caracteres (mínimo 10)` });
    } else if (!/^10\.\S+\/\S+/.test(art.doi)) {
      errors.push({
        row, field: 'doi',
        message: `"${art.doi}" no es un DOI válido. Debe empezar con "10." y tener el formato 10.xxxx/yyyy`,
        suggestion: 'Ejemplo válido: 10.1234/abc123. NO use formato URL (https://doi.org/...).',
      });
    }
  }

  if (art.subarea) {
    if (!areaExists(art.subarea)) {
      errors.push({ row, field: 'subarea', message: `Código "${art.subarea}" no existe` });
    } else if (art.area && areaExists(art.area) && !subareaBelongsToArea(art.subarea, art.area)) {
      const subareasValidas = getChildSubareas(art.area);
      errors.push({
        row, field: 'subarea',
        message: `"${art.subarea}" no pertenece a area "${art.area}" (${getAreaName(art.area)})`,
        suggestion: `Subáreas válidas: ${subareasValidas.map(a => `${a.codigo} (${a.nombre})`).join(', ')}`,
      });
    }
  }

  validatePositiveNumber(art.pagina_inicial, 'pagina_inicial', row, errors);
  validatePositiveNumber(art.pagina_final, 'pagina_final', row, errors);
  validatePositiveNumber(art.numero_autores, 'numero_autores', row, errors);
  validatePositiveNumber(art.numero_pares_evaluadores, 'numero_pares_evaluadores', row, errors);
  validatePositiveNumber(art.numero_referencias, 'numero_referencias', row, errors);

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

  if (art.idioma && !LANGUAGES[art.idioma.toUpperCase()]) {
    errors.push({
      row, field: 'idioma',
      message: `"${art.idioma}" no válido`,
      suggestion: `Valores: ${Object.keys(LANGUAGES).join(', ')}`,
    });
  }
  if (art.otro_idioma && !LANGUAGES[art.otro_idioma.toUpperCase()]) {
    errors.push({
      row, field: 'otro_idioma',
      message: `"${art.otro_idioma}" no válido`,
      suggestion: `Valores: ${Object.keys(LANGUAGES).join(', ')}`,
    });
  }
  if (art.idioma && art.otro_idioma && art.idioma.toUpperCase() === art.otro_idioma.toUpperCase()) {
    errors.push({ row, field: 'otro_idioma', message: `No puede ser igual a idioma ("${art.idioma}")` });
  }

  validarTF(art.eval_interna, 'eval_interna', row, errors);
  validarTF(art.eval_nacional, 'eval_nacional', row, errors);
  validarTF(art.eval_internacional, 'eval_internacional', row, errors);

  if (art.tipo_resumen && !SUMMARY_TYPES[art.tipo_resumen.toUpperCase()]) {
    errors.push({
      row, field: 'tipo_resumen',
      message: `"${art.tipo_resumen}" no válido`,
      suggestion: `Valores: ${Object.entries(SUMMARY_TYPES).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    });
  }
  if (art.tipo_especialista && !SPECIALIST_TYPES[art.tipo_especialista.toUpperCase()]) {
    errors.push({
      row, field: 'tipo_especialista',
      message: `"${art.tipo_especialista}" no válido`,
      suggestion: `Valores: ${Object.entries(SPECIALIST_TYPES).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    });
  }
}

function validatePositiveNumber(valor: string | undefined, field: string, row: number, errors: ValidationError[]) {
  if (!valor) return;
  const num = parseInt(valor, 10);
  if (isNaN(num) || num < 0) {
    errors.push({ row, field, message: `"${valor}" debe ser un número entero positivo` });
  }
}

function validateDate(valor: string | undefined, field: string, row: number, errors: ValidationError[]) {
  if (!valor) return;
  if (!parseDate(valor)) {
    errors.push({ row, field, message: `"${valor}" no es una fecha válida (formato esperado: YYYY-MM-DD)` });
  }
}

function validarTF(valor: string | undefined, field: string, row: number, errors: ValidationError[]) {
  if (!valor) return;
  if (valor.toUpperCase() !== 'T' && valor.toUpperCase() !== 'F') {
    errors.push({ row, field, message: `"${valor}" no válido. Use T (Sí) o F (No)` });
  }
}

const HEADERS_CONOCIDOS = [
  'titulo', 'doi', 'url', 'pagina_inicial', 'pagina_final', 'numero_autores',
  'numero_pares_evaluadores', 'proyecto', 'gran_area', 'area', 'subarea',
  'numero_referencias', 'tipo_documento', 'palabras_clave', 'palabras_clave_otro_idioma',
  'titulo_ingles', 'fecha_recepcion', 'fecha_aceptacion', 'idioma', 'otro_idioma',
  'eval_interna', 'eval_nacional', 'eval_internacional', 'tipo_resumen',
  'tipo_especialista', 'resumen', 'resumen_otro_idioma', 'resumen_idioma_adicional',
];

function findSimilarHeader(header: string): string | null {
  let mejor: string | null = null;
  let mejorDist = Infinity;

  for (const conocido of HEADERS_CONOCIDOS) {
    const dist = levenshtein(header, conocido);
    if (dist < mejorDist && dist <= 3) {
      mejorDist = dist;
      mejor = conocido;
    }
  }
  return mejor;
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
