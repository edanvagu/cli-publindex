import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchPersons, getTrayectoria, linkAuthor } from '../../../src/entities/authors/api';
import * as http from '../../../src/io/publindex-http';

vi.mock('../../../src/io/publindex-http', async (orig) => {
  const actual = await orig<typeof import('../../../src/io/publindex-http')>();
  return { ...actual, httpRequest: vi.fn() };
});

describe('authors API', () => {
  beforeEach(() => {
    vi.mocked(http.httpRequest).mockReset();
  });

  it('searchPersons hace POST a /personas/criterios con el body correcto', async () => {
    vi.mocked(http.httpRequest).mockResolvedValue({ status: 200, data: [{ codRh: '1' }] } as any);

    const res = await searchPersons('tok', {
      tpoNacionalidad: 'C',
      nroDocumentoIdent: '71772091',
      txtTotalNames: '',
    });

    expect(res).toEqual([{ codRh: '1' }]);
    expect(http.httpRequest).toHaveBeenCalledWith(
      expect.stringContaining('/personas/criterios'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tpoNacionalidad: 'C', nroDocumentoIdent: '71772091', txtTotalNames: '' }),
      }),
    );
  });

  it('searchPersons devuelve [] si el body no es array', async () => {
    vi.mocked(http.httpRequest).mockResolvedValue({ status: 200, data: null } as any);
    const res = await searchPersons('tok', { tpoNacionalidad: 'C', nroDocumentoIdent: '', txtTotalNames: '' });
    expect(res).toEqual([]);
  });

  it('searchPersons lanza error con mensaje en status != 2xx', async () => {
    vi.mocked(http.httpRequest).mockResolvedValue({ status: 500, data: { mensaje: 'DB error' } } as any);
    await expect(
      searchPersons('tok', { tpoNacionalidad: 'C', nroDocumentoIdent: '1', txtTotalNames: '' }),
    ).rejects.toThrow(/HTTP 500.*DB error/);
  });

  it('getTrayectoria construye la URL con codRh y año', async () => {
    vi.mocked(http.httpRequest).mockResolvedValue({ status: 200, data: { codRh: 'X' } } as any);
    await getTrayectoria('tok', '0000207039', 2025);
    expect(http.httpRequest).toHaveBeenCalledWith(
      expect.stringMatching(/\/personas\/0000207039\/2025\/trayectoriaProfesional$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('linkAuthor hace POST a /autores con el payload completo', async () => {
    vi.mocked(http.httpRequest).mockResolvedValue({ status: 200, data: '' } as any);
    await linkAuthor('tok', {
      codRh: '0000207039',
      idArticulo: 253026,
      anoFasciculo: 2025,
    } as any);
    expect(http.httpRequest).toHaveBeenCalledWith(
      expect.stringMatching(/\/autores$/),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"idArticulo":253026'),
      }),
    );
  });
});
