import { AuthorRow, AuthorsUploadResult, PersonSearchResult } from './types';
import { Session } from '../auth/types';
import { searchPersons, getTrayectoria, linkAuthor } from './api';
import { tokenValid } from '../auth/session';
import { withRetry } from '../../utils/retry';
import { AUTHOR_STATES, NATIONALITIES } from '../../config/constants';
import { ProgressTracker } from '../../io/progress';

export interface AuthorsUploadOptions {
  progressTracker: ProgressTracker;
  anoFasciculo: number;
  onProgress: (current: number, total: number, nombre: string, ok: boolean, timeMs: number, error?: string) => void;
  onRetry: (row: number, attempt: number, error: Error) => void;
  onTokenExpiring: () => void;
  onWarning: (msg: string) => void;
  onPickPerson: (candidates: PersonSearchResult[], author: AuthorRow) => Promise<PersonSearchResult | null>;
  abortSignal?: AbortSignal;
}

function nationalityCode(label: string): 'C' | 'E' {
  const entry = Object.entries(NATIONALITIES).find(([, v]) => v === label);
  return (entry?.[0] ?? 'E') as 'C' | 'E';
}

function writeError(
  tracker: ProgressTracker,
  author: AuthorRow,
  msg: string,
  requiredAction: string,
  onWarning: (msg: string) => void,
) {
  tracker.updateAuthor(
    {
      row: author._fila,
      uploadState: `${AUTHOR_STATES.ERROR}:${msg}`,
      requiredAction,
    },
    onWarning,
  );
}

const NOT_FOUND_ERROR = 'No encontrado en Publindex';

function flipNationality(label: string): string {
  return label === NATIONALITIES.C ? NATIONALITIES.E : NATIONALITIES.C;
}

export async function runAuthorsUpload(
  session: Session,
  authors: AuthorRow[],
  options: AuthorsUploadOptions,
): Promise<AuthorsUploadResult> {
  const pass1 = await runAuthorsPass(session, authors, options);

  const retryableRows = new Set(
    pass1.failed.filter(f => f.error === NOT_FOUND_ERROR).map(f => f.row),
  );
  if (retryableRows.size === 0) return pass1;

  options.onWarning(`Ronda 2: reintentando ${retryableRows.size} autor(es) con nacionalidad cruzada...`);

  const flipped: AuthorRow[] = authors
    .filter(a => retryableRows.has(a._fila))
    .map(a => ({ ...a, nacionalidad: flipNationality(a.nacionalidad) }));

  const pass2 = await runAuthorsPass(session, flipped, options);

  return {
    successful: [...pass1.successful, ...pass2.successful],
    failed: [
      ...pass1.failed.filter(f => !retryableRows.has(f.row)),
      ...pass2.failed,
    ],
    totalTimeMs: pass1.totalTimeMs + pass2.totalTimeMs,
  };
}

async function runAuthorsPass(
  session: Session,
  authors: AuthorRow[],
  options: AuthorsUploadOptions,
): Promise<AuthorsUploadResult> {
  const startTime = Date.now();
  const successful: AuthorsUploadResult['successful'] = [];
  const failed: AuthorsUploadResult['failed'] = [];

  for (let i = 0; i < authors.length; i++) {
    if (options.abortSignal?.aborted) break;

    const author = authors[i];
    const nombre = author.nombre_completo;
    const start = Date.now();

    if (!tokenValid(session, 2)) {
      options.onTokenExpiring();
    }

    try {
      const person = await resolvePerson(session.token, author, options);
      if (!person) {
        const msg = NOT_FOUND_ERROR;
        writeError(options.progressTracker, author, msg, 'Registrar autor manualmente en Publindex', options.onWarning);
        failed.push({ row: author._fila, nombre, error: msg });
        options.onProgress(i + 1, authors.length, nombre, false, Date.now() - start, msg);
        continue;
      }

      const enriched = await withRetry(
        () => getTrayectoria(session.token, person.codRh, options.anoFasciculo),
        { onRetry: (attempt, error) => options.onRetry(author._fila, attempt, error) },
      );

      const hasCvlac = enriched.staCertificado === 'T';

      // Pre-check: colombianos sin CvLAC no pueden vincularse. Hacerlo acá evita
      // un POST /autores que Publindex rechaza con un mensaje en español.
      if (author.nacionalidad === NATIONALITIES.C && !hasCvlac) {
        const msg = 'Colombiano sin CvLAC';
        options.progressTracker.updateAuthor(
          {
            row: author._fila,
            uploadState: `${AUTHOR_STATES.ERROR}:${msg}`,
            hasCvlac: 'No',
            requiredAction: 'Registrar al autor en CvLAC (https://scienti.minciencias.gov.co/cvlac/) y reintentar',
          },
          options.onWarning,
        );
        failed.push({ row: author._fila, nombre, error: msg });
        options.onProgress(i + 1, authors.length, nombre, false, Date.now() - start, msg);
        continue;
      }

      const articleId = parseInt(author.id_articulo, 10);
      await withRetry(
        () => linkAuthor(session.token, { ...enriched, idArticulo: articleId, anoFasciculo: options.anoFasciculo }),
        { onRetry: (attempt, error) => options.onRetry(author._fila, attempt, error) },
      );

      // Sin filiación institucional vigente, Publindex asume INTERNA (de la
      // institución editora) por defecto. El linkeo funciona; el editor corrige
      // via CvLAC si la filiación real es otra.
      const hasCurrentAffiliation = Array.isArray(enriched.instituciones) && enriched.instituciones.length > 0;
      const requiredAction = hasCurrentAffiliation
        ? ''
        : 'Registrar experiencia profesional en CvLAC — sin filiación vigente, el sistema asumirá automáticamente que la filiación es interna (de la institución editora de la revista)';

      options.progressTracker.updateAuthor(
        {
          row: author._fila,
          uploadState: AUTHOR_STATES.UPLOADED,
          hasCvlac: hasCvlac ? 'Sí' : 'No',
          requiredAction,
        },
        options.onWarning,
      );

      if (!hasCurrentAffiliation) {
        options.onWarning(`Fila ${author._fila} (${nombre}): vinculado, pero sin filiación vigente — el sistema lo asumirá como filiación interna. Registrar experiencia en CvLAC si corresponde a otra institución.`);
      }

      successful.push({ row: author._fila, nombre });
      options.onProgress(i + 1, authors.length, nombre, true, Date.now() - start);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      writeError(options.progressTracker, author, errorMsg, 'Revisar error y reintentar', options.onWarning);
      failed.push({ row: author._fila, nombre, error: errorMsg });
      options.onProgress(i + 1, authors.length, nombre, false, Date.now() - start, errorMsg);
    }
  }

  return {
    successful,
    failed,
    totalTimeMs: Date.now() - startTime,
  };
}

async function resolvePerson(
  token: string,
  author: AuthorRow,
  options: AuthorsUploadOptions,
): Promise<PersonSearchResult | null> {
  const tpoNac = nationalityCode(author.nacionalidad);

  if (author.identificacion) {
    const byDoc = await searchPersons(token, {
      tpoNacionalidad: tpoNac,
      nroDocumentoIdent: author.identificacion,
      txtTotalNames: '',
    });
    if (byDoc.length > 0) return byDoc[0];
  }

  if (author.nombre_completo) {
    const byName = await searchPersons(token, {
      tpoNacionalidad: tpoNac,
      nroDocumentoIdent: '',
      txtTotalNames: author.nombre_completo,
    });
    if (byName.length === 0) return null;

    const top20 = byName.slice(0, 20);
    return options.onPickPerson(top20, author);
  }

  return null;
}
