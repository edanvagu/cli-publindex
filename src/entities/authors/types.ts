import { AUTHOR_STATES } from '../../config/constants';

export interface AuthorRow {
  titulo_articulo: string;
  id_articulo: string;          // vacío hasta que el artículo padre se sube
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

export interface PersonSearchCriteria {
  tpoNacionalidad: 'C' | 'E';
  nroDocumentoIdent: string;
  txtTotalNames: string;
}

// Muchos campos vienen null en el response de /criterios; se completan al
// llamar a /trayectoriaProfesional con el codRh obtenido.
export interface PersonSearchResult {
  codRh: string;
  nroIdCnpq?: string | null;
  txtNamesRh?: string | null;
  txtPrimApell?: string | null;
  txtSegApell?: string | null;
  txtTotalNames?: string | null;
  txtCitacionBiblio?: string | null;
  dtaNacim?: string | null;
  tpoNacionalidad?: string | null;
  sglPaisNacim?: string | null;
  nmePaisNacim?: string | null;
  tpoDocumentoIdent?: string | null;
  nroDocumentoIdent?: string | null;
  codOrcid?: string | null;
  nroValorH5?: string | null;
  txtFuenteH5?: string | null;
  staCertificado?: string | null;     // 'T' si tiene CvLAC
  txtEmail?: string | null;
  txtDireccion?: string | null;
  txtTelefono?: string | null;
  instituciones?: string[] | null;
  formaciones?: unknown;
  idInstitucion?: number | null;
  anoInicioProfesional?: number | null;
  mesInicioProfesional?: number | null;
  anoFinProfesional?: number | null;
  mesFinProfesional?: number | null;
  codNivelFormacion?: string | null;
  txtNmeProgAcademico?: string | null;
  anoInicioEscolar?: number | null;
  mesInicioEscolar?: number | null;
  anoObtenEscolar?: number | null;
  mesObtenEscolar?: number | null;
  trayectoriasEscolares?: unknown;
  trayectoriasProfesionales?: unknown;
  vinculaciones?: unknown;
  [key: string]: unknown;
}

export type LinkAuthorPayload = PersonSearchResult & {
  idArticulo: number;
  anoFasciculo: number;
};

export interface AuthorsUploadResult {
  successful: { row: number; nombre: string }[];
  failed: { row: number; nombre: string; error: string }[];
  totalTimeMs: number;
}
