import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runUpload } from '../../../src/entities/articles/uploader';
import { ArticleRow } from '../../../src/entities/articles/types';
import { Session } from '../../../src/entities/auth/types';
import * as api from '../../../src/entities/articles/api';
import { ProgressTracker } from '../../../src/io/progress';

vi.mock('../../../src/entities/articles/api');
vi.mock('../../../src/utils/async', () => ({
  sleep: () => Promise.resolve(),
}));
vi.mock('../../../src/utils/retry', () => ({
  withRetry: (fn: () => any) => fn(),
}));

function mockSession(): Session {
  return {
    token: 'x',
    idRevista: 1,
    nmeRevista: 'Revista Ficticia',
    expiresAt: new Date(Date.now() + 3600_000),
    cookies: {},
  };
}

function buildArticle(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    titulo: 'Título de Prueba',
    url: 'https://revistas.example.org/article/1',
    gran_area: 'Ciencias Sociales',
    area: 'Sociología',
    tipo_documento: 'Artículo de investigación científica y tecnológica',
    palabras_clave: 'palabra; clave',
    titulo_ingles: 'Test Title',
    resumen: 'Resumen ficticio largo',
    _fila: 2,
    ...overrides,
  };
}

function mockTracker() {
  return {
    update: vi.fn(),
    propagateArticleIdToAuthors: vi.fn(),
  } as unknown as ProgressTracker;
}

function buildOptions(extra: Partial<Parameters<typeof runUpload>[3]> = {}) {
  return {
    progressTracker: mockTracker(),
    onProgress: vi.fn(),
    onPause: vi.fn(),
    onRemainingTime: vi.fn(),
    onRetry: vi.fn(),
    onTokenExpiring: vi.fn(),
    onWarning: vi.fn(),
    onArticleCreated: vi.fn(),
    ...extra,
  } as any;
}

describe('runUpload — pre-check de artículos ya en el servidor', () => {
  beforeEach(() => {
    vi.mocked(api.createArticle).mockReset();
    vi.mocked(api.listArticlesByFasciculo).mockReset().mockResolvedValue([]);
  });

  it('salta un artículo cuyo título normalizado ya existe en el fascículo', async () => {
    vi.mocked(api.listArticlesByFasciculo).mockResolvedValue([
      { id: 999, txtTituloArticulo: 'TÍTULO  de prueba' }, // differing case, accents, spaces
    ]);

    const opts = buildOptions();
    const result = await runUpload(mockSession(), [buildArticle()], 37574, opts);

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(api.createArticle).not.toHaveBeenCalled();
    expect(opts.onArticleCreated).toHaveBeenCalledWith(expect.anything(), 999);
  });

  it('postea normalmente si no hay match', async () => {
    vi.mocked(api.listArticlesByFasciculo).mockResolvedValue([{ id: 100, txtTituloArticulo: 'Otro artículo' }]);
    vi.mocked(api.createArticle).mockResolvedValue(12345);

    const result = await runUpload(mockSession(), [buildArticle()], 37574, buildOptions());

    expect(result.successful).toHaveLength(1);
    expect(api.createArticle).toHaveBeenCalledTimes(1);
  });

  it('si el GET del pre-check falla, continúa sin pre-filtro', async () => {
    vi.mocked(api.listArticlesByFasciculo).mockRejectedValueOnce(new Error('HTTP 500'));
    vi.mocked(api.createArticle).mockResolvedValue(42);

    const opts = buildOptions();
    const result = await runUpload(mockSession(), [buildArticle()], 37574, opts);

    expect(result.successful).toHaveLength(1);
    expect(api.createArticle).toHaveBeenCalledTimes(1);
    expect(opts.onWarning).toHaveBeenCalledWith(expect.stringMatching(/No se pudo obtener/));
  });

  it('no duplica un artículo que acaba de ser posteado en la misma corrida', async () => {
    // Edge case: same title appears twice in the input (shouldn't really happen, but uploader must be idempotent).
    vi.mocked(api.listArticlesByFasciculo).mockResolvedValue([]);
    vi.mocked(api.createArticle).mockResolvedValueOnce(777);

    const result = await runUpload(
      mockSession(),
      [buildArticle({ _fila: 2 }), buildArticle({ _fila: 3 })],
      37574,
      buildOptions(),
    );

    expect(api.createArticle).toHaveBeenCalledTimes(1);
    expect(result.successful).toHaveLength(2);
  });
});
