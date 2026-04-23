import { REVIEWER_STATES } from '../../config/constants';
import { PersonSearchResult } from '../persons/types';

export interface ReviewerRow {
  nombre_completo: string;
  identificacion: string;
  nacionalidad: string;                   // "Colombiana" | "Extranjera"
  filiacion_institucional?: string;
  tiene_cvlac?: string;
  estado_carga?: string;
  accion_requerida?: string;
  _fila: number;
}

export type ReviewerState = typeof REVIEWER_STATES[keyof typeof REVIEWER_STATES];

export type LinkReviewerPayload = PersonSearchResult & {
  idFasciculo: number;
  anoFasciculo: number;
};

export interface ReviewersUploadResult {
  successful: { row: number; nombre: string }[];
  failed: { row: number; nombre: string; error: string }[];
  totalTimeMs: number;
}
