import { describe, it, expect } from 'vitest';
import { rowToPayload } from '../../../src/entities/articles/mapper';
import { ArticleRow } from '../../../src/entities/articles/types';

function baseRow(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    titulo: 'Título del artículo',
    url: 'https://example.com/1',
    gran_area: '6',
    area: '6A',
    tipo_documento: '1',
    palabras_clave: 'historia; cultura',
    titulo_ingles: 'Article title',
    resumen: 'Resumen del artículo',
    _fila: 2,
    ...overrides,
  };
}

describe('rowToPayload - campos obligatorios', () => {
  it('mapea los campos obligatorios al payload', () => {
    const row = baseRow();
    const payload = rowToPayload(row, 38200);

    expect(payload.idFasciculo).toBe(38200);
    expect(payload.txtTituloArticulo).toBe('Título del artículo');
    expect(payload.txtUrl).toBe('https://example.com/1');
    expect(payload.codGranArea).toBe('6');
    expect(payload.codAreaConocimiento).toBe('6A');
    expect(payload.tpoDocumento).toBe('1');
    expect(payload.txtPalabraClave).toBe('historia; cultura');
    expect(payload.txtTituloParalelo).toBe('Article title');
    expect(payload.txtResumen).toBe('Resumen del artículo');
  });
});

describe('rowToPayload - campos opcionales', () => {
  it('convierte campos vacíos a null', () => {
    const row = baseRow();
    const payload = rowToPayload(row, 38200);

    expect(payload.txtDoi).toBeNull();
    expect(payload.nroPaginaInicial).toBeNull();
    expect(payload.nroPaginaFinal).toBeNull();
    expect(payload.txtProyecto).toBeNull();
    expect(payload.codSubAreaConocimiento).toBeNull();
    expect(payload.dtaRecepcion).toBeNull();
    expect(payload.dtaVerifFechaAceptacion).toBeNull();
  });

  it('mapea campos opcionales cuando están presentes', () => {
    const row = baseRow({
      doi: '10.1234/abc',
      pagina_inicial: '1',
      pagina_final: '15',
      numero_autores: '3',
      proyecto: 'Proyecto X',
      subarea: '6A01',
    });
    const payload = rowToPayload(row, 38200);

    expect(payload.txtDoi).toBe('10.1234/abc');
    expect(payload.nroPaginaInicial).toBe('1');
    expect(payload.nroPaginaFinal).toBe('15');
    expect(payload.nroAutores).toBe('3');
    expect(payload.txtProyecto).toBe('Proyecto X');
    expect(payload.codSubAreaConocimiento).toBe('6A01');
  });
});

describe('rowToPayload - normalización', () => {
  it('convierte idioma a mayúsculas', () => {
    const payload = rowToPayload(baseRow({ idioma: 'es', otro_idioma: 'en' }), 38200);
    expect(payload.codIdioma).toBe('ES');
    expect(payload.codIdiomaOtro).toBe('EN');
  });

  it('convierte eval_* a mayúsculas', () => {
    const payload = rowToPayload(baseRow({ eval_interna: 't', eval_nacional: 'f', eval_internacional: 'T' }), 38200);
    expect(payload.staInternoInstiTit).toBe('T');
    expect(payload.staNacionalExternoInst).toBe('F');
    expect(payload.staInternacionalExternoInst).toBe('T');
  });

  it('convierte tipo_resumen y tipo_especialista a mayúsculas', () => {
    const payload = rowToPayload(baseRow({ tipo_resumen: 'a', tipo_especialista: 's' }), 38200);
    expect(payload.tpoResumen).toBe('A');
    expect(payload.tpoEspecialista).toBe('S');
  });
});

describe('rowToPayload - conversión de fechas', () => {
  it('convierte YYYY-MM-DD a ISO 8601 con offset Colombia (UTC-5)', () => {
    const payload = rowToPayload(baseRow({ fecha_recepcion: '2026-04-15' }), 38200);
    expect(payload.dtaRecepcion).toBe('2026-04-15T05:00:00.000Z');
  });

  it('convierte DD/MM/YYYY a ISO 8601', () => {
    const payload = rowToPayload(baseRow({ fecha_aceptacion: '15/04/2026' }), 38200);
    expect(payload.dtaVerifFechaAceptacion).toBe('2026-04-15T05:00:00.000Z');
  });

  it('convierte DD-MM-YYYY a ISO 8601', () => {
    const payload = rowToPayload(baseRow({ fecha_recepcion: '15-04-2026' }), 38200);
    expect(payload.dtaRecepcion).toBe('2026-04-15T05:00:00.000Z');
  });

  it('mantiene la fecha tal cual si el formato no se puede parsear', () => {
    const payload = rowToPayload(baseRow({ fecha_recepcion: 'invalid' }), 38200);
    expect(payload.dtaRecepcion).toBe('invalid');
  });
});

describe('rowToPayload - textos opcionales', () => {
  it('mapea resumen_otro_idioma a txtAbstract', () => {
    const payload = rowToPayload(baseRow({ resumen_otro_idioma: 'Abstract' }), 38200);
    expect(payload.txtAbstract).toBe('Abstract');
  });

  it('mapea resumen_idioma_adicional a txtResumenOtro', () => {
    const payload = rowToPayload(baseRow({ resumen_idioma_adicional: 'Resumo' }), 38200);
    expect(payload.txtResumenOtro).toBe('Resumo');
  });

  it('mapea palabras_clave_otro_idioma a txtPalabraClaveIdioma', () => {
    const payload = rowToPayload(baseRow({ palabras_clave_otro_idioma: 'history; culture' }), 38200);
    expect(payload.txtPalabraClaveIdioma).toBe('history; culture');
  });
});

describe('rowToPayload - idFasciculo', () => {
  it('usa el idFasciculo proporcionado', () => {
    const payload = rowToPayload(baseRow(), 12345);
    expect(payload.idFasciculo).toBe(12345);
  });

  it('acepta cualquier número como idFasciculo', () => {
    const payload = rowToPayload(baseRow(), 999999);
    expect(payload.idFasciculo).toBe(999999);
  });
});
