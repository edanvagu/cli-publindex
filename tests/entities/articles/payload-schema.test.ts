import { describe, it, expect } from 'vitest';
import { assertValidArticlePayload, articlePayloadSchema } from '../../../src/entities/articles/payload-schema';
import { ArticlePayload } from '../../../src/entities/articles/types';

function validPayload(overrides: Partial<ArticlePayload> = {}): ArticlePayload {
  return {
    idFasciculo: 100,
    txtTituloArticulo: 'Artículo de prueba con título suficientemente largo',
    txtUrl: 'https://example.com/articulo-prueba',
    codGranArea: '5',
    codAreaConocimiento: '5H',
    tpoDocumento: '1',
    txtPalabraClave: 'probe; validacion',
    txtTituloParalelo: 'Probe article parallel title long enough',
    txtResumen:
      'Resumen ficticio con longitud mínima suficiente para satisfacer las reglas del formulario y el schema defensivo.',
    txtDoi: null,
    nroPaginaInicial: null,
    nroPaginaFinal: null,
    nroAutores: null,
    nroParesEvaluo: null,
    txtProyecto: null,
    codSubAreaConocimiento: '5H03',
    nroReferencias: null,
    txtPalabraClaveIdioma: null,
    dtaRecepcion: null,
    dtaVerifFechaAceptacion: null,
    codIdioma: 'ES',
    codIdiomaOtro: null,
    staInternoInstiTit: 'F',
    staNacionalExternoInst: 'T',
    staInternacionalExternoInst: 'F',
    tpoResumen: 'A',
    tpoEspecialista: 'A',
    txtAbstract: null,
    txtResumenOtro: null,
    ...overrides,
  };
}

describe('articlePayloadSchema — caso feliz', () => {
  it('acepta un payload completo y válido', () => {
    expect(() => assertValidArticlePayload(validPayload())).not.toThrow();
  });

  it('acepta el payload sin subarea (null)', () => {
    expect(() => assertValidArticlePayload(validPayload({ codSubAreaConocimiento: null }))).not.toThrow();
  });

  it('trim de espacios en el título no rompe la validación', () => {
    const parsed = articlePayloadSchema.parse(
      validPayload({ txtTituloArticulo: '  Título normalizado por el schema  ' }),
    );
    expect(parsed.txtTituloArticulo).toBe('Título normalizado por el schema');
  });

  it('acepta fechas ISO con timezone (formato real del payload tras parseDateToIso)', () => {
    expect(() =>
      assertValidArticlePayload(
        validPayload({
          dtaRecepcion: '2024-05-01T05:00:00.000Z',
          dtaVerifFechaAceptacion: '2024-06-01T05:00:00.000Z',
        }),
      ),
    ).not.toThrow();
  });

  it('rechaza fechas con string no parseable', () => {
    expect(() => assertValidArticlePayload(validPayload({ dtaRecepcion: 'no es fecha' }))).toThrow(/dtaRecepcion/);
  });
});

describe('articlePayloadSchema — categoría 1: campos requeridos', () => {
  it('rechaza título vacío', () => {
    expect(() => assertValidArticlePayload(validPayload({ txtTituloArticulo: '' }))).toThrow(/txtTituloArticulo/);
  });

  it('rechaza título solo whitespace', () => {
    expect(() => assertValidArticlePayload(validPayload({ txtTituloArticulo: '     ' }))).toThrow(/txtTituloArticulo/);
  });

  it('rechaza url ausente', () => {
    const p = validPayload();
    delete (p as Partial<ArticlePayload>).txtUrl;
    expect(() => assertValidArticlePayload(p)).toThrow(/txtUrl/);
  });

  it('rechaza url sin protocolo', () => {
    expect(() => assertValidArticlePayload(validPayload({ txtUrl: 'example.com/x' }))).toThrow(/txtUrl/);
  });

  it('rechaza codGranArea ausente', () => {
    const p = validPayload();
    delete (p as Partial<ArticlePayload>).codGranArea;
    expect(() => assertValidArticlePayload(p)).toThrow(/codGranArea/);
  });

  it('rechaza codAreaConocimiento ausente', () => {
    const p = validPayload();
    delete (p as Partial<ArticlePayload>).codAreaConocimiento;
    expect(() => assertValidArticlePayload(p)).toThrow(/codAreaConocimiento/);
  });

  it('rechaza tpoDocumento ausente', () => {
    const p = validPayload();
    delete (p as Partial<ArticlePayload>).tpoDocumento;
    expect(() => assertValidArticlePayload(p)).toThrow(/tpoDocumento/);
  });

  it('rechaza palabras clave vacías para tpoDocumento=1', () => {
    expect(() => assertValidArticlePayload(validPayload({ txtPalabraClave: '' }))).toThrow(/txtPalabraClave/);
  });

  it('rechaza resumen vacío para tpoDocumento=1', () => {
    expect(() => assertValidArticlePayload(validPayload({ txtResumen: '' }))).toThrow(/txtResumen/);
  });

  it('rechaza titulo paralelo vacío para tpoDocumento=1', () => {
    expect(() => assertValidArticlePayload(validPayload({ txtTituloParalelo: '' }))).toThrow(/txtTituloParalelo/);
  });

  it('acepta resumen vacío para tpoDocumento=12 (no es requerido fuera de 1..6)', () => {
    expect(() =>
      assertValidArticlePayload(
        validPayload({ tpoDocumento: '12', txtResumen: '', txtPalabraClave: '', txtTituloParalelo: '' }),
      ),
    ).not.toThrow();
  });
});

describe('articlePayloadSchema — categoría 4: enums fuera de rango', () => {
  it('rechaza tpoDocumento desconocido', () => {
    expect(() => assertValidArticlePayload(validPayload({ tpoDocumento: '99' as never }))).toThrow(/tpoDocumento/);
  });

  it('rechaza tpoDocumento alfa', () => {
    expect(() => assertValidArticlePayload(validPayload({ tpoDocumento: 'abc' as never }))).toThrow(/tpoDocumento/);
  });

  it('rechaza codIdioma desconocido', () => {
    expect(() => assertValidArticlePayload(validPayload({ codIdioma: 'ZZ' as never }))).toThrow(/codIdioma/);
  });

  it('rechaza staInternoInstiTit no T/F', () => {
    expect(() => assertValidArticlePayload(validPayload({ staInternoInstiTit: 'true' as never }))).toThrow(
      /staInternoInstiTit/,
    );
  });

  it('rechaza tpoResumen desconocido', () => {
    expect(() => assertValidArticlePayload(validPayload({ tpoResumen: 'X' as never }))).toThrow(/tpoResumen/);
  });
});

describe('articlePayloadSchema — categoría 6: coerción de tipos', () => {
  it('rechaza nroPaginaInicial alfa', () => {
    expect(() => assertValidArticlePayload(validPayload({ nroPaginaInicial: 'abc' }))).toThrow(/nroPaginaInicial/);
  });

  it('rechaza idFasciculo string', () => {
    expect(() => assertValidArticlePayload(validPayload({ idFasciculo: 'quince' as never }))).toThrow(/idFasciculo/);
  });
});

describe('articlePayloadSchema — reglas cross-field', () => {
  it('rechaza area que no pertenece al gran area', () => {
    expect(() => assertValidArticlePayload(validPayload({ codGranArea: '5', codAreaConocimiento: '4A' }))).toThrow(
      /codAreaConocimiento/,
    );
  });

  it('rechaza subarea que no pertenece al area', () => {
    expect(() =>
      assertValidArticlePayload(validPayload({ codAreaConocimiento: '5H', codSubAreaConocimiento: '5A02' })),
    ).toThrow(/codSubAreaConocimiento/);
  });

  it('rechaza pagina_final <= pagina_inicial', () => {
    expect(() => assertValidArticlePayload(validPayload({ nroPaginaInicial: '10', nroPaginaFinal: '5' }))).toThrow(
      /nroPaginaFinal/,
    );
  });

  it('rechaza fecha_aceptacion antes de fecha_recepcion', () => {
    expect(() =>
      assertValidArticlePayload(validPayload({ dtaRecepcion: '2024-05-01', dtaVerifFechaAceptacion: '2024-04-01' })),
    ).toThrow(/dtaVerifFechaAceptacion/);
  });

  it('rechaza codIdioma == codIdiomaOtro', () => {
    expect(() => assertValidArticlePayload(validPayload({ codIdioma: 'ES', codIdiomaOtro: 'ES' }))).toThrow(
      /codIdiomaOtro/,
    );
  });
});

describe('articlePayloadSchema — defensa adicional', () => {
  it('rechaza claves extra desconocidas', () => {
    const p = { ...validPayload(), nuevaClaveQueNoExiste: 'algo' };
    expect(() => assertValidArticlePayload(p)).toThrow();
  });

  it('rechaza DOI con formato URL', () => {
    expect(() => assertValidArticlePayload(validPayload({ txtDoi: 'https://doi.org/10.1/abc' }))).toThrow(/txtDoi/);
  });

  it('rechaza idFasciculo negativo', () => {
    expect(() => assertValidArticlePayload(validPayload({ idFasciculo: -1 }))).toThrow(/idFasciculo/);
  });

  it('rechaza txtProyecto con menos de 10 caracteres', () => {
    expect(() => assertValidArticlePayload(validPayload({ txtProyecto: 'corto' }))).toThrow(/txtProyecto/);
  });

  it('acepta txtProyecto null o ≥ 10 caracteres', () => {
    expect(() => assertValidArticlePayload(validPayload({ txtProyecto: null }))).not.toThrow();
    expect(() =>
      assertValidArticlePayload(validPayload({ txtProyecto: 'Proyecto investigación ficticio' })),
    ).not.toThrow();
  });
});
