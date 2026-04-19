import { parseDateToIso } from '../../utils/dates';
import { DOCUMENT_TYPES, SUMMARY_TYPES, SPECIALIST_TYPES, LANGUAGES } from '../../config/constants';
import { getGranAreaCodeByName, getAreaCodeByName, getSubareaCodeByName } from '../areas/tree';
import { ArticlePayload, ArticleRow } from './types';

// El Excel almacena LABELS (lo que el editor ve en los dropdowns). Publindex espera
// CÓDIGOS. Estas funciones hacen la traducción al construir el payload.

function codeForLabel(label: string | undefined, dict: Record<string, string>): string | undefined {
  if (!label) return undefined;
  const match = Object.entries(dict).find(([, v]) => v === label);
  return match?.[0];
}

export function rowToPayload(row: ArticleRow, idFasciculo: number): ArticlePayload {
  const granAreaCode = getGranAreaCodeByName(row.gran_area) ?? row.gran_area;
  const areaCode = getAreaCodeByName(row.area, granAreaCode) ?? row.area;
  const subareaCode = row.subarea
    ? (getSubareaCodeByName(row.subarea, areaCode) ?? row.subarea)
    : null;

  return {
    idFasciculo,
    txtTituloArticulo: row.titulo,
    txtUrl: row.url,
    codGranArea: granAreaCode,
    codAreaConocimiento: areaCode,
    tpoDocumento: codeForLabel(row.tipo_documento, DOCUMENT_TYPES) ?? row.tipo_documento,
    txtPalabraClave: row.palabras_clave,
    txtTituloParalelo: row.titulo_ingles,
    txtResumen: row.resumen,
    txtDoi: row.doi || null,
    nroPaginaInicial: row.pagina_inicial || null,
    nroPaginaFinal: row.pagina_final || null,
    nroAutores: row.numero_autores || null,
    nroParesEvaluo: row.numero_pares_evaluadores || null,
    txtProyecto: row.proyecto || null,
    codSubAreaConocimiento: subareaCode,
    nroReferencias: row.numero_referencias || null,
    txtPalabraClaveIdioma: row.palabras_clave_otro_idioma || null,
    dtaRecepcion: row.fecha_recepcion ? parseDateToIso(row.fecha_recepcion) : null,
    dtaVerifFechaAceptacion: row.fecha_aceptacion ? parseDateToIso(row.fecha_aceptacion) : null,
    codIdioma: codeForLabel(row.idioma, LANGUAGES) ?? row.idioma?.toUpperCase() ?? null,
    codIdiomaOtro: codeForLabel(row.otro_idioma, LANGUAGES) ?? row.otro_idioma?.toUpperCase() ?? null,
    staInternoInstiTit: row.eval_interna?.toUpperCase() || null,
    staNacionalExternoInst: row.eval_nacional?.toUpperCase() || null,
    staInternacionalExternoInst: row.eval_internacional?.toUpperCase() || null,
    tpoResumen: codeForLabel(row.tipo_resumen, SUMMARY_TYPES) ?? row.tipo_resumen?.toUpperCase() ?? null,
    tpoEspecialista: codeForLabel(row.tipo_especialista, SPECIALIST_TYPES) ?? row.tipo_especialista?.toUpperCase() ?? null,
    txtAbstract: row.resumen_otro_idioma || null,
    txtResumenOtro: row.resumen_idioma_adicional || null,
  };
}
