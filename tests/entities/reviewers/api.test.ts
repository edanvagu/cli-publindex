import { describe, it, expect, vi, beforeEach } from 'vitest';
import { linkReviewer, listReviewersByFasciculo } from '../../../src/entities/reviewers/api';
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

describe('reviewers API', () => {
  beforeEach(() => {
    vi.mocked(http.authedRequest).mockReset();
  });

  it('linkReviewer hace POST a /evaluadores con idFasciculo y anoFasciculo', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 200, data: '' } as any);
    await linkReviewer(fakeSession(), {
      codRh: '0000000002',
      idFasciculo: 37574,
      anoFasciculo: 2025,
    } as any);
    expect(http.authedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok' }),
      expect.stringMatching(/\/evaluadores$/),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"idFasciculo":37574'),
      }),
    );
  });

  it('linkReviewer lanza error con mensaje en status != 2xx', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 400, data: { mensaje: 'bad input' } } as any);
    await expect(
      linkReviewer(fakeSession(), { codRh: 'X', idFasciculo: 1, anoFasciculo: 2025 } as any),
    ).rejects.toThrow(/HTTP 400.*bad input/);
  });

  it('listReviewersByFasciculo hace GET a /evaluadores/fasciculos/{id}', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({
      status: 200,
      data: [{ codRh: '0000000003' }],
    } as any);
    const res = await listReviewersByFasciculo(fakeSession(), 37574);
    expect(res).toEqual([{ codRh: '0000000003' }]);
    expect(http.authedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok' }),
      expect.stringMatching(/\/evaluadores\/fasciculos\/37574$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listReviewersByFasciculo devuelve [] si el cuerpo no es array', async () => {
    vi.mocked(http.authedRequest).mockResolvedValue({ status: 200, data: null } as any);
    const res = await listReviewersByFasciculo(fakeSession(), 1);
    expect(res).toEqual([]);
  });
});
