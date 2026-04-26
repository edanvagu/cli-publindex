import * as path from 'path';
import { spinner, error, info, warning } from '../logger';
import {
  promptOjsFilePath,
  promptJournalBaseUrl,
  promptSavePath,
  promptUrlFailureAction,
  promptOptionalReviewsCsvPath,
  confirmContinue,
  confirmOjsReady,
} from '../prompts';
import { openInDefaultApp } from './shared';
import { showOjsExportHelp } from './help-ojs-export';
import { buildArticleUrl } from '../../utils/urls';
import { formatTimestampCompact } from '../../utils/dates';
import { probeUrl, humanizeProbeFailure } from '../../io/http-probe';
import { importFromOjs, ojsArticleToRow, articlesToAuthorRows, OjsArticle } from '../../io/ojs-xml';
import { parseReviewsCsv, ReviewerRow } from '../../io/ojs-csv';
import { generateTemplateWithData, ReviewerTemplateRow } from '../../io/excel-writer';

function buildOutputName(inputXmlPath: string): string {
  const base = path.basename(inputXmlPath, path.extname(inputXmlPath));
  return `${base}_${formatTimestampCompact()}.xlsx`;
}

export async function importOjs(): Promise<void> {
  while (true) {
    const ready = await confirmOjsReady();
    if (ready === 'cancel') return;
    if (ready === 'ready') break;
    await showOjsExportHelp();
  }

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
    const withId = articles.map((art, idx) => ({ art, idx })).filter(({ art }) => art.submissionId);

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
      }),
    );
    const okCount = results.filter((r) => r.result.ok).length;

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

    verifySpinner.warn(`${okCount} de ${results.length} URLs están accesibles`);
    for (const { idx, url, result } of results) {
      urlsByIndex.set(idx, url);
      if (!result.ok) {
        urlWarnings.push(`Fila ${idx + 2}: ${url} — ${humanizeProbeFailure(result)}.`);
      }
    }
    break;
  }

  const rows = articles.map((art, idx) => ojsArticleToRow(art, urlsByIndex.get(idx)));
  const authorRows = articlesToAuthorRows(articles);

  const csvPath = await promptOptionalReviewsCsvPath();
  const { reviewerRows, csvWarnings } = csvPath
    ? readReviewersForFasciculo(csvPath, articles)
    : { reviewerRows: [] as ReviewerTemplateRow[], csvWarnings: [] as string[] };

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

  if (warnings.length > 0) {
    console.log('');
    warning(`${warnings.length} artículos con paginación no estándar (posibles e-locators de publicación continua):`);
    for (const a of warnings) warning(`  ${a}`);
  }

  if (urlWarnings.length > 0) {
    console.log('');
    warning(
      `${urlWarnings.length} URLs no se pudieron verificar (quedaron en la plantilla, pero revíselas antes de cargar):`,
    );
    for (const a of urlWarnings) warning(`  ${a}`);
  }

  if (csvWarnings.length > 0) {
    console.log('');
    for (const a of csvWarnings) warning(a);
  }

  console.log('');
  info('Plantilla lista. Complete los campos amarillos en Excel y vuelva al menú principal → Cargar a Publindex.');

  const openNow = await confirmContinue('¿Abrir la plantilla ahora?');
  if (openNow) openInDefaultApp(outputPath);
}

function readReviewersForFasciculo(
  csvPath: string,
  articles: OjsArticle[],
): { reviewerRows: ReviewerTemplateRow[]; csvWarnings: string[] } {
  const submissionIdSet = new Set(
    articles.map((a) => a.submissionId).filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const csvSpinner = spinner(`Leyendo CSV de revisiones (${path.basename(csvPath)})...`);
  try {
    const result = parseReviewsCsv(csvPath, submissionIdSet);
    csvSpinner.succeed(
      `${result.reviewers.length} evaluadores únicos extraídos del fascículo ` +
        `(${result.matchedForFasciculo} filas del CSV emparejaron con ${submissionIdSet.size} submissionIds del XML)`,
    );
    return {
      reviewerRows: result.reviewers.map(reviewerToTemplateRow),
      csvWarnings: result.warnings,
    };
  } catch (err) {
    csvSpinner.fail('Error al leer CSV de revisiones');
    warning(err instanceof Error ? err.message : String(err));
    warning('La hoja Evaluadores quedará vacía; complétela manualmente.');
    return { reviewerRows: [], csvWarnings: [] };
  }
}

function reviewerToTemplateRow(r: ReviewerRow): ReviewerTemplateRow {
  return {
    nombre_completo: r.nombre_completo,
    nacionalidad: r.nacionalidad,
    filiacion_institucional: r.filiacion_institucional,
  };
}
