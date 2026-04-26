import { AuthorRow, AuthorsUploadResult, PersonSearchResult } from './types';
import { Session } from '../auth/types';
import { searchPersons, getTrayectoria, linkAuthor, listAuthorsByArticle } from './api';
import { tokenValid } from '../auth/session';
import { withRetry } from '../../utils/retry';
import { AUTHOR_STATES, DEFAULTS, NATIONALITIES } from '../../config/constants';
import { ProgressTracker } from '../../io/progress';
import { sleep } from '../../utils/async';

export interface AuthorsUploadOptions {
  progressTracker: ProgressTracker;
  anoFasciculo: number;
  onProgress: (current: number, total: number, nombre: string, ok: boolean, timeMs: number, error?: string) => void;
  onRetry: (row: number, attempt: number, error: Error) => void;
  onTokenExpiring: () => void;
  onWarning: (msg: string) => void;
  onPickPerson: (candidates: PersonSearchResult[], author: AuthorRow) => Promise<PersonSearchResult | null>;
  onPause?: (seconds: number) => void;
  abortSignal?: AbortSignal;
}

function adaptivePauseMs(elapsedMs: number): number {
  const base = Math.max(0, DEFAULTS.AUTHOR_TARGET_SPACING_MS - elapsedMs);
  const jitter = Math.floor(Math.random() * DEFAULTS.AUTHOR_JITTER_MS);
  return base + jitter;
}

function subcallPause(signal?: AbortSignal): Promise<void> {
  return sleep(DEFAULTS.SUBCALL_PAUSE_MS, signal).catch(() => {});
}

function nationalityCode(label: string): 'C' | 'E' {
  const entry = Object.entries(NATIONALITIES).find(([, v]) => v === label);
  return (entry?.[0] ?? 'E') as 'C' | 'E';
}

async function writeError(
  tracker: ProgressTracker,
  author: AuthorRow,
  msg: string,
  requiredAction: string,
  onWarning: (msg: string) => void,
): Promise<void> {
  await tracker.updateAuthor(
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

export function estimateAuthorsTimeSeconds(count: number): number {
  return Math.round(count * DEFAULTS.ESTIMATED_SECONDS_PER_AUTHOR);
}

export async function runAuthorsUpload(
  session: Session,
  authors: AuthorRow[],
  options: AuthorsUploadOptions,
): Promise<AuthorsUploadResult> {
  const linkedByArticle = new Map<number, Set<string>>();

  const pass1 = await runAuthorsPass(session, authors, linkedByArticle, options);

  const retryableRows = new Set(pass1.failed.filter((f) => f.error === NOT_FOUND_ERROR).map((f) => f.row));
  if (retryableRows.size === 0) return pass1;

  options.onWarning(`Ronda 2: reintentando ${retryableRows.size} autor(es) con nacionalidad cruzada...`);

  const flipped: AuthorRow[] = authors
    .filter((a) => retryableRows.has(a._fila))
    .map((a) => ({ ...a, nacionalidad: flipNationality(a.nacionalidad) }));

  const pass2 = await runAuthorsPass(session, flipped, linkedByArticle, options);

  return {
    successful: [...pass1.successful, ...pass2.successful],
    failed: [...pass1.failed.filter((f) => !retryableRows.has(f.row)), ...pass2.failed],
    totalTimeMs: pass1.totalTimeMs + pass2.totalTimeMs,
  };
}

// Idempotency guard: if the editor already linked some authors from the UI (or from a previous half-completed run), skip them without POST. The cache is keyed by idArticulo and each entry holds the codRh of the people already linked to that article.
async function ensureLinkedAuthorsFor(
  session: Session,
  idArticulo: number,
  cache: Map<number, Set<string>>,
  onWarning: (msg: string) => void,
): Promise<Set<string>> {
  const cached = cache.get(idArticulo);
  if (cached) return cached;
  try {
    const linked = await listAuthorsByArticle(session, idArticulo);
    const set = new Set(linked.map((a) => a.codRh).filter(Boolean));
    cache.set(idArticulo, set);
    return set;
  } catch (err) {
    onWarning(
      `No se pudo obtener la lista de autores ya vinculados al artículo ${idArticulo}: ${(err as Error).message}. Se continuará sin pre-filtro de duplicados para ese artículo.`,
    );
    const empty = new Set<string>();
    cache.set(idArticulo, empty);
    return empty;
  }
}

async function runAuthorsPass(
  session: Session,
  authors: AuthorRow[],
  linkedByArticle: Map<number, Set<string>>,
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
      const person = await resolvePerson(session, author, options);
      if (!person) {
        const msg = NOT_FOUND_ERROR;
        await writeError(
          options.progressTracker,
          author,
          msg,
          'Registrar autor manualmente en Publindex',
          options.onWarning,
        );
        failed.push({ row: author._fila, nombre, error: msg });
        options.onProgress(i + 1, authors.length, nombre, false, Date.now() - start, msg);
        continue;
      }

      const articleId = parseInt(author.id_articulo, 10);
      const alreadyLinked = await ensureLinkedAuthorsFor(session, articleId, linkedByArticle, options.onWarning);
      if (alreadyLinked.has(person.codRh)) {
        await options.progressTracker.updateAuthor(
          {
            row: author._fila,
            uploadState: AUTHOR_STATES.UPLOADED,
            requiredAction: 'Ya vinculado al artículo (detectado por codRh)',
          },
          options.onWarning,
        );
        successful.push({ row: author._fila, nombre });
        options.onProgress(i + 1, authors.length, nombre, true, Date.now() - start);
        continue;
      }

      await subcallPause(options.abortSignal);
      const enriched = await withRetry(() => getTrayectoria(session, person.codRh, options.anoFasciculo), {
        onRetry: (attempt, error) => options.onRetry(author._fila, attempt, error),
      });

      const hasCvlac = enriched.staCertificado === 'T';

      if (author.nacionalidad === NATIONALITIES.C && !hasCvlac) {
        const msg = 'Colombiano sin CvLAC';
        await options.progressTracker.updateAuthor(
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

      await subcallPause(options.abortSignal);
      await withRetry(
        () => linkAuthor(session, { ...enriched, idArticulo: articleId, anoFasciculo: options.anoFasciculo }),
        { onRetry: (attempt, error) => options.onRetry(author._fila, attempt, error) },
      );

      alreadyLinked.add(person.codRh);

      // Without a current institutional affiliation, Publindex defaults to INTERNAL (the editor journal's institution). Linking still succeeds; the editor must correct it via CvLAC afterwards if the real affiliation is elsewhere.
      const hasCurrentAffiliation = Array.isArray(enriched.instituciones) && enriched.instituciones.length > 0;
      const requiredAction = hasCurrentAffiliation
        ? ''
        : 'Registrar experiencia profesional en CvLAC — sin filiación vigente, el sistema asumirá automáticamente que la filiación es interna (de la institución editora de la revista)';

      await options.progressTracker.updateAuthor(
        {
          row: author._fila,
          uploadState: AUTHOR_STATES.UPLOADED,
          hasCvlac: hasCvlac ? 'Sí' : 'No',
          requiredAction,
        },
        options.onWarning,
      );

      if (!hasCurrentAffiliation) {
        options.onWarning(
          `Fila ${author._fila} (${nombre}): vinculado, pero sin filiación vigente — el sistema lo asumirá como filiación interna. Registrar experiencia en CvLAC si corresponde a otra institución.`,
        );
      }

      successful.push({ row: author._fila, nombre });
      options.onProgress(i + 1, authors.length, nombre, true, Date.now() - start);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await writeError(options.progressTracker, author, errorMsg, 'Revisar error y reintentar', options.onWarning);
      failed.push({ row: author._fila, nombre, error: errorMsg });
      options.onProgress(i + 1, authors.length, nombre, false, Date.now() - start, errorMsg);
    }

    if (i + 1 < authors.length) {
      const pauseMs = adaptivePauseMs(Date.now() - start);
      if (pauseMs > 0) {
        options.onPause?.(Math.round(pauseMs / 1000));
        try {
          await sleep(pauseMs, options.abortSignal);
        } catch {
          break;
        }
      }
    }
  }

  return {
    successful,
    failed,
    totalTimeMs: Date.now() - startTime,
  };
}

async function resolvePerson(
  session: Session,
  author: AuthorRow,
  options: AuthorsUploadOptions,
): Promise<PersonSearchResult | null> {
  const nationality = nationalityCode(author.nacionalidad);

  if (author.identificacion) {
    const byDoc = await searchPersons(session, {
      tpoNacionalidad: nationality,
      nroDocumentoIdent: author.identificacion,
      txtTotalNames: '',
    });
    if (byDoc.length > 0) return byDoc[0];
    await subcallPause(options.abortSignal);
  }

  if (author.nombre_completo) {
    const byName = await searchPersons(session, {
      tpoNacionalidad: nationality,
      nroDocumentoIdent: '',
      txtTotalNames: author.nombre_completo,
    });
    if (byName.length === 0) return null;

    const top20 = byName.slice(0, 20);
    return options.onPickPerson(top20, author);
  }

  return null;
}
