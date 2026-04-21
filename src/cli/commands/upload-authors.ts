import inquirer from 'inquirer';
import {
  spinner, success, error, info, warning,
  showProgress, showPickerReference, showCandidatesTable,
} from '../logger';
import { promptFilePath, confirmContinue, confirmAuthorsStart } from '../prompts';
import { readAuthors, ReadAuthorsResult } from '../../io/authors-reader';
import { runAuthorsUpload, estimateAuthorsTimeSeconds } from '../../entities/authors/uploader';
import { ProgressTracker } from '../../io/progress';
import { Session } from '../../entities/auth/types';
import { Issue } from '../../entities/issues/types';
import { AuthorRow, PersonSearchResult } from '../../entities/authors/types';
import { loginOrThrow, fetchAndSelectIssue, ensureTokenCoversEstimate } from './shared';

export interface AuthorsContext {
  file: string;
  session: Session;
  issue: Issue;
}

export async function uploadAuthors(): Promise<void> {
  const file = await promptFilePath();
  const session = await loginOrThrow();
  const issue = await fetchAndSelectIssue(session);
  await uploadAuthorsCore({ file, session, issue });
}

export async function uploadAuthorsWithContext(ctx: AuthorsContext): Promise<void> {
  await uploadAuthorsCore(ctx);
}

async function uploadAuthorsCore(ctx: AuthorsContext): Promise<void> {
  const { file, issue } = ctx;
  let { session } = ctx;

  const readSpinner = spinner(`Leyendo hoja Autores de ${file}...`);
  let readResult: ReadAuthorsResult;
  try {
    readResult = readAuthors(file);
    if (readResult.missingSheet) {
      readSpinner.fail('El archivo no tiene hoja "Autores"');
      error('Este flujo requiere un Excel generado por "Importar desde OJS" (tiene hoja Artículos + hoja Autores).');
      return;
    }
    readSpinner.succeed(`${readResult.authors.length} autores leídos (${readResult.uploaded.length} ya subidos, ${readResult.errored.length} con error, ${readResult.pending.length} pendientes)`);
  } catch (err) {
    readSpinner.fail('Error al leer archivo');
    error(err instanceof Error ? err.message : String(err));
    return;
  }

  const conIdArticulo = [...readResult.pending, ...readResult.errored].filter(a => a.id_articulo.trim() !== '');
  const sinIdArticulo = [...readResult.pending, ...readResult.errored].filter(a => a.id_articulo.trim() === '');

  if (sinIdArticulo.length > 0) {
    warning(`${sinIdArticulo.length} autores sin id_articulo — probablemente el artículo asociado aún no se ha cargado. Se saltan.`);
  }

  if (conIdArticulo.length === 0) {
    error('No hay autores pendientes con id_articulo. Primero ejecute "Validar y cargar artículos".');
    return;
  }

  const validationIssues = validateAuthors(conIdArticulo);
  if (validationIssues.length > 0) {
    for (const msg of validationIssues) warning(msg);
    const proceed = await confirmContinue('¿Continuar saltando esas filas?');
    if (!proceed) {
      info('Operación cancelada.');
      return;
    }
  }

  // `identificacion` es opcional: si falta, el uploader hace fallback a búsqueda por nombre.
  // Solo excluimos filas sin nacionalidad (necesaria para el param tpoNacionalidad) o sin nombre.
  const toProcess = conIdArticulo.filter(a => a.nacionalidad.trim() !== '' && a.nombre_completo.trim() !== '');

  if (toProcess.length === 0) {
    error('Ninguna fila tiene nacionalidad + nombre_completo.');
    return;
  }

  const estimatedTime = estimateAuthorsTimeSeconds(toProcess.length);
  const proceed = await confirmAuthorsStart(toProcess.length);
  if (!proceed) {
    info('Operación cancelada.');
    return;
  }

  const anoFasciculo = extractYear(issue.dtaPublicacion);
  if (!anoFasciculo) {
    error(`No se pudo determinar el año del fascículo (dtaPublicacion="${issue.dtaPublicacion}").`);
    return;
  }

  const refreshed = await ensureTokenCoversEstimate(session, estimatedTime, `vincular ${toProcess.length} autores`);
  if (!refreshed) return;
  session = refreshed;

  info(`Vinculando ${toProcess.length} autores...`);
  console.log('');

  const progressTracker = new ProgressTracker(file);

  const result = await runAuthorsUpload(session, toProcess, {
    progressTracker,
    anoFasciculo,
    onProgress: showProgress,
    onRetry: (row, attempt, err) => warning(`Fila ${row}: intento ${attempt} (${err.message})`),
    onTokenExpiring: () => warning('Token próximo a expirar. Los próximos requests podrían fallar.'),
    onWarning: warning,
    onPickPerson: buildPersonPicker(),
    onPause: (segundos) => info(`Pausa de ${segundos}s antes del siguiente autor...`),
  });

  progressTracker.trySyncSidecar();

  console.log('');
  success(`Vinculaciones exitosas: ${result.successful.length}`);
  if (result.failed.length > 0) {
    warning(`Fallidas: ${result.failed.length}`);
    for (const f of result.failed) {
      console.log(`    Fila ${f.row}: ${f.nombre} — ${f.error}`);
    }
  }
  success('Proceso finalizado.');
}

function validateAuthors(authors: AuthorRow[]): string[] {
  const msgs: string[] = [];
  for (const a of authors) {
    if (!a.nacionalidad.trim()) {
      msgs.push(`Fila ${a._fila} ("${a.nombre_completo}"): falta nacionalidad. Se saltará.`);
    }
    if (!a.nombre_completo.trim()) {
      msgs.push(`Fila ${a._fila}: falta nombre_completo. Se saltará.`);
    }
  }
  return msgs;
}

function extractYear(dta: string | undefined | null): number | null {
  if (!dta) return null;
  const match = String(dta).match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function buildPersonPicker() {
  return async (candidates: PersonSearchResult[], author: AuthorRow): Promise<PersonSearchResult | null> => {
    console.log('');
    const motivo = author.identificacion
      ? `el documento "${author.identificacion}" no encontró coincidencia`
      : 'no se proporcionó identificación';
    warning(`Fila ${author._fila}: ${motivo}. Se buscó por nombre "${author.nombre_completo}" y hay ${candidates.length} resultado(s).`);

    showPickerReference({
      _fila: author._fila,
      nombre_completo: author.nombre_completo,
      filiacion_institucional: author.filiacion_institucional,
      nacionalidad: author.nacionalidad,
      identificacion: author.identificacion,
    });

    showCandidatesTable(candidates.map(c => ({
      nombre: fullName(c),
      documento: c.nroDocumentoIdent || '—',
      pais: c.nmePaisNacim || '—',
      email: c.txtEmail || '—',
    })));

    const choices = candidates.map((c, i) => ({
      name: `${i + 1}. ${fullName(c)}${c.nmePaisNacim ? ' — ' + c.nmePaisNacim : ''}`,
      value: c,
    }));
    choices.push({ name: 'Ninguno — marcar error', value: null as unknown as PersonSearchResult });

    const { pick } = await inquirer.prompt([
      {
        type: 'list',
        name: 'pick',
        message: '¿Cuál es el autor correcto? (compare país/nombre con la tabla arriba)',
        choices,
        pageSize: Math.min(choices.length + 1, 15),
      },
    ]);
    return pick;
  };
}

function fullName(c: PersonSearchResult): string {
  return c.txtTotalNames
    || [c.txtNamesRh, c.txtPrimApell, c.txtSegApell].filter(Boolean).join(' ')
    || '(sin nombre)';
}
