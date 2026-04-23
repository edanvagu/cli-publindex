import * as path from 'path';
import { spinner, success, error, info, warning } from '../logger';
import { promptOjsFilePath, promptJournalBaseUrl, promptSavePath, promptUrlFailureAction, promptOptionalReviewsCsvPath } from '../prompts';
import { buildArticleUrl } from '../../utils/urls';
import { formatTimestampCompact } from '../../utils/dates';
import { probeUrl } from '../../io/http-probe';
import { importFromOjs, ojsArticleToRow, articlesToAuthorRows, OjsArticle } from '../../io/ojs-xml';
import { parseReviewsCsv, ReviewerRow } from '../../io/ojs-csv';
import { generateTemplateWithData, ReviewerTemplateRow } from '../../io/excel-writer';

function buildOutputName(inputXmlPath: string): string {
  const base = path.basename(inputXmlPath, path.extname(inputXmlPath));
  return `${base}_${formatTimestampCompact()}.xlsx`;
}

export async function importOjs(): Promise<void> {
  const file = await promptOjsFilePath();
  const parseSpinner = spinner(`Parseando ${path.basename(file)}...`);
  let articles: OjsArticle[];
  let warnings: string[];
  try {
    ({ articles, warnings } = await importFromOjs(file));
    parseSpinner.succeed(`${articles.length} publicaciones extraídas desde OJS`);
  } catch (err) {
    parseSpinner.fail('Error al parsear el XML de OJS');
    error(err instanceof Error ? err.message : String(err));
    return;
  }

  if (articles.length === 0) {
    error('No se encontraron publicaciones en el XML. Verifique que sea un export válido de OJS.');
    return;
  }

  let baseUrl = await promptJournalBaseUrl();
  const urlsByIndex = new Map<number, string>();
  const urlWarnings: string[] = [];

  while (baseUrl) {
    const withId = articles
      .map((art, idx) => ({ art, idx }))
      .filter(({ art }) => art.submissionId);

    if (withId.length === 0) {
      warning('Ningún artículo tiene submissionId; no se construirán URLs.');
      break;
    }

    const verifySpinner = spinner(`Construyendo y verificando ${withId.length} URLs...`);
    const results = await Promise.all(
      withId.map(async ({ art, idx }) => {
        const url = buildArticleUrl(baseUrl!, art.submissionId!);
        const result = await probeUrl(url);
        return { idx, url, result };
      })
    );
    const okCount = results.filter(r => r.result.ok).length;

    if (okCount === results.length) {
      verifySpinner.succeed('Las URL de cada artículo se validaron exitosamente.');
      for (const { idx, url } of results) urlsByIndex.set(idx, url);
      break;
    }

    if (okCount === 0) {
      verifySpinner.fail('Las URL no se comprobaron exitosamente.');
      const action = await promptUrlFailureAction();
      if (action === 'retry') {
        baseUrl = await promptJournalBaseUrl();
        continue;
      }
      break;
    }

    verifySpinner.warn(`${okCount}/${results.length} URLs respondieron 200`);
    for (const { idx, url, result } of results) {
      urlsByIndex.set(idx, url);
      if (!result.ok) {
        const detail = result.status ? `status ${result.status}` : result.error ?? 'sin respuesta';
        urlWarnings.push(`Fila ${idx + 2}: URL ${url} no respondió 200 (${detail}).`);
      }
    }
    break;
  }

  const rows = articles.map((art, idx) => ojsArticleToRow(art, urlsByIndex.get(idx)));
  const authorRows = articlesToAuthorRows(articles);

  const csvPath = await promptOptionalReviewsCsvPath();
  const { reviewerRows, csvWarnings, csvSummary } = csvPath
    ? readReviewersForFasciculo(csvPath, articles)
    : { reviewerRows: [] as ReviewerTemplateRow[], csvWarnings: [] as string[], csvSummary: null as string | null };

  const outputPath = await promptSavePath(path.dirname(file), buildOutputName(file));
  try {
    await generateTemplateWithData(rows, outputPath, authorRows, reviewerRows);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EBUSY') {
      error(`No se pudo escribir ${path.basename(outputPath)} porque está abierto en Excel.`);
      info('Cierre el archivo y vuelva a intentar desde el menú.');
      return;
    }
    throw err;
  }
  const summary = csvPath
    ? `${rows.length} artículos, ${authorRows.length} autores y ${reviewerRows.length} evaluadores`
    : `${rows.length} artículos y ${authorRows.length} autores`;
  success(`Plantilla prellena generada con ${summary} en ${outputPath}.`);

  if (csvSummary) info(csvSummary);

  if (warnings.length > 0) {
    console.log('');
    warning(`${warnings.length} artículos con paginación no estándar (posibles e-locators de publicación continua):`);
    for (const a of warnings) warning(`  ${a}`);
  }

  if (urlWarnings.length > 0) {
    console.log('');
    warning(`${urlWarnings.length} URLs no respondieron 200 (quedaron en la plantilla, pero revise antes de cargar):`);
    for (const a of urlWarnings) warning(`  ${a}`);
  }

  if (csvWarnings.length > 0) {
    console.log('');
    for (const a of csvWarnings) warning(a);
  }

  console.log('');
  warning('Las celdas resaltadas en AMARILLO son campos obligatorios que quedaron vacíos — debe completarlos antes de validar.');
  info('Abra la plantilla en Excel. En la hoja "Artículos" complete los campos amarillos.');
  info('En la hoja "Autores" puede opcionalmente agregar la `identificacion` de cada autor (si la tiene). Sin identificación el CLI busca por nombre con un picker interactivo.');
  if (csvPath) {
    info('En la hoja "Evaluadores" complete las cédulas si las tiene y ajuste nacionalidades que hayan quedado vacías desde OJS.');
  } else {
    info('La hoja "Evaluadores" quedó vacía: pude llenarla manualmente o re-ejecutar este comando suministrando el CSV de revisiones de OJS.');
  }
  info('Luego ejecute: (1) "Validar y cargar artículos" → (2) "Vincular autores a artículos cargados" → (3) "Vincular evaluadores al fascículo".');
}

function readReviewersForFasciculo(
  csvPath: string,
  articles: OjsArticle[],
): { reviewerRows: ReviewerTemplateRow[]; csvWarnings: string[]; csvSummary: string | null } {
  const submissionIdSet = new Set(
    articles
      .map(a => a.submissionId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const csvSpinner = spinner(`Leyendo CSV de revisiones (${path.basename(csvPath)})...`);
  try {
    const result = parseReviewsCsv(csvPath, submissionIdSet);
    csvSpinner.succeed(
      `${result.reviewers.length} evaluadores únicos extraídos del fascículo ` +
      `(${result.matchedForFasciculo} filas del CSV emparejaron con ${submissionIdSet.size} submissionIds del XML)`
    );
    return {
      reviewerRows: result.reviewers.map(reviewerToTemplateRow),
      csvWarnings: result.warnings,
      csvSummary: `Filas totales del CSV: ${result.totalRowsInCsv}. Después de filtros (Revisión + completada + no cancelada/rechazada) y dedup por username: ${result.reviewers.length}.`,
    };
  } catch (err) {
    csvSpinner.fail('Error al leer CSV de revisiones');
    warning(err instanceof Error ? err.message : String(err));
    warning('La hoja Evaluadores quedará vacía; complétela manualmente.');
    return { reviewerRows: [], csvWarnings: [], csvSummary: null };
  }
}

function reviewerToTemplateRow(r: ReviewerRow): ReviewerTemplateRow {
  return {
    nombre_completo: r.nombre_completo,
    nacionalidad: r.nacionalidad,
    filiacion_institucional: r.filiacion_institucional,
  };
}
