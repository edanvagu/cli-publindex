import { ArticuloRow, ValidationError, ValidationWarning, ValidationResult } from './types';
import { existeArea, areaPerteneceAGranArea, subareaPerteneceAArea, getNombreArea, getAreasDeGranArea, getSubareasDeArea } from './areas';
import { TIPOS_DOCUMENTO, TIPOS_RESUMEN, TIPOS_ESPECIALISTA, IDIOMAS } from '../config/constants';
import { parseFechaToDate } from '../utils/fechas';

export function validarLote(articulos: ArticuloRow[], headersDesconocidos: string[]): ValidationResult {
  const errores: ValidationError[] = [];
  const advertencias: ValidationWarning[] = [];

  if (articulos.length === 0) {
    errores.push({ fila: 0, campo: 'archivo', mensaje: 'El archivo no contiene artículos' });
    return { validos: [], errores, advertencias };
  }

  for (const h of headersDesconocidos) {
    const sugerencia = buscarHeaderSimilar(h);
    advertencias.push({
      mensaje: `Columna "${h}" no reconocida${sugerencia ? ` (¿quiso decir "${sugerencia}"?)` : ''}`,
    });
  }

  const tituloCount = new Map<string, number[]>();
  for (const art of articulos) {
    const key = art.titulo.toLowerCase().trim();
    if (key) {
      const filas = tituloCount.get(key) || [];
      filas.push(art._fila);
      tituloCount.set(key, filas);
    }
  }
  for (const [titulo, filas] of tituloCount) {
    if (filas.length > 1) {
      advertencias.push({
        mensaje: `Posible duplicado: filas ${filas.join(', ')} tienen el mismo título "${titulo.substring(0, 50)}..."`,
      });
    }
  }

  for (const art of articulos) {
    validarArticulo(art, errores);
  }

  const filasConError = new Set(errores.map(e => e.fila));
  const validos = articulos.filter(a => !filasConError.has(a._fila));

  return { validos, errores, advertencias };
}

function validarArticulo(art: ArticuloRow, errores: ValidationError[]) {
  const fila = art._fila;

  if (!art.titulo) {
    errores.push({ fila, campo: 'titulo', mensaje: 'Campo obligatorio' });
  } else if (art.titulo.length < 10) {
    errores.push({ fila, campo: 'titulo', mensaje: `"${art.titulo}" tiene ${art.titulo.length} caracteres (mínimo 10)` });
  }

  if (!art.url) {
    errores.push({ fila, campo: 'url', mensaje: 'Campo obligatorio' });
  } else if (!art.url.startsWith('http://') && !art.url.startsWith('https://')) {
    errores.push({ fila, campo: 'url', mensaje: `"${art.url}" debe comenzar con http:// o https://` });
  }

  if (!art.gran_area) {
    errores.push({ fila, campo: 'gran_area', mensaje: 'Campo obligatorio' });
  } else if (!existeArea(art.gran_area)) {
    errores.push({
      fila, campo: 'gran_area',
      mensaje: `Código "${art.gran_area}" no existe`,
      sugerencia: 'Valores válidos: 1 (Ciencias Naturales), 2 (Ingeniería y Tecnología), 3 (Ciencias Médicas), 4 (Ciencias Agrícolas), 5 (Ciencias Sociales), 6 (Humanidades)',
    });
  }

  if (!art.area) {
    errores.push({ fila, campo: 'area', mensaje: 'Campo obligatorio' });
  } else if (!existeArea(art.area)) {
    errores.push({ fila, campo: 'area', mensaje: `Código "${art.area}" no existe` });
  } else if (art.gran_area && existeArea(art.gran_area) && !areaPerteneceAGranArea(art.area, art.gran_area)) {
    const areasValidas = getAreasDeGranArea(art.gran_area);
    errores.push({
      fila, campo: 'area',
      mensaje: `"${art.area}" no pertenece a gran_area "${art.gran_area}" (${getNombreArea(art.gran_area)})`,
      sugerencia: `Áreas válidas: ${areasValidas.map(a => `${a.codigo} (${a.nombre})`).join(', ')}`,
    });
  }

  if (!art.tipo_documento) {
    errores.push({ fila, campo: 'tipo_documento', mensaje: 'Campo obligatorio' });
  } else if (!TIPOS_DOCUMENTO[art.tipo_documento]) {
    errores.push({
      fila, campo: 'tipo_documento',
      mensaje: `Valor "${art.tipo_documento}" no válido`,
      sugerencia: `Valores: ${Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    });
  }

  if (!art.palabras_clave) {
    errores.push({ fila, campo: 'palabras_clave', mensaje: 'Campo obligatorio' });
  }

  if (!art.titulo_ingles) {
    errores.push({ fila, campo: 'titulo_ingles', mensaje: 'Campo obligatorio' });
  } else if (art.titulo_ingles.length < 10) {
    errores.push({ fila, campo: 'titulo_ingles', mensaje: `"${art.titulo_ingles}" tiene ${art.titulo_ingles.length} caracteres (mínimo 10)` });
  }

  if (!art.resumen) {
    errores.push({ fila, campo: 'resumen', mensaje: 'Campo obligatorio' });
  } else if (art.resumen.length < 10) {
    errores.push({ fila, campo: 'resumen', mensaje: `Tiene ${art.resumen.length} caracteres (mínimo 10)` });
  }

  if (art.doi) {
    if (art.doi.length < 10) {
      errores.push({ fila, campo: 'doi', mensaje: `"${art.doi}" tiene ${art.doi.length} caracteres (mínimo 10)` });
    } else if (!/^10\.\S+\/\S+/.test(art.doi)) {
      errores.push({
        fila, campo: 'doi',
        mensaje: `"${art.doi}" no es un DOI válido. Debe empezar con "10." y tener el formato 10.xxxx/yyyy`,
        sugerencia: 'Ejemplo válido: 10.1234/abc123. NO use formato URL (https://doi.org/...).',
      });
    }
  }

  if (art.subarea) {
    if (!existeArea(art.subarea)) {
      errores.push({ fila, campo: 'subarea', mensaje: `Código "${art.subarea}" no existe` });
    } else if (art.area && existeArea(art.area) && !subareaPerteneceAArea(art.subarea, art.area)) {
      const subareasValidas = getSubareasDeArea(art.area);
      errores.push({
        fila, campo: 'subarea',
        mensaje: `"${art.subarea}" no pertenece a area "${art.area}" (${getNombreArea(art.area)})`,
        sugerencia: `Subáreas válidas: ${subareasValidas.map(a => `${a.codigo} (${a.nombre})`).join(', ')}`,
      });
    }
  }

  validarNumericoPositivo(art.pagina_inicial, 'pagina_inicial', fila, errores);
  validarNumericoPositivo(art.pagina_final, 'pagina_final', fila, errores);
  validarNumericoPositivo(art.numero_autores, 'numero_autores', fila, errores);
  validarNumericoPositivo(art.numero_pares_evaluadores, 'numero_pares_evaluadores', fila, errores);
  validarNumericoPositivo(art.numero_referencias, 'numero_referencias', fila, errores);

  if (art.pagina_inicial && art.pagina_final) {
    const ini = parseInt(art.pagina_inicial, 10);
    const fin = parseInt(art.pagina_final, 10);
    if (!isNaN(ini) && !isNaN(fin) && fin <= ini) {
      errores.push({ fila, campo: 'pagina_final', mensaje: `pagina_final (${fin}) debe ser mayor que pagina_inicial (${ini})` });
    }
  }

  validarFecha(art.fecha_recepcion, 'fecha_recepcion', fila, errores);
  validarFecha(art.fecha_aceptacion, 'fecha_aceptacion', fila, errores);

  if (art.fecha_recepcion && art.fecha_aceptacion) {
    const recep = parseFechaToDate(art.fecha_recepcion);
    const acep = parseFechaToDate(art.fecha_aceptacion);
    if (recep && acep && acep < recep) {
      errores.push({
        fila, campo: 'fecha_aceptacion',
        mensaje: `fecha_aceptacion (${art.fecha_aceptacion}) es anterior a fecha_recepcion (${art.fecha_recepcion})`,
      });
    }
  }

  if (art.idioma && !IDIOMAS[art.idioma.toUpperCase()]) {
    errores.push({
      fila, campo: 'idioma',
      mensaje: `"${art.idioma}" no válido`,
      sugerencia: `Valores: ${Object.keys(IDIOMAS).join(', ')}`,
    });
  }
  if (art.otro_idioma && !IDIOMAS[art.otro_idioma.toUpperCase()]) {
    errores.push({
      fila, campo: 'otro_idioma',
      mensaje: `"${art.otro_idioma}" no válido`,
      sugerencia: `Valores: ${Object.keys(IDIOMAS).join(', ')}`,
    });
  }
  if (art.idioma && art.otro_idioma && art.idioma.toUpperCase() === art.otro_idioma.toUpperCase()) {
    errores.push({ fila, campo: 'otro_idioma', mensaje: `No puede ser igual a idioma ("${art.idioma}")` });
  }

  validarTF(art.eval_interna, 'eval_interna', fila, errores);
  validarTF(art.eval_nacional, 'eval_nacional', fila, errores);
  validarTF(art.eval_internacional, 'eval_internacional', fila, errores);

  if (art.tipo_resumen && !TIPOS_RESUMEN[art.tipo_resumen.toUpperCase()]) {
    errores.push({
      fila, campo: 'tipo_resumen',
      mensaje: `"${art.tipo_resumen}" no válido`,
      sugerencia: `Valores: ${Object.entries(TIPOS_RESUMEN).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    });
  }
  if (art.tipo_especialista && !TIPOS_ESPECIALISTA[art.tipo_especialista.toUpperCase()]) {
    errores.push({
      fila, campo: 'tipo_especialista',
      mensaje: `"${art.tipo_especialista}" no válido`,
      sugerencia: `Valores: ${Object.entries(TIPOS_ESPECIALISTA).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    });
  }
}

function validarNumericoPositivo(valor: string | undefined, campo: string, fila: number, errores: ValidationError[]) {
  if (!valor) return;
  const num = parseInt(valor, 10);
  if (isNaN(num) || num < 0) {
    errores.push({ fila, campo, mensaje: `"${valor}" debe ser un número entero positivo` });
  }
}

function validarFecha(valor: string | undefined, campo: string, fila: number, errores: ValidationError[]) {
  if (!valor) return;
  if (!parseFechaToDate(valor)) {
    errores.push({ fila, campo, mensaje: `"${valor}" no es una fecha válida (formato esperado: YYYY-MM-DD)` });
  }
}

function validarTF(valor: string | undefined, campo: string, fila: number, errores: ValidationError[]) {
  if (!valor) return;
  if (valor.toUpperCase() !== 'T' && valor.toUpperCase() !== 'F') {
    errores.push({ fila, campo, mensaje: `"${valor}" no válido. Use T (Sí) o F (No)` });
  }
}

const HEADERS_CONOCIDOS = [
  'titulo', 'doi', 'url', 'pagina_inicial', 'pagina_final', 'numero_autores',
  'numero_pares_evaluadores', 'proyecto', 'gran_area', 'area', 'subarea',
  'numero_referencias', 'tipo_documento', 'palabras_clave', 'palabras_clave_otro_idioma',
  'titulo_ingles', 'fecha_recepcion', 'fecha_aceptacion', 'idioma', 'otro_idioma',
  'eval_interna', 'eval_nacional', 'eval_internacional', 'tipo_resumen',
  'tipo_especialista', 'resumen', 'resumen_otro_idioma', 'resumen_idioma_adicional',
];

function buscarHeaderSimilar(header: string): string | null {
  let mejor: string | null = null;
  let mejorDist = Infinity;

  for (const conocido of HEADERS_CONOCIDOS) {
    const dist = levenshtein(header, conocido);
    if (dist < mejorDist && dist <= 3) {
      mejorDist = dist;
      mejor = conocido;
    }
  }
  return mejor;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}
