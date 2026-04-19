import { httpRequest, buildAuthHeaders } from './client';
import { ENDPOINTS } from '../config/constants';
import { ArticuloPayload, ArticuloRow } from '../data/types';
import { parseFechaToISO } from '../utils/fechas';

export async function crearArticulo(token: string, payload: ArticuloPayload): Promise<void> {
  const jsonStr = JSON.stringify(payload);

  // Construir multipart/form-data manualmente
  const boundary = '----PublindexCLI' + Date.now();
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="articulo"',
    '',
    jsonStr,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const response = await httpRequest(ENDPOINTS.ARTICULOS, {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(token),
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (response.status < 200 || response.status >= 300) {
    const msg = typeof response.data === 'string'
      ? response.data
      : (response.data as any)?.mensaje || (response.data as any)?.message || JSON.stringify(response.data);
    throw new Error(`HTTP ${response.status}: ${msg}`);
  }
}

export function rowToPayload(row: ArticuloRow, idFasciculo: number): ArticuloPayload {
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
    dtaRecepcion: row.fecha_recepcion ? parseFechaToISO(row.fecha_recepcion) : null,
    dtaVerifFechaAceptacion: row.fecha_aceptacion ? parseFechaToISO(row.fecha_aceptacion) : null,
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

