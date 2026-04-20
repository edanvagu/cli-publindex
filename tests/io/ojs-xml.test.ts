import { describe, it, expect } from 'vitest';
import { parsePublication, parseArticle, ojsArticleToRow, extractPublicationsXml, detectNonStandardPages, articlesToAuthorRows } from '../../src/io/ojs-xml';

const PUBLICATION_COMPLETO = `<publication locale="es_ES" version="1" status="3" date_published="2026-01-15" section_ref="Artículos" seq="1">
  <id type="internal" advice="ignore">2953</id>
  <id type="doi" advice="update">10.22380/20274688.3196</id>
  <title locale="es_ES">Título del artículo en español</title>
  <title locale="en_US">Title of the article in English</title>
  <title locale="pt_BR">Título do artigo em português</title>
  <abstract locale="es_ES">&lt;p&gt;Resumen en español con &lt;em&gt;formato&lt;/em&gt;.&lt;/p&gt;</abstract>
  <abstract locale="en_US">&lt;p&gt;Abstract in English.&lt;/p&gt;</abstract>
  <abstract locale="pt_BR">&lt;p&gt;Resumo em português.&lt;/p&gt;</abstract>
  <keywords locale="es_ES">
    <keyword>sociología</keyword>
    <keyword>cultura</keyword>
    <keyword>América Latina</keyword>
  </keywords>
  <keywords locale="en_US">
    <keyword>sociology</keyword>
    <keyword>culture</keyword>
  </keywords>
  <authors>
    <author seq="1" id="1">
      <givenname locale="es_ES">Carlos</givenname>
      <familyname locale="es_ES">Díaz</familyname>
    </author>
    <author seq="2" id="2">
      <givenname locale="es_ES">Constanza</givenname>
      <familyname locale="es_ES">Castro</familyname>
    </author>
  </authors>
  <citations>
    <citation>Referencia 1</citation>
    <citation>Referencia 2</citation>
    <citation>Referencia 3</citation>
  </citations>
  <pages>10-27</pages>
</publication>`;

const PUBLICATION_MINIMO = `<publication locale="es_ES" version="1" status="3">
  <title locale="es_ES">Solo título</title>
</publication>`;

const PUBLICATION_DOS_EN_ROOT = `<root>
  ${PUBLICATION_COMPLETO}
  ${PUBLICATION_MINIMO}
  <otraEtiqueta>ruido que debe ignorarse</otraEtiqueta>
</root>`;

describe('extractPublicationsXml', () => {
  it('extrae cada bloque <publication> como string independiente', () => {
    const blocks = extractPublicationsXml(PUBLICATION_DOS_EN_ROOT);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('<title locale="es_ES">Título del artículo en español</title>');
    expect(blocks[1]).toContain('<title locale="es_ES">Solo título</title>');
  });

  it('retorna arreglo vacío si no hay publications', () => {
    expect(extractPublicationsXml('<root><otro/></root>')).toEqual([]);
  });
});

describe('parsePublication', () => {
  it('extrae el título en locale primario', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.titulo).toBe('Título del artículo en español');
  });

  it('extrae el título en inglés', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.tituloIngles).toBe('Title of the article in English');
  });

  it('extrae el DOI en formato bare (10.xxxx/yyyy)', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.doi).toBe('10.22380/20274688.3196');
  });

  it('decodifica entities y tira tags HTML del resumen primario', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.resumen).toBe('Resumen en español con formato.');
  });

  it('extrae resumen en otro idioma y en tercer idioma', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.resumenOtroIdioma).toBe('Abstract in English.');
    expect(art.resumenIdiomaAdicional).toBe('Resumo em português.');
  });

  it('junta las keywords del locale primario con "; "', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.palabrasClave).toBe('sociología; cultura; América Latina');
  });

  it('junta las keywords del otro idioma con "; "', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.palabrasClaveOtroIdioma).toBe('sociology; culture');
  });

  it('cuenta los autores', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.numeroAutores).toBe(2);
  });

  it('cuenta las referencias en <citations>', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.numeroReferencias).toBe(3);
  });

  it('separa <pages>10-27</pages> en inicial=10 y final=27', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.paginaInicial).toBe('10');
    expect(art.paginaFinal).toBe('27');
  });

  it('mapea locale es_ES → idioma "Español"', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.idioma).toBe('Español');
  });

  it('infiere otro_idioma="Inglés" cuando hay abstract en en_US', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.otroIdioma).toBe('Inglés');
  });

  it('tolera publications con solo título (sin resumen, sin autores, sin referencias)', () => {
    const art = parsePublication(PUBLICATION_MINIMO);
    expect(art.titulo).toBe('Solo título');
    expect(art.resumen).toBeUndefined();
    expect(art.numeroAutores).toBeUndefined();
    expect(art.numeroReferencias).toBeUndefined();
    expect(art.paginaInicial).toBeUndefined();
  });

  it('deja páginas vacías si <pages> no tiene guion', () => {
    const xml = PUBLICATION_COMPLETO.replace('<pages>10-27</pages>', '<pages>sin-formato</pages>');
    const art = parsePublication(xml);
    expect(art.paginaInicial).toBeUndefined();
    expect(art.paginaFinal).toBeUndefined();
  });

  it('tolera guion tipográfico (en dash) en <pages>', () => {
    const xml = PUBLICATION_COMPLETO.replace('<pages>10-27</pages>', '<pages>10\u201327</pages>');
    const art = parsePublication(xml);
    expect(art.paginaInicial).toBe('10');
    expect(art.paginaFinal).toBe('27');
  });

  it('extrae fecha_publicacion del atributo date_published', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.fechaPublicacion).toBe('2026-01-15');
  });

  it('extrae submissionId del <id type="internal">', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.submissionId).toBe('2953');
  });

  it('deja submissionId undefined si no existe <id type="internal">', () => {
    const art = parsePublication(PUBLICATION_MINIMO);
    expect(art.submissionId).toBeUndefined();
  });

  it('preserva <pages> en paginasRaw cuando es un e-locator (publicación continua)', () => {
    const xml = PUBLICATION_COMPLETO.replace('<pages>10-27</pages>', '<pages>e1234</pages>');
    const art = parsePublication(xml);
    expect(art.paginaInicial).toBeUndefined();
    expect(art.paginaFinal).toBeUndefined();
    expect(art.paginasRaw).toBe('e1234');
  });

  it('preserva <pages> en paginasRaw cuando es un número suelto (página única)', () => {
    const xml = PUBLICATION_COMPLETO.replace('<pages>10-27</pages>', '<pages>15</pages>');
    const art = parsePublication(xml);
    expect(art.paginaInicial).toBeUndefined();
    expect(art.paginasRaw).toBe('15');
  });

  it('no marca paginasRaw cuando <pages> es un rango válido', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.paginasRaw).toBeUndefined();
  });

  it('no marca paginasRaw cuando <pages> está ausente', () => {
    const xml = PUBLICATION_COMPLETO.replace('<pages>10-27</pages>', '');
    const art = parsePublication(xml);
    expect(art.paginasRaw).toBeUndefined();
  });
});

describe('detectNonStandardPages', () => {
  it('retorna índices de artículos con paginasRaw presente', () => {
    const articles = [
      { titulo: 'A' },
      { titulo: 'B', paginasRaw: 'e1234' },
      { titulo: 'C', paginaInicial: '10', paginaFinal: '20' },
      { titulo: 'D', paginasRaw: '15' },
    ];
    expect(detectNonStandardPages(articles)).toEqual([
      { indice: 1, valor: 'e1234' },
      { indice: 3, valor: '15' },
    ]);
  });

  it('retorna arreglo vacío cuando todas las páginas son rangos válidos', () => {
    const articles = [
      { titulo: 'A', paginaInicial: '1', paginaFinal: '10' },
      { titulo: 'B' },
    ];
    expect(detectNonStandardPages(articles)).toEqual([]);
  });
});

describe('parseArticle', () => {
  const ARTICLE_CON_UNA_PUBLICATION = `<article locale="es_ES" date_submitted="2025-09-25" status="3" current_publication_id="2953" stage="production">
  <id type="internal" advice="ignore">3196</id>
  <id type="doi" advice="update">10.22380/20274688.3196</id>
  ${PUBLICATION_COMPLETO}
</article>`;

  const ARTICLE_CON_MULTIPLES = `<article locale="es_ES" current_publication_id="2953" stage="production">
  <id type="internal" advice="ignore">3196</id>
  <publication locale="es_ES" version="1">
    <id type="internal">2900</id>
    <title locale="es_ES">Versión vieja</title>
  </publication>
  ${PUBLICATION_COMPLETO}
</article>`;

  const ARTICLE_SIN_CURRENT = `<article locale="es_ES" stage="production">
  <id type="internal" advice="ignore">3196</id>
  ${PUBLICATION_COMPLETO}
</article>`;

  it('extrae submissionId del <article> (no del publication)', () => {
    const art = parseArticle(ARTICLE_CON_UNA_PUBLICATION);
    expect(art.submissionId).toBe('3196');
  });

  it('selecciona la publication que matchea current_publication_id cuando hay múltiples versiones', () => {
    const art = parseArticle(ARTICLE_CON_MULTIPLES);
    expect(art.submissionId).toBe('3196');
    expect(art.titulo).toBe('Título del artículo en español');
  });

  it('usa la única publication disponible cuando no hay current_publication_id', () => {
    const art = parseArticle(ARTICLE_SIN_CURRENT);
    expect(art.submissionId).toBe('3196');
    expect(art.titulo).toBe('Título del artículo en español');
  });

  it('lanza error cuando el article no tiene publication', () => {
    const xml = `<article locale="es_ES"><id type="internal">3196</id></article>`;
    expect(() => parseArticle(xml)).toThrow();
  });
});

describe('ojsArticleToRow', () => {
  it('mapea los campos auto-rellenables al shape ArticleRow', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    const row = ojsArticleToRow(art);

    expect(row.titulo).toBe('Título del artículo en español');
    expect(row.titulo_ingles).toBe('Title of the article in English');
    expect(row.doi).toBe('10.22380/20274688.3196');
    expect(row.resumen).toBe('Resumen en español con formato.');
    expect(row.resumen_otro_idioma).toBe('Abstract in English.');
    expect(row.resumen_idioma_adicional).toBe('Resumo em português.');
    expect(row.palabras_clave).toBe('sociología; cultura; América Latina');
    expect(row.palabras_clave_otro_idioma).toBe('sociology; culture');
    expect(row.numero_autores).toBe('2');
    expect(row.numero_referencias).toBe('3');
    expect(row.pagina_inicial).toBe('10');
    expect(row.pagina_final).toBe('27');
    expect(row.idioma).toBe('Español');
    expect(row.otro_idioma).toBe('Inglés');
  });

  it('deja vacíos los campos que OJS no provee (Minciencias, evaluación, tipos)', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    const row = ojsArticleToRow(art);

    expect(row.gran_area).toBeUndefined();
    expect(row.area).toBeUndefined();
    expect(row.subarea).toBeUndefined();
    expect(row.tipo_documento).toBeUndefined();
    expect(row.tipo_resumen).toBeUndefined();
    expect(row.tipo_especialista).toBeUndefined();
    expect(row.eval_interna).toBeUndefined();
    expect(row.eval_nacional).toBeUndefined();
    expect(row.eval_internacional).toBeUndefined();
    expect(row.numero_pares_evaluadores).toBeUndefined();
    expect(row.proyecto).toBeUndefined();
    expect(row.fecha_recepcion).toBeUndefined();
    expect(row.fecha_aceptacion).toBeUndefined();
  });
});

describe('extracción de autores desde OJS', () => {
  it('extrae nombres y marca nacionalidad Colombiana si country === CO', () => {
    const xml = `<publication locale="es_ES">
      <title locale="es_ES">T</title>
      <authors>
        <author>
          <givenname locale="es_ES">Ana</givenname>
          <familyname locale="es_ES">Pérez</familyname>
          <country>CO</country>
          <affiliation locale="es_ES">Universidad Ejemplo</affiliation>
        </author>
      </authors>
    </publication>`;
    const art = parsePublication(xml);
    expect(art.autores).toHaveLength(1);
    expect(art.autores[0].nombre_completo).toBe('Ana Pérez');
    expect(art.autores[0].nacionalidad).toBe('Colombiana');
    expect(art.autores[0].filiacion_institucional).toBe('Universidad Ejemplo');
  });

  it('marca Extranjera cuando country no es CO', () => {
    const xml = `<publication locale="es_ES">
      <title locale="es_ES">T</title>
      <authors>
        <author>
          <givenname locale="es_ES">John</givenname>
          <familyname locale="es_ES">Smith</familyname>
          <country>US</country>
        </author>
      </authors>
    </publication>`;
    const art = parsePublication(xml);
    expect(art.autores[0].nacionalidad).toBe('Extranjera');
  });

  it('marca Extranjera cuando no hay country', () => {
    const xml = `<publication locale="es_ES">
      <title locale="es_ES">T</title>
      <authors>
        <author>
          <givenname locale="es_ES">Ana</givenname>
          <familyname locale="es_ES">Smith</familyname>
        </author>
      </authors>
    </publication>`;
    const art = parsePublication(xml);
    expect(art.autores[0].nacionalidad).toBe('Extranjera');
  });

  it('extrae múltiples autores por artículo', () => {
    const art = parsePublication(PUBLICATION_COMPLETO);
    expect(art.autores).toHaveLength(2);
    expect(art.autores[0].nombre_completo).toBe('Carlos Díaz');
    expect(art.autores[1].nombre_completo).toBe('Constanza Castro');
  });

  it('articlesToAuthorRows genera una fila por autor con titulo_articulo', () => {
    const art1 = parsePublication(PUBLICATION_COMPLETO);
    const art2 = parsePublication(PUBLICATION_MINIMO);
    const rows = articlesToAuthorRows([art1, art2]);
    expect(rows).toHaveLength(2); // PUBLICATION_MINIMO no tiene authors
    expect(rows[0].titulo_articulo).toBe(art1.titulo);
    expect(rows[0].nombre_completo).toBe('Carlos Díaz');
    expect(rows[1].nombre_completo).toBe('Constanza Castro');
    expect(rows[1].titulo_articulo).toBe(art1.titulo);
  });
});
