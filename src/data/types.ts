// === Respuesta del login ===
export interface LoginResponse {
  tablaUsuario: string;
  idUsuario: string;
  username: string | null;
  password: string | null;
  idRevista: number;
  nmeRevista: string;
  token: string;
  staActivo: string;
  rol: string;
  formatoRevista: string;
  enabled: boolean;
  authorities: { authority: string }[];
  accountNonExpired: boolean;
  credentialsNonExpired: boolean;
  accountNonLocked: boolean;
}

// === Fascículo ===
export interface Fasciculo {
  id: number;
  idRevista: number;
  idEditor: number | null;
  nroVolumen: string;
  nroNumero: string;
  dtaPublicacion: string;
  nroPaginaInicial: string | null;
  nroPaginaFinal: string | null;
  nroTiraje: string | null;
  txtTituloEspecial: string | null;
  nroArtRecibido: string | null;
  nroArtArbitrado: string | null;
  nroArtRechazado: string | null;
  revista: unknown | null;
  editor: unknown | null;
}

// === Payload del artículo (lo que envía el POST) ===
export interface ArticuloPayload {
  // Obligatorios
  idFasciculo: number;
  txtTituloArticulo: string;
  txtUrl: string;
  codGranArea: string;
  codAreaConocimiento: string;
  tpoDocumento: string;
  txtPalabraClave: string;
  txtTituloParalelo: string;
  txtResumen: string;

  // Opcionales
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

// === Fila cruda leída del Excel/CSV (antes de transformar) ===
export interface ArticuloRow {
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
  _fila: number;
}

// === Resultado de validación ===
export interface ValidationError {
  fila: number;
  campo: string;
  mensaje: string;
  sugerencia?: string;
}

export interface ValidationWarning {
  mensaje: string;
}

export interface ValidationResult {
  validos: ArticuloRow[];
  errores: ValidationError[];
  advertencias: ValidationWarning[];
}

// === Resultado de carga ===
export interface UploadResult {
  exitosos: { fila: number; titulo: string }[];
  fallidos: { fila: number; titulo: string; error: string }[];
  tiempoTotal: number;
}

// === Sesión activa ===
export interface Session {
  token: string;
  idRevista: number;
  nmeRevista: string;
  expiraEn: Date;
}
