export const BASE_URL = 'https://scienti.minciencias.gov.co/publindex/api';

export const ENDPOINTS = {
  LOGIN: `${BASE_URL}/autenticacion/autenticarEditor`,
  FASCICULOS: `${BASE_URL}/fasciculos`,
  ARTICULOS: `${BASE_URL}/articulos`,
} as const;

export const DEFAULTS = {
  CONCURRENCY: 1,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 2000,
  RETRY_BACKOFF: 1.5,
  REQUEST_TIMEOUT_MS: 30000,
  TOKEN_REFRESH_MARGIN_MIN: 5,
} as const;

export const TIPOS_DOCUMENTO: Record<string, string> = {
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

export const TIPOS_RESUMEN: Record<string, string> = {
  'A': 'Analítico',
  'D': 'Descriptivo',
  'S': 'Analítico sintético',
};

export const TIPOS_ESPECIALISTA: Record<string, string> = {
  'A': 'Autor',
  'E': 'Editor',
  'B': 'Bibliotecólogo',
  'S': 'Especialista en el área',
};

export const IDIOMAS: Record<string, string> = {
  'ES': 'Español',
  'EN': 'Inglés',
  'PT': 'Portugués',
  'FR': 'Francés',
  'DE': 'Alemán',
  'IT': 'Italiano',
};

export const HEADERS_EXCEL = [
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
