import { AUTHOR_STATES } from '../../config/constants';
import { PersonSearchResult } from '../persons/types';

export type { PersonSearchCriteria, PersonSearchResult } from '../persons/types';

export interface AuthorRow {
  titulo_articulo: string;
  id_articulo: string;          // empty until the parent article has been uploaded
  nombre_completo: string;
  identificacion: string;
  nacionalidad: string;         // "Colombiana" | "Extranjera"
  filiacion_institucional?: string;
  tiene_cvlac?: string;         // "Sí" | "No"
  estado_carga?: string;
  accion_requerida?: string;
  _fila: number;
}

export type AuthorState = typeof AUTHOR_STATES[keyof typeof AUTHOR_STATES];

export type LinkAuthorPayload = PersonSearchResult & {
  idArticulo: number;
  anoFasciculo: number;
};

export interface AuthorsUploadResult {
  successful: { row: number; nombre: string }[];
  failed: { row: number; nombre: string; error: string }[];
  totalTimeMs: number;
}
