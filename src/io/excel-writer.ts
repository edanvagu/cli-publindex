import ExcelJS from 'exceljs';
import * as path from 'path';
import {
  EXCEL_HEADERS, DOCUMENT_TYPES, SUMMARY_TYPES, SPECIALIST_TYPES, LANGUAGES, STATE_COLUMNS,
  AUTHORS_SHEET_HEADERS, AUTHORS_SHEET_NAME, ARTICLES_SHEET_NAME, ARTICLE_ID_COLUMN, NATIONALITIES,
} from '../config/constants';
import { AREAS_TREE } from '../entities/areas/tree';
import { ArticleRow } from '../entities/articles/types';

const REQUIRED_FIELDS = ['titulo', 'url', 'gran_area', 'area', 'tipo_documento', 'palabras_clave', 'titulo_ingles', 'resumen'];
const ALERT_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };

// Filas con data validation aplicada. Suficiente para cualquier revista real.
const DATA_VALIDATION_ROWS = 500;

// Valores numéricos-puros se convierten a número al escribir para que Excel no
// muestre el aviso "Número almacenado como texto" en pagina_inicial, pagina_final,
// numero_autores, etc. DOIs y fechas no matchean este regex.
const INTEGER_RE = /^\d+$/;

const EXAMPLE_ARTICLE: Partial<ArticleRow> = {
  titulo: 'Título del artículo de ejemplo para Publindex',
  doi: '10.1234/ejemplo-article',
  url: 'https://revistas.ejemplo.edu.co/article/1',
  pagina_inicial: '1',
  pagina_final: '15',
  numero_autores: '3',
  numero_pares_evaluadores: '2',
  gran_area: 'Ciencias Sociales',
  area: 'Sociología',
  subarea: 'Sociología General',
  numero_referencias: '30',
  tipo_documento: 'Artículo de investigación científica y tecnológica',
  palabras_clave: 'sociología; cultura; América Latina',
  palabras_clave_otro_idioma: 'sociology; culture; Latin America',
  titulo_ingles: 'Title of the example article for Publindex',
  fecha_recepcion: '2026-01-15',
  fecha_aceptacion: '2026-03-20',
  idioma: 'Español',
  otro_idioma: 'Inglés',
  eval_interna: 'F',
  eval_nacional: 'T',
  eval_internacional: 'T',
  tipo_resumen: 'Analítico',
  tipo_especialista: 'Especialista en el área',
  resumen: 'Resumen del artículo de ejemplo con más de diez caracteres.',
  resumen_otro_idioma: 'Abstract of the example article with more than ten characters.',
};

export interface AuthorTemplateRow {
  titulo_articulo: string;
  nombre_completo: string;
  nacionalidad?: string;
  identificacion?: string;
  filiacion_institucional?: string;
}

export function generateTemplate(outputDir: string = '.'): Promise<string> {
  return generateTemplateWithData([EXAMPLE_ARTICLE], path.join(outputDir, 'plantilla-articulos.xlsx'));
}

export async function generateTemplateWithData(
  articles: Partial<ArticleRow>[],
  outputPath: string,
  authors?: AuthorTemplateRow[],
): Promise<string> {
  const wb = new ExcelJS.Workbook();

  buildArticlesSheet(wb, articles);
  buildAuthorsSheet(wb, authors ?? []);
  buildLookupsSheet(wb);
  buildInstructionsSheet(wb);

  await wb.xlsx.writeFile(outputPath);
  console.log(`\n  ✓ Plantilla generada: ${outputPath}\n`);
  return outputPath;
}

function buildArticlesSheet(wb: ExcelJS.Workbook, articles: Partial<ArticleRow>[]): void {
  const ws = wb.addWorksheet(ARTICLES_SHEET_NAME);
  const headers = [
    ...EXCEL_HEADERS,
    STATE_COLUMNS.STATE, STATE_COLUMNS.UPLOAD_DATE, STATE_COLUMNS.LAST_ERROR,
    ARTICLE_ID_COLUMN,
  ];

  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };

  for (const art of articles) {
    ws.addRow(headers.map(h => coerceCellValue((art as Record<string, unknown>)[h] ?? '')));
  }

  ws.columns = headers.map(h => ({ width: Math.max(h.length + 2, 18) }));

  highlightEmptyRequired(ws, headers, articles);
  addDataValidations(ws, headers);
}

// `identificacion` NO es obligatoria: si está, se usa para buscar por documento;
// si no, el CLI cae en fallback por nombre con picker interactivo.
const AUTHORS_REQUIRED_FIELDS = ['nacionalidad'];

function buildAuthorsSheet(wb: ExcelJS.Workbook, authors: AuthorTemplateRow[]): void {
  const ws = wb.addWorksheet(AUTHORS_SHEET_NAME);
  const headers = [...AUTHORS_SHEET_HEADERS];

  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };

  for (const a of authors) {
    ws.addRow(headers.map(h => (a as unknown as Record<string, unknown>)[h] ?? ''));
  }

  ws.columns = headers.map(h => ({ width: Math.max(h.length + 2, 22) }));

  // Highlight amarillo para identificacion y nacionalidad vacías.
  authors.forEach((a, rowIdx) => {
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const header = headers[colIdx];
      if (!AUTHORS_REQUIRED_FIELDS.includes(header)) continue;
      const value = (a as unknown as Record<string, unknown>)[header];
      if (value !== '' && value !== undefined && value !== null) continue;
      ws.getCell(rowIdx + 2, colIdx + 1).fill = ALERT_FILL;
    }
  });

  // Dropdown de nacionalidad.
  const nacionalidadCol = headers.indexOf('nacionalidad') + 1;
  if (nacionalidadCol > 0) {
    const values = Object.values(NATIONALITIES);
    applyListToColumn(ws, nacionalidadCol, `"${values.join(',')}"`);
  }
}

function coerceCellValue(v: unknown): unknown {
  if (typeof v === 'string' && INTEGER_RE.test(v)) return parseInt(v, 10);
  return v;
}

function highlightEmptyRequired(ws: ExcelJS.Worksheet, headers: string[], articles: Partial<ArticleRow>[]): void {
  const requiredIndexes = headers
    .map((h, i) => REQUIRED_FIELDS.includes(h) ? i : -1)
    .filter(i => i >= 0);

  articles.forEach((art, rowIdx) => {
    for (const colIdx of requiredIndexes) {
      const header = headers[colIdx];
      const value = (art as Record<string, unknown>)[header];
      if (value !== '' && value !== undefined && value !== null) continue;
      ws.getCell(rowIdx + 2, colIdx + 1).fill = ALERT_FILL;
    }
  });
}

function addDataValidations(ws: ExcelJS.Worksheet, headers: string[]): void {
  const colIdx = (h: string) => headers.indexOf(h) + 1;

  // Dropdowns con LABELS. El validator/mapper traduce a código antes de enviar a Publindex.
  const simpleLists: [string, string[]][] = [
    ['tipo_documento', Object.values(DOCUMENT_TYPES)],
    ['tipo_resumen', Object.values(SUMMARY_TYPES)],
    ['tipo_especialista', Object.values(SPECIALIST_TYPES)],
    ['idioma', Object.values(LANGUAGES)],
    ['otro_idioma', Object.values(LANGUAGES)],
    ['eval_interna', ['T', 'F']],
    ['eval_nacional', ['T', 'F']],
    ['eval_internacional', ['T', 'F']],
  ];

  for (const [header, values] of simpleLists) {
    const i = colIdx(header);
    if (i === 0) continue;
    applyListToColumn(ws, i, `"${values.join(',')}"`);
  }

  // Cascada gran_area → area → subarea. Named ranges usan el CÓDIGO Minciencias
  // (ASCII-safe), y la fórmula traduce label → código via VLOOKUP sobre tablas
  // de lookup en la hoja _lookups.
  const granAreaCol = colIdx('gran_area');
  const areaCol = colIdx('area');
  const subareaCol = colIdx('subarea');

  if (granAreaCol > 0) {
    applyListToColumn(ws, granAreaCol, 'GRAN_AREAS');
  }

  if (areaCol > 0 && granAreaCol > 0) {
    const granLetter = numberToColLetter(granAreaCol);
    for (let r = 2; r <= DATA_VALIDATION_ROWS + 1; r++) {
      ws.getCell(r, areaCol).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`INDIRECT("AREAS_"&VLOOKUP($${granLetter}${r},GRAN_AREA_LOOKUP,2,FALSE))`],
      };
    }
  }

  if (subareaCol > 0 && areaCol > 0) {
    const areaLetter = numberToColLetter(areaCol);
    for (let r = 2; r <= DATA_VALIDATION_ROWS + 1; r++) {
      ws.getCell(r, subareaCol).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`INDIRECT("SUB_"&VLOOKUP($${areaLetter}${r},AREA_LOOKUP,2,FALSE))`],
      };
    }
  }
}

function applyListToColumn(ws: ExcelJS.Worksheet, colIdx: number, formula: string): void {
  const validation: ExcelJS.DataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [formula],
  };
  for (let r = 2; r <= DATA_VALIDATION_ROWS + 1; r++) {
    ws.getCell(r, colIdx).dataValidation = validation;
  }
}

function buildLookupsSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('_lookups', { state: 'hidden' });

  // Col A: labels de gran_areas. Col B: códigos paralelos.
  const granAreaLabels = AREAS_TREE.map(g => g.txtNmeArea);
  const granAreaCodes = AREAS_TREE.map(g => g.codAreaConocimiento);
  ws.getColumn(1).values = ['GRAN_AREAS', ...granAreaLabels];
  ws.getColumn(2).values = ['GRAN_CODES', ...granAreaCodes];
  defineRange(wb, ws.name, 'GRAN_AREAS', 1, 1, granAreaLabels.length);
  defineMultiColRange(wb, ws.name, 'GRAN_AREA_LOOKUP', 1, 2, 2, granAreaLabels.length);

  // Col C: labels de TODAS las areas (flat). Col D: códigos paralelos. Para VLOOKUP.
  const allAreaLabels: string[] = [];
  const allAreaCodes: string[] = [];
  for (const gran of AREAS_TREE) {
    for (const area of gran.areasHijas ?? []) {
      allAreaLabels.push(area.txtNmeArea);
      allAreaCodes.push(area.codAreaConocimiento);
    }
  }
  ws.getColumn(3).values = ['AREAS_ALL', ...allAreaLabels];
  ws.getColumn(4).values = ['AREA_CODES', ...allAreaCodes];
  defineMultiColRange(wb, ws.name, 'AREA_LOOKUP', 3, 4, 4, allAreaLabels.length);

  // Una columna por gran_area con los labels de sus areas hijas. Named range `AREAS_<granCode>`.
  let col = 5;
  for (const gran of AREAS_TREE) {
    const labels = (gran.areasHijas ?? []).map(a => a.txtNmeArea);
    if (labels.length === 0) continue;
    const name = `AREAS_${gran.codAreaConocimiento}`;
    ws.getColumn(col).values = [name, ...labels];
    defineRange(wb, ws.name, name, col, col, labels.length);
    col++;
  }

  // Una columna por area con los labels de sus subareas hijas. Named range `SUB_<areaCode>`.
  for (const gran of AREAS_TREE) {
    for (const area of gran.areasHijas ?? []) {
      const labels = (area.areasHijas ?? []).map(s => s.txtNmeArea);
      if (labels.length === 0) continue;
      const name = `SUB_${area.codAreaConocimiento}`;
      ws.getColumn(col).values = [name, ...labels];
      defineRange(wb, ws.name, name, col, col, labels.length);
      col++;
    }
  }
}

function defineRange(wb: ExcelJS.Workbook, sheetName: string, name: string, colIdx: number, _endCol: number, count: number): void {
  const letter = numberToColLetter(colIdx);
  const ref = `'${sheetName}'!$${letter}$2:$${letter}$${count + 1}`;
  wb.definedNames.add(ref, name);
}

function defineMultiColRange(wb: ExcelJS.Workbook, sheetName: string, name: string, startCol: number, endCol: number, _placeholder: number, count: number): void {
  const startLetter = numberToColLetter(startCol);
  const endLetter = numberToColLetter(endCol);
  const ref = `'${sheetName}'!$${startLetter}$2:$${endLetter}$${count + 1}`;
  wb.definedNames.add(ref, name);
}

function numberToColLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildInstructionsSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Instrucciones');
  const rows = [
    ['Campo', 'Obligatorio', 'Descripción', 'Ejemplo'],
    ['titulo', 'Sí', 'Título del artículo (mínimo 10 caracteres)', 'Título del artículo de ejemplo para Publindex'],
    ['doi', 'No', 'DOI sin URL (formato 10.xxxx/yyyy). NO use https://doi.org/...', '10.1234/abc'],
    ['url', 'Sí', 'URL del artículo con http:// o https://', 'https://revistas.ejemplo.edu.co/article/1'],
    ['pagina_inicial', 'No', 'Número de página inicial', '1'],
    ['pagina_final', 'No', 'Número de página final (debe ser mayor que pagina_inicial)', '15'],
    ['numero_autores', 'No', 'Cantidad de autores del artículo', '3'],
    ['numero_pares_evaluadores', 'No', 'Cantidad de pares que evaluaron el artículo', '2'],
    ['proyecto', 'No', 'Nombre del proyecto de investigación asociado', ''],
    ['gran_area', 'Sí', 'Dropdown con las grandes áreas de conocimiento Minciencias', 'Ciencias Sociales'],
    ['area', 'Sí', 'Dropdown con las áreas hijas de la gran_area seleccionada (cascada)', 'Sociología'],
    ['subarea', 'No', 'Dropdown con las subáreas hijas del area seleccionada (cascada)', 'Sociología General'],
    ['numero_referencias', 'No', 'Cantidad de referencias bibliográficas', '30'],
    ['tipo_documento', 'Sí', 'Dropdown con los 12 tipos de documento Publindex', 'Artículo de investigación científica y tecnológica'],
    ['palabras_clave', 'Sí', 'Palabras clave separadas por punto y coma (;)', 'sociología; cultura'],
    ['palabras_clave_otro_idioma', 'No', 'Palabras clave en otro idioma, separadas por ;', 'sociology; culture'],
    ['titulo_ingles', 'Sí', 'Título del artículo en inglés (mínimo 10 caracteres)', 'Title of the article in English'],
    ['fecha_recepcion', 'No', 'Fecha de recepción formato YYYY-MM-DD', '2026-01-15'],
    ['fecha_aceptacion', 'No', 'Fecha de aceptación (debe ser >= fecha_recepcion)', '2026-03-20'],
    ['idioma', 'No', 'Dropdown con el idioma original del artículo', 'Español'],
    ['otro_idioma', 'No', 'Dropdown con otro idioma (no puede ser igual a idioma)', 'Inglés'],
    ['eval_interna', 'No', 'Evaluación interna institucional: T=Sí, F=No', 'F'],
    ['eval_nacional', 'No', 'Evaluación por pares nacionales: T=Sí, F=No', 'T'],
    ['eval_internacional', 'No', 'Evaluación por pares internacionales: T=Sí, F=No', 'T'],
    ['tipo_resumen', 'No', 'Dropdown con los tipos de resumen (Analítico/Descriptivo/Analítico sintético)', 'Analítico'],
    ['tipo_especialista', 'No', 'Dropdown con los tipos de especialista (Autor/Editor/Bibliotecólogo/Especialista)', 'Especialista en el área'],
    ['resumen', 'Sí', 'Resumen del artículo (mínimo 10 caracteres)', 'Resumen del artículo...'],
    ['resumen_otro_idioma', 'No', 'Resumen en segundo idioma', 'Abstract of the article...'],
    ['resumen_idioma_adicional', 'No', 'Resumen en tercer idioma', ''],
    ['', '', '', ''],
    ['Columnas de estado (NO EDITAR — son automáticas)', '', '', ''],
    ['estado', 'Auto', 'Se llena automáticamente: pendiente, subido o error', 'subido'],
    ['fecha_subida', 'Auto', 'Fecha/hora en que el artículo se cargó exitosamente', '2026-04-19T10:30:00.000Z'],
    ['ultimo_error', 'Auto', 'Mensaje de error si la carga falló', ''],
  ];

  rows.forEach(r => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.columns = [{ width: 30 }, { width: 12 }, { width: 70 }, { width: 55 }];
}
