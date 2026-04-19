import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { ArticuloRow } from './types';
import { normalizeHeader } from './reader';

export function parseCsv(filePath: string): ArticuloRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rawRows: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  return rawRows
    .map((raw, index) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        normalized[normalizeHeader(key)] = (value ?? '').trim();
      }

      return {
        titulo: normalized['titulo'] || '',
        doi: normalized['doi'] || undefined,
        url: normalized['url'] || '',
        pagina_inicial: normalized['pagina_inicial'] || undefined,
        pagina_final: normalized['pagina_final'] || undefined,
        numero_autores: normalized['numero_autores'] || undefined,
        numero_pares_evaluadores: normalized['numero_pares_evaluadores'] || undefined,
        proyecto: normalized['proyecto'] || undefined,
        gran_area: normalized['gran_area'] || '',
        area: normalized['area'] || '',
        subarea: normalized['subarea'] || undefined,
        numero_referencias: normalized['numero_referencias'] || undefined,
        tipo_documento: normalized['tipo_documento'] || '',
        palabras_clave: normalized['palabras_clave'] || '',
        palabras_clave_otro_idioma: normalized['palabras_clave_otro_idioma'] || undefined,
        titulo_ingles: normalized['titulo_ingles'] || '',
        fecha_recepcion: normalized['fecha_recepcion'] || undefined,
        fecha_aceptacion: normalized['fecha_aceptacion'] || undefined,
        idioma: normalized['idioma'] || undefined,
        otro_idioma: normalized['otro_idioma'] || undefined,
        eval_interna: normalized['eval_interna'] || undefined,
        eval_nacional: normalized['eval_nacional'] || undefined,
        eval_internacional: normalized['eval_internacional'] || undefined,
        tipo_resumen: normalized['tipo_resumen'] || undefined,
        tipo_especialista: normalized['tipo_especialista'] || undefined,
        resumen: normalized['resumen'] || '',
        resumen_otro_idioma: normalized['resumen_otro_idioma'] || undefined,
        resumen_idioma_adicional: normalized['resumen_idioma_adicional'] || undefined,
        _fila: index + 2,
      } as ArticuloRow;
    })
    .filter(row => row.titulo || row.url || row.resumen);
}
