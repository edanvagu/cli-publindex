import { describe, it, expect, vi, beforeEach } from 'vitest';
import { linkAuthor } from '../../../src/entities/authors/api';
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

  it('linkAuthor propaga errores con mensaje extraído de la respuesta', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 500, data: { message: 'boom' } } as any);
    await expect(linkAuthor(fakeSession(), { codRh: 'X', idArticulo: 1, anoFasciculo: 2025 } as any)).rejects.toThrow(
      /HTTP 500.*boom/,
    );
  });
});
