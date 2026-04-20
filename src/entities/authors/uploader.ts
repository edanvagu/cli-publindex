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

function nacionalidadCode(label: string): 'C' | 'E' {
  const entry = Object.entries(NATIONALITIES).find(([, v]) => v === label);
  return (entry?.[0] ?? 'E') as 'C' | 'E';
}

function writeError(
  tracker: ProgressTracker,
  author: AuthorRow,
  msg: string,
  accionRequerida: string,
  onWarning: (msg: string) => void,
) {
  tracker.actualizarAutor(
    {
      row: author._fila,
      estadoCarga: `${AUTHOR_STATES.ERROR}:${msg}`,
      accionRequerida,
    },
    onWarning,
  );
}

export async function runAuthorsUpload(
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
        const msg = 'No encontrado en Publindex';
        writeError(options.progressTracker, author, msg, 'Registrar autor manualmente en Publindex', options.onWarning);
        failed.push({ row: author._fila, nombre, error: msg });
        options.onProgress(i + 1, authors.length, nombre, false, Date.now() - start, msg);
        continue;
      }

      const enriched = await withRetry(
        () => getTrayectoria(session.token, person.codRh, options.anoFasciculo),
        { onRetry: (attempt, error) => options.onRetry(author._fila, attempt, error) },
      );

      const tieneCvlac = enriched.staCertificado === 'T';

      // Precheck Publindex: los colombianos deben tener CvLAC para poder vincularse.
      // Sin este check, el POST /autores responde con un mensaje en español; lo
      // preemptimos aquí para ahorrar un request y dar mejor feedback.
      if (author.nacionalidad === NATIONALITIES.C && !tieneCvlac) {
        const msg = 'Colombiano sin CvLAC';
        options.progressTracker.actualizarAutor(
          {
            row: author._fila,
            estadoCarga: `${AUTHOR_STATES.ERROR}:${msg}`,
            tieneCvlac: 'No',
            accionRequerida: 'Registrar al autor en CvLAC (https://scienti.minciencias.gov.co/cvlac/) y reintentar',
          },
          options.onWarning,
        );
        failed.push({ row: author._fila, nombre, error: msg });
        options.onProgress(i + 1, authors.length, nombre, false, Date.now() - start, msg);
        continue;
      }

      const idArticulo = parseInt(author.id_articulo, 10);
      await withRetry(
        () => linkAuthor(session.token, { ...enriched, idArticulo, anoFasciculo: options.anoFasciculo }),
        { onRetry: (attempt, error) => options.onRetry(author._fila, attempt, error) },
      );

      // Si la persona no tiene filiación institucional vigente en su trayectoria,
      // Publindex la asume automáticamente como INTERNA (de la institución editora
      // de la revista). El linkeo igual funciona, pero el editor debe actualizar
      // CvLAC si la filiación real es distinta.
      const tieneAfiliacionVigente = Array.isArray(enriched.instituciones) && enriched.instituciones.length > 0;
      const accionRequerida = tieneAfiliacionVigente
        ? ''
        : 'Registrar experiencia profesional en CvLAC — sin filiación vigente, el sistema asumirá automáticamente que la filiación es interna (de la institución editora de la revista)';

      options.progressTracker.actualizarAutor(
        {
          row: author._fila,
          estadoCarga: AUTHOR_STATES.UPLOADED,
          tieneCvlac: tieneCvlac ? 'Sí' : 'No',
          accionRequerida,
        },
        options.onWarning,
      );

      if (!tieneAfiliacionVigente) {
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
  const tpoNac = nacionalidadCode(author.nacionalidad);

  // Paso 1: búsqueda por documento (si se proporcionó).
  if (author.identificacion) {
    const byDoc = await searchPersons(token, {
      tpoNacionalidad: tpoNac,
      nroDocumentoIdent: author.identificacion,
      txtTotalNames: '',
    });
    if (byDoc.length > 0) return byDoc[0];
  }

  // Paso 2: fallback (o principal) por nombre con picker.
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
