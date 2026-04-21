import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchPersons, getTrayectoria, linkAuthor } from '../../../src/entities/authors/api';
import * as http from '../../../src/io/publindex-http';
import type { Session } from '../../../src/entities/auth/types';

vi.mock('../../../src/io/publindex-http', async (orig) => {
  const actual = await orig<typeof import('../../../src/io/publindex-http')>();
  return { ...actual, authedRequest: vi.fn() };
});

function fakeSession(): Session {
  return {
    token: 'tok',
    idRevista: 1,
    nmeRevista: 'R',
    expiresAt: new Date(Date.now() + 3600 * 1000),
    cookies: {},
  };
}

describe('authors API', () => {
  beforeEach(() => {
    vi.mocked(http.authedRequest).mockReset();
  });

  it('searchPersons hace POST a /personas/criterios con el body correcto', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 200, data: [{ codRh: '1' }] } as any);

    const res = await searchPersons(fakeSession(), {
      tpoNacionalidad: 'C',
      nroDocumentoIdent: '99999999',
      txtTotalNames: '',
    });

    expect(res).toEqual([{ codRh: '1' }]);
    expect(http.authedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok' }),
      expect.stringContaining('/personas/criterios'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tpoNacionalidad: 'C', nroDocumentoIdent: '99999999', txtTotalNames: '' }),
      }),
    );
  });

  it('searchPersons devuelve [] si el body no es array', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 200, data: null } as any);
    const res = await searchPersons(fakeSession(), { tpoNacionalidad: 'C', nroDocumentoIdent: '', txtTotalNames: '' });
    expect(res).toEqual([]);
  });

  it('searchPersons lanza error con mensaje en status != 2xx', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 500, data: { mensaje: 'DB error' } } as any);
    await expect(
      searchPersons(fakeSession(), { tpoNacionalidad: 'C', nroDocumentoIdent: '1', txtTotalNames: '' }),
    ).rejects.toThrow(/HTTP 500.*DB error/);
  });

  it('getTrayectoria construye la URL con codRh y año', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 200, data: { codRh: 'X' } } as any);
    await getTrayectoria(fakeSession(), '0000000001', 2025);
    expect(http.authedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok' }),
      expect.stringMatching(/\/personas\/0000000001\/2025\/trayectoriaProfesional$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('linkAuthor hace POST a /autores con el payload completo', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 200, data: '' } as any);
    await linkAuthor(fakeSession(), {
      codRh: '0000000001',
      idArticulo: 253026,
      anoFasciculo: 2025,
    } as any);
    expect(http.authedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok' }),
      expect.stringMatching(/\/autores$/),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"idArticulo":253026'),
      }),
    );
  });
});
