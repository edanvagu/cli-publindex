import { parseDateToIso } from '../../utils/dates';
import { ArticlePayload, ArticleRow } from './types';

export function rowToPayload(row: ArticleRow, idFasciculo: number): ArticlePayload {
  return {
    idFasciculo,
    txtTituloArticulo: row.titulo,
    txtUrl: row.url,
    codGranArea: row.gran_area,
    codAreaConocimiento: row.area,
    tpoDocumento: row.tipo_documento,
    txtPalabraClave: row.palabras_clave,
    txtTituloParalelo: row.titulo_ingles,
    txtResumen: row.resumen,
    txtDoi: row.doi || null,
    nroPaginaInicial: row.pagina_inicial || null,
    nroPaginaFinal: row.pagina_final || null,
    nroAutores: row.numero_autores || null,
    nroParesEvaluo: row.numero_pares_evaluadores || null,
    txtProyecto: row.proyecto || null,
    codSubAreaConocimiento: row.subarea || null,
    nroReferencias: row.numero_referencias || null,
    txtPalabraClaveIdioma: row.palabras_clave_otro_idioma || null,
    dtaRecepcion: row.fecha_recepcion ? parseDateToIso(row.fecha_recepcion) : null,
    dtaVerifFechaAceptacion: row.fecha_aceptacion ? parseDateToIso(row.fecha_aceptacion) : null,
    codIdioma: row.idioma?.toUpperCase() || null,
    codIdiomaOtro: row.otro_idioma?.toUpperCase() || null,
    staInternoInstiTit: row.eval_interna?.toUpperCase() || null,
    staNacionalExternoInst: row.eval_nacional?.toUpperCase() || null,
    staInternacionalExternoInst: row.eval_internacional?.toUpperCase() || null,
    tpoResumen: row.tipo_resumen?.toUpperCase() || null,
    tpoEspecialista: row.tipo_especialista?.toUpperCase() || null,
    txtAbstract: row.resumen_otro_idioma || null,
    txtResumenOtro: row.resumen_idioma_adicional || null,
  };
}
