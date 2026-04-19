import { ArticuloRow, UploadResult, Session } from '../data/types';
import { crearArticulo, rowToPayload } from '../api/articulos';
import { tokenVigente } from '../api/auth';
import { withRetry } from './retry';
import { DEFAULTS, ESTADOS_ARTICULO } from '../config/constants';
import { GestorProgreso } from '../data/progreso';
import { sleep } from '../utils/async';

export interface RunnerOptions {
  gestorProgreso: GestorProgreso;
  onProgress: (current: number, total: number, titulo: string, ok: boolean, timeMs: number, error?: string) => void;
  onPausa: (segundos: number) => void;
  onTiempoRestante: (segundos: number, procesados: number, total: number) => void;
  onRetry: (fila: number, intento: number, error: Error) => void;
  onTokenExpiring: () => void;
  onAdvertencia: (msg: string) => void;
  abortSignal?: AbortSignal;
}

function pausaAleatoriaMs(): number {
  return DEFAULTS.PAUSA_MIN_MS + Math.floor(Math.random() * (DEFAULTS.PAUSA_MAX_MS - DEFAULTS.PAUSA_MIN_MS));
}

export async function ejecutarCarga(
  session: Session,
  articulos: ArticuloRow[],
  idFasciculo: number,
  options: RunnerOptions
): Promise<UploadResult> {
  const inicio = Date.now();
  const exitosos: UploadResult['exitosos'] = [];
  const fallidos: UploadResult['fallidos'] = [];

  for (let i = 0; i < articulos.length; i++) {
    if (options.abortSignal?.aborted) break;

    const articulo = articulos[i];

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
      exitosos.push({ fila: articulo._fila, titulo: articulo.titulo });
      options.onProgress(i + 1, articulos.length, articulo.titulo, true, elapsed);

      options.gestorProgreso.actualizar(
        { fila: articulo._fila, estado: ESTADOS_ARTICULO.SUBIDO },
        options.onAdvertencia
      );
    } catch (err) {
      const elapsed = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      fallidos.push({ fila: articulo._fila, titulo: articulo.titulo, error: errorMsg });
      options.onProgress(i + 1, articulos.length, articulo.titulo, false, elapsed, errorMsg);

      options.gestorProgreso.actualizar(
        { fila: articulo._fila, estado: ESTADOS_ARTICULO.ERROR, error: errorMsg },
        options.onAdvertencia
      );
    }

    const procesados = i + 1;
    if (procesados < articulos.length) {
      const restante = estimarTiempoRestanteSegundos(procesados, articulos.length, Date.now() - inicio);
      options.onTiempoRestante(restante, procesados, articulos.length);

      const pausa = pausaAleatoriaMs();
      options.onPausa(Math.round(pausa / 1000));
      try {
        await sleep(pausa, options.abortSignal);
      } catch {
        break; // cancelado
      }
    }
  }

  return {
    exitosos,
    fallidos,
    tiempoTotal: Date.now() - inicio,
  };
}

export function estimarTiempoSegundos(cantidad: number): number {
  return Math.round(cantidad * DEFAULTS.TIEMPO_ESTIMADO_POR_ARTICULO_S);
}

export function estimarTiempoRestanteSegundos(
  procesados: number,
  total: number,
  tiempoTranscurridoMs: number,
): number {
  const restantes = total - procesados;
  if (restantes <= 0) return 0;
  if (procesados <= 0) return estimarTiempoSegundos(restantes);
  const promedioMs = tiempoTranscurridoMs / procesados;
  return Math.round((restantes * promedioMs) / 1000);
}

export function formatearTiempo(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  if (min < 60) return `${min}m ${seg}s`;
  const horas = Math.floor(min / 60);
  const minRest = min % 60;
  return `${horas}h ${minRest}m`;
}
