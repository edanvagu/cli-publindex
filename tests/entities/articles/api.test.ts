import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createArticle } from '../../../src/entities/articles/api';
import { ArticlePayload } from '../../../src/entities/articles/types';
import * as http from '../../../src/io/publindex-http';
import type { Session } from '../../../src/entities/auth/types';

function fakeSession(): Session {
  return {
    token: 'tok',
    idRevista: 1,
    nmeRevista: 'R',
    expiresAt: new Date(Date.now() + 3600 * 1000),
    cookies: {},
  };
}

vi.mock('../../../src/io/publindex-http', async (orig) => {
  const actual = await orig<typeof import('../../../src/io/publindex-http')>();
  return { ...actual, authedRequest: vi.fn() };
});

const PAYLOAD: ArticlePayload = {
  idFasciculo: 100,
  txtTituloArticulo: 'Artículo de prueba con título suficientemente largo',
  txtUrl: 'https://example.com/articulo-prueba',
  codGranArea: '4',
  codAreaConocimiento: '4A',
  tpoDocumento: '1',
  txtPalabraClave: 'palabra1; palabra2',
  txtTituloParalelo: 'Test article with parallel title long enough',
  txtResumen:
    'Resumen ficticio del artículo de prueba con longitud suficiente para satisfacer los mínimos exigidos por el formulario.',
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
    vi.mocked(http.authedRequest).mockReset();
  });

  it('devuelve el entero del response body', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 200, data: '253026' } as any);
    const id = await createArticle(fakeSession(), PAYLOAD);
    expect(id).toBe(253026);
  });

  it('trim espacios del response', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 201, data: '  42\n' } as any);
    const id = await createArticle(fakeSession(), PAYLOAD);
    expect(id).toBe(42);
  });

  it('lanza si el body no es un entero', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 200, data: 'no-es-entero' } as any);
    await expect(createArticle(fakeSession(), PAYLOAD)).rejects.toThrow(/no es un entero/);
  });

  it('lanza con mensaje de error cuando status != 2xx', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 400, data: { mensaje: 'bad' } } as any);
    await expect(createArticle(fakeSession(), PAYLOAD)).rejects.toThrow(/HTTP 400.*bad/);
  });
});
