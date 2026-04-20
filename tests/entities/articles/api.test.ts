import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createArticle } from '../../../src/entities/articles/api';
import { ArticlePayload } from '../../../src/entities/articles/types';
import * as http from '../../../src/io/publindex-http';

vi.mock('../../../src/io/publindex-http', async (orig) => {
  const actual = await orig<typeof import('../../../src/io/publindex-http')>();
  return { ...actual, httpRequest: vi.fn() };
});

const PAYLOAD: ArticlePayload = {
  idFasciculo: 100,
  txtTituloArticulo: 'Test',
  txtUrl: 'https://x/1',
  codGranArea: '4',
  codAreaConocimiento: '4A',
  tpoDocumento: '1',
  txtPalabraClave: 'k',
  txtTituloParalelo: 't',
  txtResumen: 'r',
  txtDoi: null,
  nroPaginaInicial: null,
  nroPaginaFinal: null,
  nroAutores: null,
  nroParesEvaluo: null,
  txtProyecto: null,
  codSubAreaConocimiento: null,
  nroReferencias: null,
  txtPalabraClaveIdioma: null,
  dtaRecepcion: null,
  dtaVerifFechaAceptacion: null,
  codIdioma: null,
  codIdiomaOtro: null,
  staInternoInstiTit: null,
  staNacionalExternoInst: null,
  staInternacionalExternoInst: null,
  tpoResumen: null,
  tpoEspecialista: null,
  txtAbstract: null,
  txtResumenOtro: null,
};

describe('createArticle', () => {
  beforeEach(() => {
    vi.mocked(http.httpRequest).mockReset();
  });

  it('devuelve el entero del response body', async () => {
    vi.mocked(http.httpRequest).mockResolvedValue({ status: 200, data: '253026' } as any);
    const id = await createArticle('tok', PAYLOAD);
    expect(id).toBe(253026);
  });

  it('trim espacios del response', async () => {
    vi.mocked(http.httpRequest).mockResolvedValue({ status: 201, data: '  42\n' } as any);
    const id = await createArticle('tok', PAYLOAD);
    expect(id).toBe(42);
  });

  it('lanza si el body no es un entero', async () => {
    vi.mocked(http.httpRequest).mockResolvedValue({ status: 200, data: 'no-es-entero' } as any);
    await expect(createArticle('tok', PAYLOAD)).rejects.toThrow(/no es un entero/);
  });

  it('lanza con mensaje de error cuando status != 2xx', async () => {
    vi.mocked(http.httpRequest).mockResolvedValue({ status: 400, data: { mensaje: 'bad' } } as any);
    await expect(createArticle('tok', PAYLOAD)).rejects.toThrow(/HTTP 400.*bad/);
  });
});
