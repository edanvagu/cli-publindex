export interface PersonSearchCriteria {
  tpoNacionalidad: 'C' | 'E';
  nroDocumentoIdent: string;
  txtTotalNames: string;
}

// Most fields come back null from /personas/criterios; they get filled in by a follow-up call to /personas/{codRh}/{anoFasciculo}/trayectoriaProfesional.
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
  staCertificado?: string | null;     // 'T' if the person has a CvLAC profile
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
