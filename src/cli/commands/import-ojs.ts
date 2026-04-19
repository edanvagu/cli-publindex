import * as path from 'path';
import { spinner, success, error, info, warning } from '../logger';
import { promptOjsFilePath, promptJournalBaseUrl, promptSavePath } from '../prompts';
import { buildArticleUrl } from '../../utils/urls';
import { probeUrl } from '../../io/http-probe';
import { importFromOjs, ojsArticleToRow, OjsArticle } from '../../io/ojs-xml';
import { generateTemplateWithData } from '../../io/excel-writer';

const OJS_TEMPLATE_NAME = 'plantilla-articles-ojs.xlsx';

export async function importOjs(): Promise<void> {
  const file = await promptOjsFilePath();
  const parseSpinner = spinner(`Parseando ${path.basename(file)}...`);
  let articles: OjsArticle[];
  let warnings: string[];
  try {
    const result = await importFromOjs(file);
    articles = result.articles;
    warnings = result.warnings;
    parseSpinner.succeed(`${articles.length} publicaciones extraídas desde OJS`);
  } catch (err) {
    parseSpinner.fail('Error al parsear el XML de OJS');
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (articles.length === 0) {
    error('No se encontraron publicaciones en el XML. Verifique que sea un export válido de OJS.');
    process.exit(1);
  }

  const baseUrl = await promptJournalBaseUrl();
  const urlsByIndex = new Map<number, string>();
  const urlWarnings: string[] = [];

  if (baseUrl) {
    const withId = articles
      .map((art, idx) => ({ art, idx }))
      .filter(({ art }) => art.submissionId);

    if (withId.length === 0) {
      warning('Ningún artículo tiene submissionId; no se construirán URLs.');
    } else {
      const verifySpinner = spinner(`Construyendo y verificando ${withId.length} URLs...`);
      const results = await Promise.all(
        withId.map(async ({ art, idx }) => {
          const url = buildArticleUrl(baseUrl, art.submissionId!);
          const result = await probeUrl(url);
          return { idx, url, result };
        })
      );
      const okCount = results.filter(r => r.result.ok).length;
      verifySpinner.succeed(`${okCount}/${results.length} URLs respondieron 200`);

      for (const { idx, url, result } of results) {
        urlsByIndex.set(idx, url);
        if (!result.ok) {
          const detalle = result.status ? `status ${result.status}` : result.error ?? 'sin respuesta';
          urlWarnings.push(`Fila ${idx + 2}: URL ${url} no respondió 200 (${detalle}).`);
        }
      }
    }
  } else {
    info('URL base no proporcionada; las URLs quedarán vacías para llenar manualmente.');
  }

  const rows = articles.map((art, idx) => ojsArticleToRow(art, urlsByIndex.get(idx)));

  const outputPath = await promptSavePath(path.dirname(file), OJS_TEMPLATE_NAME);
  try {
    generateTemplateWithData(rows, outputPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EBUSY') {
      error(`No se pudo escribir ${path.basename(outputPath)} porque está abierto en Excel.`);
      info('Cierre el archivo y vuelva a ejecutar "Importar desde OJS".');
      process.exit(1);
    }
    throw err;
  }
  success(`Plantilla prellena generada con ${rows.length} artículos en ${outputPath}.`);

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

  console.log('');
  warning('Las celdas resaltadas en AMARILLO son campos obligatorios que quedaron vacíos — debe completarlos antes de validar.');
  info('Abra la plantilla en Excel, complete los campos amarillos, luego ejecute de nuevo la CLI y seleccione "Validar archivo de artículos".');
}
