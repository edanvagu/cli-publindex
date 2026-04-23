import { ARTICLE_STATES } from '../../config/constants';

export interface ArticleRow {
  titulo: string;
  doi?: string;
  url: string;
  pagina_inicial?: string;
  pagina_final?: string;
  numero_autores?: string;
  numero_pares_evaluadores?: string;
  proyecto?: string;
  gran_area: string;
  area: string;
  subarea?: string;
  numero_referencias?: string;
  tipo_documento: string;
  palabras_clave: string;
  palabras_clave_otro_idioma?: string;
  titulo_ingles: string;
  fecha_recepcion?: string;
  fecha_aceptacion?: string;
  idioma?: string;
  otro_idioma?: string;
  eval_interna?: string;
  eval_nacional?: string;
  eval_internacional?: string;
  tipo_resumen?: string;
  tipo_especialista?: string;
  resumen: string;
  resumen_otro_idioma?: string;
  resumen_idioma_adicional?: string;
  estado?: string;
  fecha_subida?: string;
  ultimo_error?: string;
  id_articulo?: string;
  _fila: number;
}

export interface ArticlePayload {
  idFasciculo: number;
  txtTituloArticulo: string;
  txtUrl: string;
  codGranArea: string;
  codAreaConocimiento: string;
  tpoDocumento: string;
  txtPalabraClave: string;
  txtTituloParalelo: string;
  txtResumen: string;
  txtDoi: string | null;
  nroPaginaInicial: string | null;
  nroPaginaFinal: string | null;
  nroAutores: string | null;
  nroParesEvaluo: string | null;
  txtProyecto: string | null;
  codSubAreaConocimiento: string | null;
  nroReferencias: string | null;
  txtPalabraClaveIdioma: string | null;
  dtaRecepcion: string | null;
  dtaVerifFechaAceptacion: string | null;
  codIdioma: string | null;
  codIdiomaOtro: string | null;
  staInternoInstiTit: string | null;
  staNacionalExternoInst: string | null;
  staInternacionalExternoInst: string | null;
  tpoResumen: string | null;
  tpoEspecialista: string | null;
  txtAbstract: string | null;
  txtResumenOtro: string | null;
}

export type ArticleState = typeof ARTICLE_STATES[keyof typeof ARTICLE_STATES];

export type ExecutionMode =
  | 'upload'
  | 'import-ojs'
  | 'authors-upload'
  | 'reviewers-upload'
  | 'exit';

// UploadResult.successful/failed items keep `titulo` (Spanish) because it mirrors the `titulo` column of ArticleRow / the Excel template. Other fields of these internal result structs are in English.
export interface ValidationError {
  row: number;
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationWarning {
  message: string;
}

export interface ValidationResult {
  valid: ArticleRow[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface UploadResult {
  successful: { row: number; titulo: string }[];
  failed: { row: number; titulo: string; error: string }[];
  totalTimeMs: number;
}
