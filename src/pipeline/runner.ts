import pLimit from 'p-limit';
import { ArticuloRow, UploadResult, Session } from '../data/types';
import { crearArticulo, rowToPayload } from '../api/articulos';
import { tokenVigente } from '../api/auth';
import { withRetry } from './retry';

export interface RunnerOptions {
  concurrency: number;
  onProgress: (current: number, total: number, titulo: string, ok: boolean, timeMs: number, error?: string) => void;
  onRetry: (fila: number, intento: number, error: Error) => void;
  onTokenExpiring: () => void;
}

export async function ejecutarCarga(
  session: Session,
  articulos: ArticuloRow[],
  idFasciculo: number,
  options: RunnerOptions
): Promise<UploadResult> {
  const limit = pLimit(options.concurrency);
  const inicio = Date.now();
  const exitosos: UploadResult['exitosos'] = [];
  const fallidos: UploadResult['fallidos'] = [];
  let procesados = 0;

  const tareas = articulos.map(articulo =>
    limit(async () => {
      // Verificar token antes de cada request
      if (!tokenVigente(session, 2)) {
        options.onTokenExpiring();
      }

      const start = Date.now();
      const payload = rowToPayload(articulo, idFasciculo);

      try {
        await withRetry(
          () => crearArticulo(session.token, payload),
          {
            onRetry: (intento, error) => {
              options.onRetry(articulo._fila, intento, error);
            },
          }
        );

        const elapsed = Date.now() - start;
        procesados++;
        options.onProgress(procesados, articulos.length, articulo.titulo, true, elapsed);
        exitosos.push({ fila: articulo._fila, titulo: articulo.titulo });
      } catch (err) {
        const elapsed = Date.now() - start;
        const errorMsg = err instanceof Error ? err.message : String(err);
        procesados++;
        options.onProgress(procesados, articulos.length, articulo.titulo, false, elapsed, errorMsg);
        fallidos.push({ fila: articulo._fila, titulo: articulo.titulo, error: errorMsg });
      }
    })
  );

  await Promise.all(tareas);

  return {
    exitosos,
    fallidos,
    tiempoTotal: Date.now() - inicio,
  };
}
