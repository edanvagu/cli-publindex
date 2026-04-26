export const BASE_URL = 'https://scienti.minciencias.gov.co/publindex/api';

// Editor-facing SPA (what the extension opens in Chrome). Derived from BASE_URL by stripping the `/api` suffix so we can't drift out of sync.
export const PUBLINDEX_APP_URL = BASE_URL.replace(/\/api$/, '/');

export const ENDPOINTS = {
  LOGIN: `${BASE_URL}/autenticacion/autenticarEditor`,
  ISSUES: `${BASE_URL}/fasciculos`,
  ARTICLES: `${BASE_URL}/articulos`,
  PERSONS_SEARCH: `${BASE_URL}/personas/criterios`,
  AUTHORS: `${BASE_URL}/autores`,
  REVIEWERS: `${BASE_URL}/evaluadores`,
} as const;

export function buildTrayectoriaUrl(codRh: string, anoFasciculo: number | string): string {
  return `${BASE_URL}/personas/${codRh}/${anoFasciculo}/trayectoriaProfesional`;
}

export function buildReviewersByFasciculoUrl(idFasciculo: number | string): string {
  return `${BASE_URL}/evaluadores/fasciculos/${idFasciculo}`;
}

export function buildArticlesByFasciculoUrl(idFasciculo: number | string): string {
  return `${BASE_URL}/fasciculos/${idFasciculo}/articulos`;
}

export function buildAuthorsByArticleUrl(idArticulo: number | string): string {
  return `${BASE_URL}/autores/articulos/${idArticulo}`;
}

export const DEFAULTS = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 2000,
  RETRY_BACKOFF: 1.5,
  REQUEST_TIMEOUT_MS: 30000,
  TOKEN_REFRESH_MARGIN_MIN: 5,
  PAUSE_MIN_MS: 4000,
  PAUSE_MAX_MS: 9000,
  SUBCALL_PAUSE_MS: 500,
  AUTHOR_TARGET_SPACING_MS: 3000,
  AUTHOR_JITTER_MS: 2000,
  ESTIMATED_SECONDS_PER_ARTICLE: 15,
  ESTIMATED_SECONDS_PER_AUTHOR: 7,
  ESTIMATED_SECONDS_PER_REVIEWER: 7,
  PREFLIGHT_TOKEN_MARGIN_MS: 5 * 60 * 1000,
} as const;

export const STATE_COLUMNS = {
  STATE: 'estado',
  UPLOAD_DATE: 'fecha_subida',
  LAST_ERROR: 'ultimo_error',
} as const;

export const ARTICLE_STATES = {
  PENDING: 'pendiente',
  UPLOADED: 'subido',
  ERROR: 'error',
} as const;

export const AUTHOR_STATES = {
  PENDING: 'pendiente',
  UPLOADED: 'subido',
  ERROR: 'error',
} as const;

export const REVIEWER_STATES = {
  PENDING: 'pendiente',
  UPLOADED: 'subido',
  ERROR: 'error',
} as const;

export const NATIONALITIES: Record<string, string> = {
  C: 'Colombiana',
  E: 'Extranjera',
};

export const DOCUMENT_TYPES: Record<string, string> = {
  '1': 'Artículo de investigación científica y tecnológica',
  '2': 'Artículo de reflexión',
  '3': 'Artículo de revisión',
  '4': 'Artículo corto',
  '5': 'Reporte de caso',
  '6': 'Revisión de tema',
  '7': 'Cartas al editor',
  '8': 'Editorial',
  '9': 'Traducción',
  '10': 'Documento de reflexión no derivado de investigación',
  '11': 'Reseña bibliográfica',
  '12': 'Otros',
};

export const SUMMARY_TYPES: Record<string, string> = {
  A: 'Analítico',
  D: 'Descriptivo',
  S: 'Analítico sintético',
};

export const SPECIALIST_TYPES: Record<string, string> = {
  A: 'Autor',
  E: 'Editor',
  B: 'Bibliotecólogo',
  S: 'Especialista en el área',
};

export const LANGUAGES: Record<string, string> = {
  ES: 'Español',
  EN: 'Inglés',
  PT: 'Portugués',
  FR: 'Francés',
  DE: 'Alemán',
  IT: 'Italiano',
};

export const EXCEL_HEADERS = [
  'titulo',
  'doi',
  'url',
  'pagina_inicial',
  'pagina_final',
  'numero_autores',
  'numero_pares_evaluadores',
  'proyecto',
  'gran_area',
  'area',
  'subarea',
  'numero_referencias',
  'tipo_documento',
  'palabras_clave',
  'palabras_clave_otro_idioma',
  'titulo_ingles',
  'fecha_recepcion',
  'fecha_aceptacion',
  'idioma',
  'otro_idioma',
  'eval_interna',
  'eval_nacional',
  'eval_internacional',
  'tipo_resumen',
  'tipo_especialista',
  'resumen',
  'resumen_otro_idioma',
  'resumen_idioma_adicional',
] as const;

export const ARTICLE_ID_COLUMN = 'id_articulo';

export const AUTHORS_SHEET_NAME = 'Autores';
export const ARTICLES_SHEET_NAME = 'Artículos';
export const REVIEWERS_SHEET_NAME = 'Evaluadores';

export const AUTHOR_COLUMNS = {
  TITULO_ARTICULO: 'titulo_articulo',
  ID_ARTICULO: 'id_articulo',
  NOMBRE: 'nombre_completo',
  IDENTIFICACION: 'identificacion',
  NACIONALIDAD: 'nacionalidad',
  FILIACION: 'filiacion_institucional',
  TIENE_CVLAC: 'tiene_cvlac',
  ESTADO_CARGA: 'estado_carga',
  ACCION_REQUERIDA: 'accion_requerida',
} as const;

export const AUTHORS_SHEET_HEADERS = [
  AUTHOR_COLUMNS.TITULO_ARTICULO,
  AUTHOR_COLUMNS.ID_ARTICULO,
  AUTHOR_COLUMNS.NOMBRE,
  AUTHOR_COLUMNS.IDENTIFICACION,
  AUTHOR_COLUMNS.NACIONALIDAD,
  AUTHOR_COLUMNS.FILIACION,
  AUTHOR_COLUMNS.TIENE_CVLAC,
  AUTHOR_COLUMNS.ESTADO_CARGA,
  AUTHOR_COLUMNS.ACCION_REQUERIDA,
] as const;

export const REVIEWER_COLUMNS = {
  NOMBRE: 'nombre_completo',
  IDENTIFICACION: 'identificacion',
  NACIONALIDAD: 'nacionalidad',
  FILIACION: 'filiacion_institucional',
  TIENE_CVLAC: 'tiene_cvlac',
  ESTADO_CARGA: 'estado_carga',
  ACCION_REQUERIDA: 'accion_requerida',
} as const;

export const REVIEWERS_SHEET_HEADERS = [
  REVIEWER_COLUMNS.NOMBRE,
  REVIEWER_COLUMNS.IDENTIFICACION,
  REVIEWER_COLUMNS.NACIONALIDAD,
  REVIEWER_COLUMNS.FILIACION,
  REVIEWER_COLUMNS.TIENE_CVLAC,
  REVIEWER_COLUMNS.ESTADO_CARGA,
  REVIEWER_COLUMNS.ACCION_REQUERIDA,
] as const;
