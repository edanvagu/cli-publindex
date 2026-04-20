import { AUTHOR_STATES } from '../../config/constants';

// Fila del Excel hoja Autores — keys coinciden con columnas del Excel.
export interface AuthorRow {
  titulo_articulo: string;
  id_articulo: string;          // puede estar vacío si aún no se subió el artículo
  nombre_completo: string;
  identificacion: string;       // número de documento
  nacionalidad: string;         // label: "Colombiana" | "Extranjera"
  filiacion_institucional?: string;
  tiene_cvlac?: string;         // label: "Sí" | "No" — auto
  estado_carga?: string;        // auto
  accion_requerida?: string;    // auto
  _fila: number;
}

export type AuthorState = typeof AUTHOR_STATES[keyof typeof AUTHOR_STATES];

// Criterios del POST /api/personas/criterios
export interface PersonSearchCriteria {
  tpoNacionalidad: 'C' | 'E';
  nroDocumentoIdent: string;
  txtTotalNames: string;
}

// Shape de cada persona en el array de respuesta de /personas/criterios.
// Muchos campos vienen null en la búsqueda y se completan con trayectoriaProfesional.
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

// Payload del POST /api/autores: objeto completo de la búsqueda + idArticulo + anoFasciculo.
export type LinkAuthorPayload = PersonSearchResult & {
  idArticulo: number;
  anoFasciculo: number;
};

export interface AuthorsUploadResult {
  successful: { row: number; nombre: string }[];
  failed: { row: number; nombre: string; error: string }[];
  totalTimeMs: number;
}
