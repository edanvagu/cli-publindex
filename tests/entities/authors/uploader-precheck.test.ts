import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAuthorsUpload } from '../../../src/entities/authors/uploader';
import { AuthorRow, PersonSearchResult } from '../../../src/entities/authors/types';
import { Session } from '../../../src/entities/auth/types';
import * as api from '../../../src/entities/authors/api';
import { ProgressTracker } from '../../../src/io/progress';

vi.mock('../../../src/entities/authors/api');
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

function buildAuthor(overrides: Partial<AuthorRow> = {}): AuthorRow {
  return {
    titulo_articulo: 'Mi artículo',
    id_articulo: '253026',
    nombre_completo: 'Ana Prueba Uno',
    identificacion: '00000001',
    nacionalidad: 'Colombiana',
    _fila: 2,
    ...overrides,
  };
}

function mockTracker() {
  return { updateAuthor: vi.fn() } as unknown as ProgressTracker;
}

function buildOptions(extra: Partial<Parameters<typeof runAuthorsUpload>[2]> = {}) {
  return {
    progressTracker: mockTracker(),
    anoFasciculo: 2025,
    onProgress: vi.fn(),
    onPause: vi.fn(),
    onRetry: vi.fn(),
    onTokenExpiring: vi.fn(),
    onWarning: vi.fn(),
    onPickPerson: vi.fn().mockResolvedValue(null),
    ...extra,
  } as any;
}

const PERSON: PersonSearchResult = {
  codRh: '0000000001',
  nroDocumentoIdent: '00000001',
  txtTotalNames: 'Ana Prueba Uno',
  staCertificado: 'T',
  nmePaisNacim: 'Colombia',
};

describe('runAuthorsUpload — pre-check de autores ya vinculados al artículo', () => {
  beforeEach(() => {
    vi.mocked(api.searchPersons).mockReset();
    vi.mocked(api.getTrayectoria).mockReset();
    vi.mocked(api.linkAuthor).mockReset();
    vi.mocked(api.listAuthorsByArticle).mockReset().mockResolvedValue([]);
  });

  it('salta un autor ya vinculado al artículo (match por codRh)', async () => {
    vi.mocked(api.listAuthorsByArticle).mockResolvedValue([PERSON]);
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);

    const result = await runAuthorsUpload(mockSession(), [buildAuthor()], buildOptions());

    expect(result.successful).toHaveLength(1);
    expect(api.linkAuthor).not.toHaveBeenCalled();
    expect(api.getTrayectoria).not.toHaveBeenCalled();
  });

  it('no vuelve a pedir la lista del mismo idArticulo (cache)', async () => {
    vi.mocked(api.listAuthorsByArticle).mockResolvedValue([PERSON]);
    vi.mocked(api.searchPersons).mockResolvedValue([PERSON]);

    await runAuthorsUpload(
      mockSession(),
      [
        buildAuthor({ _fila: 2, nombre_completo: 'Autor Uno' }),
        buildAuthor({ _fila: 3, nombre_completo: 'Autor Dos' }),
      ],
      buildOptions(),
    );

    expect(api.listAuthorsByArticle).toHaveBeenCalledTimes(1);
  });

  it('fetches separately para artículos distintos', async () => {
    vi.mocked(api.listAuthorsByArticle).mockResolvedValue([]);
    vi.mocked(api.searchPersons).mockResolvedValue([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValue({ ...PERSON });
    vi.mocked(api.linkAuthor).mockResolvedValue();

    await runAuthorsUpload(
      mockSession(),
      [
        buildAuthor({ _fila: 2, id_articulo: '100' }),
        buildAuthor({ _fila: 3, id_articulo: '200' }),
      ],
      buildOptions(),
    );

    expect(api.listAuthorsByArticle).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.listAuthorsByArticle).mock.calls.map(c => c[1])).toEqual([100, 200]);
  });

  it('si el GET del pre-check falla, continúa sin pre-filtro para ese artículo', async () => {
    vi.mocked(api.listAuthorsByArticle).mockReset().mockRejectedValueOnce(new Error('HTTP 500'));
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce({ ...PERSON });
    vi.mocked(api.linkAuthor).mockResolvedValueOnce();

    const opts = buildOptions();
    const result = await runAuthorsUpload(mockSession(), [buildAuthor()], opts);

    expect(result.successful).toHaveLength(1);
    expect(api.linkAuthor).toHaveBeenCalledTimes(1);
    expect(opts.onWarning).toHaveBeenCalledWith(expect.stringMatching(/No se pudo obtener/));
  });
});
