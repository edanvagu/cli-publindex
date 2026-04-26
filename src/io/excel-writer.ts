import ExcelJS from 'exceljs';
import {
  EXCEL_HEADERS,
  DOCUMENT_TYPES,
  SUMMARY_TYPES,
  SPECIALIST_TYPES,
  LANGUAGES,
  STATE_COLUMNS,
  AUTHORS_SHEET_HEADERS,
  AUTHORS_SHEET_NAME,
  ARTICLES_SHEET_NAME,
  ARTICLE_ID_COLUMN,
  NATIONALITIES,
  REVIEWERS_SHEET_HEADERS,
  REVIEWERS_SHEET_NAME,
} from '../config/constants';
import { AREAS_TREE } from '../entities/areas/tree';
import { ArticleRow } from '../entities/articles/types';
import {
  FIELD_CONSTRAINTS,
  docTypeLabelsRequiring,
  alwaysRequiredFields,
  conditionallyRequiredFields,
} from '../config/article-form-rules';

const ALERT_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };

// ExcelJS quirk: direct cell fills honor `fgColor`, but conditional-formatting rule styles honor `bgColor` for the solid color (`fgColor` there is the pattern-over-pattern color). If you use `fgColor` in a CF rule, Excel paints the cell blank. Setting both keeps rendering correct regardless of which Excel reader is parsing the file.
const ALERT_FILL_CF: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFEB9C' },
  bgColor: { argb: 'FFFFEB9C' },
};

// A solid fill hides Excel's default gridline underneath. Re-drawing a matching thin grey border on the CF style keeps the cell visually aligned with its neighbors.
const ALERT_BORDER_CF: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
};

const DATA_VALIDATION_ROWS = 500;

// Fields that already receive a list validation (dropdown). Skipping them in the text/integer constraint loop prevents ExcelJS from overwriting the dropdown with a length/range rule.
const LIST_VALIDATED_FIELDS = new Set([
  'tipo_documento',
  'idioma',
  'otro_idioma',
  'tipo_resumen',
  'tipo_especialista',
  'eval_interna',
  'eval_nacional',
  'eval_internacional',
  'gran_area',
  'area',
  'subarea',
]);

// Integer-only strings are written as numbers so Excel does not flag the cells with "Number stored as text" in pagina_inicial, pagina_final, numero_autores, etc. DOIs and dates do not match this regex and stay as strings.
const INTEGER_RE = /^\d+$/;

export interface AuthorTemplateRow {
  titulo_articulo: string;
  nombre_completo: string;
  nacionalidad?: string;
  identificacion?: string;
  filiacion_institucional?: string;
}

export interface ReviewerTemplateRow {
  nombre_completo: string;
  nacionalidad?: string;
  identificacion?: string;
  filiacion_institucional?: string;
}

export async function generateTemplateWithData(
  articles: Partial<ArticleRow>[],
  outputPath: string,
  authors?: AuthorTemplateRow[],
  reviewers?: ReviewerTemplateRow[],
): Promise<string> {
  const wb = new ExcelJS.Workbook();

  buildArticlesSheet(wb, articles);
  buildAuthorsSheet(wb, authors ?? []);
  buildReviewersSheet(wb, reviewers ?? []);
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
    STATE_COLUMNS.STATE,
    STATE_COLUMNS.UPLOAD_DATE,
    STATE_COLUMNS.LAST_ERROR,
    ARTICLE_ID_COLUMN,
  ];

  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };

  for (const art of articles) {
    ws.addRow(headers.map((h) => coerceCellValue((art as Record<string, unknown>)[h] ?? '')));
  }

  ws.columns = headers.map((h) => ({ width: Math.max(h.length + 2, 18) }));

  addDataValidations(ws, headers);
  addDynamicRequiredHighlighting(ws, headers);
  addCrossFieldHighlighting(ws, headers);
}

// `identificacion` is NOT required: when present it powers a document-based search; when absent the uploader falls back to name search + interactive picker.
const AUTHORS_REQUIRED_FIELDS = ['nacionalidad'];

function buildAuthorsSheet(wb: ExcelJS.Workbook, authors: AuthorTemplateRow[]): void {
  const ws = wb.addWorksheet(AUTHORS_SHEET_NAME);
  const headers = [...AUTHORS_SHEET_HEADERS];

  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };

  for (const a of authors) {
    ws.addRow(headers.map((h) => (a as unknown as Record<string, unknown>)[h] ?? ''));
  }

  ws.columns = headers.map((h) => ({ width: Math.max(h.length + 2, 22) }));

  authors.forEach((a, rowIdx) => {
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const header = headers[colIdx];
      if (!AUTHORS_REQUIRED_FIELDS.includes(header)) continue;
      const value = (a as unknown as Record<string, unknown>)[header];
      if (value !== '' && value !== undefined && value !== null) continue;
      ws.getCell(rowIdx + 2, colIdx + 1).fill = ALERT_FILL;
    }
  });

  const nacionalidadCol = headers.indexOf('nacionalidad') + 1;
  if (nacionalidadCol > 0) {
    const values = Object.values(NATIONALITIES);
    applyListToColumn(ws, nacionalidadCol, `"${values.join(',')}"`);
  }
}

const REVIEWERS_REQUIRED_FIELDS = ['nombre_completo', 'nacionalidad'];

function buildReviewersSheet(wb: ExcelJS.Workbook, reviewers: ReviewerTemplateRow[]): void {
  const ws = wb.addWorksheet(REVIEWERS_SHEET_NAME);
  const headers = [...REVIEWERS_SHEET_HEADERS];

  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };

  for (const e of reviewers) {
    ws.addRow(headers.map((h) => (e as unknown as Record<string, unknown>)[h] ?? ''));
  }

  ws.columns = headers.map((h) => ({ width: Math.max(h.length + 2, 22) }));

  reviewers.forEach((e, rowIdx) => {
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const header = headers[colIdx];
      if (!REVIEWERS_REQUIRED_FIELDS.includes(header)) continue;
      const value = (e as unknown as Record<string, unknown>)[header];
      if (value !== '' && value !== undefined && value !== null) continue;
      ws.getCell(rowIdx + 2, colIdx + 1).fill = ALERT_FILL;
    }
  });

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

function addDynamicRequiredHighlighting(ws: ExcelJS.Worksheet, headers: string[]): void {
  const tituloIdx = headers.indexOf('titulo') + 1;
  const tipoIdx = headers.indexOf('tipo_documento') + 1;
  if (tituloIdx === 0 || tipoIdx === 0) return;
  const tituloCol = numberToColLetter(tituloIdx);
  const tipoCol = numberToColLetter(tipoIdx);

  // "Active row" = editor has started filling it (titulo or tipo_documento populated). Without this guard the 500 blank rows reserved for future data all light up yellow, drowning the signal. Excel's ISBLANK() returns FALSE for cells containing "" (empty string) and every row we write sets missing fields to "" via `?? ''`, so we compare with `=""` / `<>""`.
  const rowIsActive = `OR($${tituloCol}2<>"", $${tipoCol}2<>"")`;

  for (const field of alwaysRequiredFields()) {
    const fIdx = headers.indexOf(field) + 1;
    if (fIdx === 0) continue;
    const fCol = numberToColLetter(fIdx);
    ws.addConditionalFormatting({
      ref: `${fCol}2:${fCol}${DATA_VALIDATION_ROWS + 1}`,
      rules: [
        {
          type: 'expression',
          formulae: [`AND($${fCol}2="", ${rowIsActive})`],
          style: { fill: ALERT_FILL_CF, border: ALERT_BORDER_CF },
          priority: 1,
        },
      ],
    });
  }

  for (const field of conditionallyRequiredFields()) {
    const fIdx = headers.indexOf(field) + 1;
    if (fIdx === 0) continue;
    const fCol = numberToColLetter(fIdx);
    const rangeName = `REQ_${field.toUpperCase()}`;
    // The MATCH against REQ_* already requires `tipo_documento` to be populated, which by definition makes the row active — no extra guard needed here.
    ws.addConditionalFormatting({
      ref: `${fCol}2:${fCol}${DATA_VALIDATION_ROWS + 1}`,
      rules: [
        {
          type: 'expression',
          formulae: [`AND($${fCol}2="", NOT(ISNA(MATCH($${tipoCol}2, ${rangeName}, 0))))`],
          style: { fill: ALERT_FILL_CF, border: ALERT_BORDER_CF },
          priority: 1,
        },
      ],
    });
  }
}

function addCrossFieldHighlighting(ws: ExcelJS.Worksheet, headers: string[]): void {
  const pIniIdx = headers.indexOf('pagina_inicial') + 1;
  const pFinIdx = headers.indexOf('pagina_final') + 1;
  if (pIniIdx > 0 && pFinIdx > 0) {
    const pIniCol = numberToColLetter(pIniIdx);
    const pFinCol = numberToColLetter(pFinIdx);
    ws.addConditionalFormatting({
      ref: `${pFinCol}2:${pFinCol}${DATA_VALIDATION_ROWS + 1}`,
      rules: [
        {
          type: 'expression',
          formulae: [`AND($${pIniCol}2<>"", $${pFinCol}2<>"", $${pFinCol}2<=$${pIniCol}2)`],
          style: { fill: ALERT_FILL_CF, border: ALERT_BORDER_CF },
          priority: 1,
        },
      ],
    });
  }

  const fRecIdx = headers.indexOf('fecha_recepcion') + 1;
  const fAccIdx = headers.indexOf('fecha_aceptacion') + 1;
  if (fRecIdx > 0 && fAccIdx > 0) {
    const fRecCol = numberToColLetter(fRecIdx);
    const fAccCol = numberToColLetter(fAccIdx);
    ws.addConditionalFormatting({
      ref: `${fAccCol}2:${fAccCol}${DATA_VALIDATION_ROWS + 1}`,
      rules: [
        {
          type: 'expression',
          formulae: [`AND($${fRecCol}2<>"", $${fAccCol}2<>"", $${fAccCol}2<$${fRecCol}2)`],
          style: { fill: ALERT_FILL_CF, border: ALERT_BORDER_CF },
          priority: 1,
        },
      ],
    });
  }
}

function addDataValidations(ws: ExcelJS.Worksheet, headers: string[]): void {
  const colIdx = (h: string) => headers.indexOf(h) + 1;

  // Dropdowns store user-facing LABELS. The validator/mapper translates label → code before sending the payload to Publindex.
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

  // Cascading dropdowns gran_area → area → subarea. Named ranges are keyed on the Minciencias CODE (ASCII-safe — labels contain accented chars Excel rejects in names) and the formula translates label → code via VLOOKUP on the _lookups sheet.
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

  for (const [field, c] of Object.entries(FIELD_CONSTRAINTS)) {
    if (LIST_VALIDATED_FIELDS.has(field)) continue;
    const i = colIdx(field);
    if (i === 0) continue;

    if (c.kind === 'text' && (c.min !== undefined || c.max !== undefined)) {
      applyTextLengthValidation(ws, i, c.min ?? 0, c.max ?? 99999);
    } else if (c.kind === 'integer') {
      applyWholeValidation(ws, i, c.min ?? 0, c.max ?? 99999);
    }
    // `date` kind is handled by the cross-field conditional formatting (fecha_aceptacion vs fecha_recepcion).
  }
}

function applyTextLengthValidation(ws: ExcelJS.Worksheet, col: number, min: number, max: number): void {
  for (let r = 2; r <= DATA_VALIDATION_ROWS + 1; r++) {
    ws.getCell(r, col).dataValidation = {
      type: 'textLength',
      operator: 'between',
      allowBlank: true,
      formulae: [min, max],
      showErrorMessage: true,
      // `warning` — non-blocking: Excel shows a message but still accepts the value. User explicitly wants this UX.
      errorStyle: 'warning',
      error: `Longitud esperada entre ${min} y ${max} caracteres`,
    };
  }
}

function applyWholeValidation(ws: ExcelJS.Worksheet, col: number, min: number, max: number): void {
  for (let r = 2; r <= DATA_VALIDATION_ROWS + 1; r++) {
    ws.getCell(r, col).dataValidation = {
      type: 'whole',
      operator: 'between',
      allowBlank: true,
      formulae: [min, max],
      showErrorMessage: true,
      errorStyle: 'warning',
      error: `Entero esperado entre ${min} y ${max}`,
    };
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

  const granAreaLabels = AREAS_TREE.map((g) => g.txtNmeArea);
  const granAreaCodes = AREAS_TREE.map((g) => g.codAreaConocimiento);
  ws.getColumn(1).values = ['GRAN_AREAS', ...granAreaLabels];
  ws.getColumn(2).values = ['GRAN_CODES', ...granAreaCodes];
  defineRange(wb, ws.name, 'GRAN_AREAS', 1, 1, granAreaLabels.length);
  defineMultiColRange(wb, ws.name, 'GRAN_AREA_LOOKUP', 1, 2, 2, granAreaLabels.length);

  // Col C: labels of ALL areas (flat list). Col D: parallel codes. Used as the VLOOKUP source for the cascading area → subarea dropdown.
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

  let col = 5;
  for (const gran of AREAS_TREE) {
    const labels = (gran.areasHijas ?? []).map((a) => a.txtNmeArea);
    if (labels.length === 0) continue;
    const name = `AREAS_${gran.codAreaConocimiento}`;
    ws.getColumn(col).values = [name, ...labels];
    defineRange(wb, ws.name, name, col, col, labels.length);
    col++;
  }

  for (const gran of AREAS_TREE) {
    for (const area of gran.areasHijas ?? []) {
      const labels = (area.areasHijas ?? []).map((s) => s.txtNmeArea);
      if (labels.length === 0) continue;
      const name = `SUB_${area.codAreaConocimiento}`;
      ws.getColumn(col).values = [name, ...labels];
      defineRange(wb, ws.name, name, col, col, labels.length);
      col++;
    }
  }

  // REQ_<FIELD> ranges feed the conditional-formatting MATCH() on the articles sheet. Only conditional fields need these — always-required fields use a simpler blank-only rule. Field names are snake_case ASCII so uppercasing yields valid Excel named-range identifiers.
  for (const field of conditionallyRequiredFields()) {
    const labels = docTypeLabelsRequiring(field);
    if (labels.length === 0) continue;
    const name = `REQ_${field.toUpperCase()}`;
    ws.getColumn(col).values = [name, ...labels];
    defineRange(wb, ws.name, name, col, col, labels.length);
    col++;
  }
}

function defineRange(
  wb: ExcelJS.Workbook,
  sheetName: string,
  name: string,
  colIdx: number,
  _endCol: number,
  count: number,
): void {
  const letter = numberToColLetter(colIdx);
  const ref = `'${sheetName}'!$${letter}$2:$${letter}$${count + 1}`;
  wb.definedNames.add(ref, name);
}

function defineMultiColRange(
  wb: ExcelJS.Workbook,
  sheetName: string,
  name: string,
  startCol: number,
  endCol: number,
  _placeholder: number,
  count: number,
): void {
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

  ws.mergeCells('A1:D1');
  const note = ws.getCell('A1');
  note.value =
    'Nota: las celdas amarillas son campos obligatorios vacíos según el tipo_documento de esa fila, o violan longitud/rango. Cambie tipo_documento y el amarillo se vuelve a evaluar automáticamente.';
  note.alignment = { wrapText: true, vertical: 'middle' };
  note.font = { italic: true };
  ws.getRow(1).height = 40;

  const rows = [
    ['', '', '', ''],
    ['Campo', 'Obligatorio', 'Descripción', 'Ejemplo'],
    ['Hoja "Artículos"', '', '', ''],
    [
      'titulo',
      'Sí',
      'Título del artículo (mín. 10, máx. 255 caracteres)',
      'Título del artículo de ejemplo para Publindex',
    ],
    [
      'doi',
      'No',
      'DOI sin URL (formato 10.xxxx/yyyy, máx. 300 caracteres). NO use https://doi.org/...',
      '10.0000/fake.0001',
    ],
    [
      'url',
      'Sí',
      'URL del artículo con http:// o https:// (máx. 300 caracteres)',
      'https://revistas.ejemplo.edu.co/article/1',
    ],
    ['pagina_inicial', 'No', 'Página inicial (entero 1–9999)', '1'],
    ['pagina_final', 'No', 'Página final (entero 1–9999; debe ser > pagina_inicial)', '15'],
    ['numero_autores', 'No', 'Cantidad de autores del artículo (entero 1–9999)', '3'],
    ['numero_pares_evaluadores', 'No', 'Cantidad de pares que evaluaron el artículo (entero 0–9999)', '2'],
    ['proyecto', 'No', 'Nombre del proyecto de investigación asociado (máx. 2000 caracteres)', ''],
    ['gran_area', 'Sí', 'Dropdown con las grandes áreas de conocimiento Minciencias', 'Ciencias Sociales'],
    ['area', 'Sí', 'Dropdown con las áreas hijas de la gran_area seleccionada (cascada)', 'Sociología'],
    ['subarea', 'No', 'Dropdown con las subáreas hijas del area seleccionada (cascada)', 'Sociología General'],
    ['numero_referencias', 'No', 'Cantidad de referencias bibliográficas (entero 0–9999)', '30'],
    [
      'tipo_documento',
      'Sí',
      'Dropdown con los 12 tipos de documento Publindex',
      'Artículo de investigación científica y tecnológica',
    ],
    [
      'palabras_clave',
      'Sí (tipos 1–6)',
      'Palabras clave separadas por punto y coma (;) (máx. 2000 caracteres)',
      'sociología; cultura',
    ],
    [
      'palabras_clave_otro_idioma',
      'No',
      'Palabras clave en otro idioma, separadas por ; (máx. 2000 caracteres)',
      'sociology; culture',
    ],
    [
      'titulo_ingles',
      'Sí (tipos 1–6)',
      'Título paralelo en inglés (mín. 10, máx. 255 caracteres)',
      'Title of the article in English',
    ],
    ['fecha_recepcion', 'No', 'Fecha de recepción (formato YYYY-MM-DD)', '2026-01-15'],
    ['fecha_aceptacion', 'No', 'Fecha de aceptación (YYYY-MM-DD; debe ser >= fecha_recepcion)', '2026-03-20'],
    ['idioma', 'No', 'Dropdown con el idioma original del artículo', 'Español'],
    ['otro_idioma', 'No', 'Dropdown con otro idioma (no puede ser igual a idioma)', 'Inglés'],
    ['eval_interna', 'No', 'Evaluación por pares interna institucional: T=Sí, F=No', 'F'],
    ['eval_nacional', 'No', 'Evaluación por pares externos nacionales: T=Sí, F=No', 'T'],
    ['eval_internacional', 'No', 'Evaluación por pares externos internacionales: T=Sí, F=No', 'T'],
    ['tipo_resumen', 'No', 'Dropdown: Analítico / Descriptivo / Analítico sintético', 'Analítico'],
    [
      'tipo_especialista',
      'No',
      'Dropdown: Autor / Editor / Bibliotecólogo / Especialista en el área',
      'Especialista en el área',
    ],
    ['resumen', 'Sí (tipos 1–6)', 'Resumen del artículo (mín. 10, máx. 4000 caracteres)', 'Resumen del artículo...'],
    ['resumen_otro_idioma', 'No', 'Resumen en otro idioma (máx. 4000 caracteres)', 'Abstract of the article...'],
    ['resumen_idioma_adicional', 'No', 'Resumen en idioma adicional (máx. 4000 caracteres)', ''],
    ['', '', '', ''],
    [
      'Columnas de estado de Artículos (solo se rellenan si usa la ruta automatizada; con la extensión quedan vacías)',
      '',
      '',
      '',
    ],
    ['estado', 'Auto (ruta automatizada)', 'pendiente / subido / error', 'subido'],
    [
      'fecha_subida',
      'Auto (ruta automatizada)',
      'Fecha/hora ISO en que el artículo se cargó exitosamente',
      '2026-04-19T10:30:00Z',
    ],
    ['ultimo_error', 'Auto (ruta automatizada)', 'Mensaje de error si la carga falló', ''],
    ['id_articulo', 'Auto (ruta automatizada)', 'ID asignado por Publindex tras la carga exitosa', '123456'],
    ['', '', '', ''],
    ['Hoja "Autores" (autores por artículo; las filas Auto solo se rellenan con la ruta automatizada)', '', '', ''],
    [
      'titulo_articulo',
      'Sí',
      'Debe coincidir exactamente con el titulo de un artículo',
      'Título del artículo de ejemplo para Publindex',
    ],
    ['id_articulo', 'Auto (ruta automatizada)', 'Se completa al cargar artículos por la ruta automatizada', '123456'],
    ['nombre_completo', 'Sí', 'Nombre completo del autor', 'Jane Doe Ficticio'],
    ['identificacion', 'No', 'Cédula/doc. Si está vacío se busca por nombre con picker interactivo', '00000000'],
    ['nacionalidad', 'Sí', 'Dropdown: Colombiana / Extranjera', 'Colombiana'],
    ['filiacion_institucional', 'No', 'Afiliación del autor (de OJS si disponible)', 'Universidad Ficticia'],
    ['tiene_cvlac', 'Auto (ruta automatizada)', 'Se llena según staCertificado al buscar la persona', 'Sí'],
    ['estado_carga', 'Auto (ruta automatizada)', 'pendiente / subido / error', 'subido'],
    ['accion_requerida', 'Auto (ruta automatizada)', 'Mensaje de acción en caso de error o advertencia', ''],
    ['', '', '', ''],
    ['Hoja "Evaluadores" (pares del fascículo; las filas Auto solo se rellenan con la ruta automatizada)', '', '', ''],
    ['nombre_completo', 'Sí', 'Nombre completo del evaluador (par revisor)', 'Jane Doe Ficticio'],
    ['nacionalidad', 'Sí', 'Dropdown: Colombiana / Extranjera', 'Extranjera'],
    ['identificacion', 'No', 'Cédula/doc. Si está vacío se busca por nombre con picker interactivo', '00000000'],
    ['filiacion_institucional', 'No', 'Afiliación del evaluador (de OJS si disponible)', 'Universidad Ficticia'],
    ['tiene_cvlac', 'Auto (ruta automatizada)', 'Se llena según staCertificado al buscar la persona', 'Sí'],
    ['estado_carga', 'Auto (ruta automatizada)', 'pendiente / subido / error', 'subido'],
    ['accion_requerida', 'Auto (ruta automatizada)', 'Mensaje de acción en caso de error o advertencia', ''],
  ];

  rows.forEach((r) => ws.addRow(r));
  ws.columns = [{ width: 30 }, { width: 16 }, { width: 75 }, { width: 55 }];

  for (let r = 2; r <= ws.rowCount; r++) {
    const firstCell = ws.getCell(r, 1).value;
    if (typeof firstCell !== 'string') continue;
    if (firstCell === 'Campo') {
      ws.getRow(r).font = { bold: true };
    } else if (firstCell.startsWith('Hoja "') || firstCell.startsWith('Columnas de estado')) {
      ws.getRow(r).font = { bold: true };
    }
  }
}
