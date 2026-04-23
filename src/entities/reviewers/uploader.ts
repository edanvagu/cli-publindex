import { ReviewerRow, ReviewersUploadResult } from './types';
import { Session } from '../auth/types';
import { searchPersons, getTrayectoria } from '../persons/api';
import { PersonSearchResult } from '../persons/types';
import { linkReviewer, listReviewersByFasciculo } from './api';
import { tokenValid } from '../auth/session';
import { withRetry } from '../../utils/retry';
import { REVIEWER_STATES, DEFAULTS, NATIONALITIES } from '../../config/constants';
import { ProgressTracker } from '../../io/progress';
import { sleep } from '../../utils/async';

export interface ReviewersUploadOptions {
  progressTracker: ProgressTracker;
  idFasciculo: number;
  anoFasciculo: number;
  onProgress: (current: number, total: number, nombre: string, ok: boolean, timeMs: number, error?: string) => void;
  onRetry: (row: number, attempt: number, error: Error) => void;
  onTokenExpiring: () => void;
  onWarning: (msg: string) => void;
  onPickPerson: (candidates: PersonSearchResult[], reviewer: ReviewerRow) => Promise<PersonSearchResult | null>;
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

function writeError(
  tracker: ProgressTracker,
  reviewer: ReviewerRow,
  msg: string,
  requiredAction: string,
  onWarning: (msg: string) => void,
) {
  tracker.updateReviewer(
    {
      row: reviewer._fila,
      uploadState: `${REVIEWER_STATES.ERROR}:${msg}`,
      requiredAction,
    },
    onWarning,
  );
}

const NOT_FOUND_ERROR = 'No encontrado en Publindex';

function flipNationality(label: string): string {
  return label === NATIONALITIES.C ? NATIONALITIES.E : NATIONALITIES.C;
}

export function estimateReviewersTimeSeconds(count: number): number {
  return Math.round(count * DEFAULTS.ESTIMATED_SECONDS_PER_REVIEWER);
}

export async function runReviewersUpload(
  session: Session,
  reviewers: ReviewerRow[],
  options: ReviewersUploadOptions,
): Promise<ReviewersUploadResult> {
  const alreadyLinked = await fetchAlreadyLinked(session, options);

  const pass1 = await runReviewersPass(session, reviewers, alreadyLinked, options);

  const retryableRows = new Set(
    pass1.failed.filter(f => f.error === NOT_FOUND_ERROR).map(f => f.row),
  );
  if (retryableRows.size === 0) return pass1;

  options.onWarning(`Ronda 2: reintentando ${retryableRows.size} evaluador(es) con nacionalidad cruzada...`);

  const flipped: ReviewerRow[] = reviewers
    .filter(r => retryableRows.has(r._fila))
    .map(r => ({ ...r, nacionalidad: flipNationality(r.nacionalidad) }));

  const pass2 = await runReviewersPass(session, flipped, alreadyLinked, options);

  return {
    successful: [...pass1.successful, ...pass2.successful],
    failed: [
      ...pass1.failed.filter(f => !retryableRows.has(f.row)),
      ...pass2.failed,
    ],
    totalTimeMs: pass1.totalTimeMs + pass2.totalTimeMs,
  };
}

// Idempotency guard: if the editor already linked some reviewers from the UI, skip them without POST.
async function fetchAlreadyLinked(
  session: Session,
  options: ReviewersUploadOptions,
): Promise<Set<string>> {
  try {
    const linked = await listReviewersByFasciculo(session, options.idFasciculo);
    return new Set(linked.map(r => r.codRh).filter(Boolean));
  } catch (err) {
    options.onWarning(`No se pudo obtener la lista de evaluadores ya vinculados al fascículo: ${(err as Error).message}. Se continuará sin pre-filtro de duplicados.`);
    return new Set();
  }
}

async function runReviewersPass(
  session: Session,
  reviewers: ReviewerRow[],
  alreadyLinked: Set<string>,
  options: ReviewersUploadOptions,
): Promise<ReviewersUploadResult> {
  const startTime = Date.now();
  const successful: ReviewersUploadResult['successful'] = [];
  const failed: ReviewersUploadResult['failed'] = [];

  for (let i = 0; i < reviewers.length; i++) {
    if (options.abortSignal?.aborted) break;

    const reviewer = reviewers[i];
    const nombre = reviewer.nombre_completo;
    const start = Date.now();

    if (!tokenValid(session, 2)) {
      options.onTokenExpiring();
    }

    try {
      const person = await resolvePerson(session, reviewer, options);
      if (!person) {
        const msg = NOT_FOUND_ERROR;
        writeError(options.progressTracker, reviewer, msg, 'Registrar evaluador manualmente en Publindex', options.onWarning);
        failed.push({ row: reviewer._fila, nombre, error: msg });
        options.onProgress(i + 1, reviewers.length, nombre, false, Date.now() - start, msg);
        continue;
      }

      if (alreadyLinked.has(person.codRh)) {
        options.progressTracker.updateReviewer(
          {
            row: reviewer._fila,
            uploadState: REVIEWER_STATES.UPLOADED,
            requiredAction: 'Ya vinculado al fascículo (detectado por codRh)',
          },
          options.onWarning,
        );
        successful.push({ row: reviewer._fila, nombre });
        options.onProgress(i + 1, reviewers.length, nombre, true, Date.now() - start);
        continue;
      }

      await subcallPause(options.abortSignal);
      const enriched = await withRetry(
        () => getTrayectoria(session, person.codRh, options.anoFasciculo),
        { onRetry: (attempt, error) => options.onRetry(reviewer._fila, attempt, error) },
      );

      const hasCvlac = enriched.staCertificado === 'T';

      if (reviewer.nacionalidad === NATIONALITIES.C && !hasCvlac) {
        const msg = 'Colombiano sin CvLAC';
        options.progressTracker.updateReviewer(
          {
            row: reviewer._fila,
            uploadState: `${REVIEWER_STATES.ERROR}:${msg}`,
            hasCvlac: 'No',
            requiredAction: 'Registrar al evaluador en CvLAC (https://scienti.minciencias.gov.co/cvlac/) y reintentar',
          },
          options.onWarning,
        );
        failed.push({ row: reviewer._fila, nombre, error: msg });
        options.onProgress(i + 1, reviewers.length, nombre, false, Date.now() - start, msg);
        continue;
      }

      await subcallPause(options.abortSignal);
      await withRetry(
        () => linkReviewer(session, {
          ...enriched,
          idFasciculo: options.idFasciculo,
          anoFasciculo: options.anoFasciculo,
        }),
        { onRetry: (attempt, error) => options.onRetry(reviewer._fila, attempt, error) },
      );

      alreadyLinked.add(person.codRh);

      const hasCurrentAffiliation = Array.isArray(enriched.instituciones) && enriched.instituciones.length > 0;
      const requiredAction = hasCurrentAffiliation
        ? ''
        : 'Registrar experiencia profesional en CvLAC — sin filiación vigente, el sistema asumirá automáticamente que la filiación es interna (de la institución editora de la revista)';

      options.progressTracker.updateReviewer(
        {
          row: reviewer._fila,
          uploadState: REVIEWER_STATES.UPLOADED,
          hasCvlac: hasCvlac ? 'Sí' : 'No',
          requiredAction,
        },
        options.onWarning,
      );

      if (!hasCurrentAffiliation) {
        options.onWarning(`Fila ${reviewer._fila} (${nombre}): vinculado, pero sin filiación vigente — el sistema lo asumirá como filiación interna. Registrar experiencia en CvLAC si corresponde a otra institución.`);
      }

      successful.push({ row: reviewer._fila, nombre });
      options.onProgress(i + 1, reviewers.length, nombre, true, Date.now() - start);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      writeError(options.progressTracker, reviewer, errorMsg, 'Revisar error y reintentar', options.onWarning);
      failed.push({ row: reviewer._fila, nombre, error: errorMsg });
      options.onProgress(i + 1, reviewers.length, nombre, false, Date.now() - start, errorMsg);
    }

    if (i + 1 < reviewers.length) {
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
  reviewer: ReviewerRow,
  options: ReviewersUploadOptions,
): Promise<PersonSearchResult | null> {
  const nationality = nationalityCode(reviewer.nacionalidad);

  if (reviewer.identificacion) {
    const byDoc = await searchPersons(session, {
      tpoNacionalidad: nationality,
      nroDocumentoIdent: reviewer.identificacion,
      txtTotalNames: '',
    });
    if (byDoc.length > 0) return byDoc[0];
    await subcallPause(options.abortSignal);
  }

  if (reviewer.nombre_completo) {
    const byName = await searchPersons(session, {
      tpoNacionalidad: nationality,
      nroDocumentoIdent: '',
      txtTotalNames: reviewer.nombre_completo,
    });
    if (byName.length === 0) return null;

    const top20 = byName.slice(0, 20);
    return options.onPickPerson(top20, reviewer);
  }

  return null;
}
