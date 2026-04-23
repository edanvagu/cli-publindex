import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runReviewersUpload } from '../../../src/entities/reviewers/uploader';
import { ReviewerRow } from '../../../src/entities/reviewers/types';
import { PersonSearchResult } from '../../../src/entities/persons/types';
import { Session } from '../../../src/entities/auth/types';
import * as personsApi from '../../../src/entities/persons/api';
import * as reviewersApi from '../../../src/entities/reviewers/api';
import { ProgressTracker } from '../../../src/io/progress';

vi.mock('../../../src/entities/persons/api');
vi.mock('../../../src/entities/reviewers/api');

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

function buildReviewer(overrides: Partial<ReviewerRow> = {}): ReviewerRow {
  return {
    nombre_completo: 'Juan Prueba Uno',
    identificacion: '00000001',
    nacionalidad: 'Colombiana',
    _fila: 2,
    ...overrides,
  };
}

function mockTracker() {
  return { updateReviewer: vi.fn() } as unknown as ProgressTracker;
}

function buildOptions(extra: Partial<Parameters<typeof runReviewersUpload>[2]> = {}) {
  return {
    progressTracker: mockTracker(),
    idFasciculo: 37574,
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
  txtTotalNames: 'Juan Prueba Uno',
  staCertificado: 'T',
  nmePaisNacim: 'Colombia',
};

describe('runReviewersUpload', () => {
  beforeEach(() => {
    vi.mocked(personsApi.searchPersons).mockReset();
    vi.mocked(personsApi.getTrayectoria).mockReset();
    vi.mocked(reviewersApi.linkReviewer).mockReset();
    vi.mocked(reviewersApi.listReviewersByFasciculo).mockReset().mockResolvedValue([]);
  });

  it('vincula un evaluador encontrado por documento', async () => {
    vi.mocked(personsApi.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(personsApi.getTrayectoria).mockResolvedValueOnce({ ...PERSON, instituciones: ['Univ X'] });
    vi.mocked(reviewersApi.linkReviewer).mockResolvedValueOnce();

    const result = await runReviewersUpload(mockSession(), [buildReviewer()], buildOptions());

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(reviewersApi.linkReviewer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ codRh: '0000000001', idFasciculo: 37574, anoFasciculo: 2025 }),
    );
  });

  it('salta un evaluador ya vinculado al fascículo (pre-check por codRh)', async () => {
    vi.mocked(reviewersApi.listReviewersByFasciculo).mockResolvedValueOnce([PERSON]);
    vi.mocked(personsApi.searchPersons).mockResolvedValueOnce([PERSON]);

    const options = buildOptions();
    const result = await runReviewersUpload(mockSession(), [buildReviewer()], options);

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(reviewersApi.linkReviewer).not.toHaveBeenCalled();
    expect(personsApi.getTrayectoria).not.toHaveBeenCalled();
  });

  it('rechaza colombiano sin CvLAC', async () => {
    vi.mocked(personsApi.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(personsApi.getTrayectoria).mockResolvedValueOnce({ ...PERSON, staCertificado: 'F' });

    const result = await runReviewersUpload(mockSession(), [buildReviewer()], buildOptions());

    expect(result.successful).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe('Colombiano sin CvLAC');
    expect(reviewersApi.linkReviewer).not.toHaveBeenCalled();
  });

  it('cae a búsqueda por nombre + picker cuando la cédula no encuentra', async () => {
    vi.mocked(personsApi.searchPersons)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([PERSON]);
    vi.mocked(personsApi.getTrayectoria).mockResolvedValueOnce({ ...PERSON, instituciones: ['Univ X'] });
    vi.mocked(reviewersApi.linkReviewer).mockResolvedValueOnce();

    const picker = vi.fn().mockResolvedValueOnce(PERSON);
    const result = await runReviewersUpload(mockSession(), [buildReviewer()], buildOptions({ onPickPerson: picker }));

    expect(picker).toHaveBeenCalled();
    expect(result.successful).toHaveLength(1);
  });

  it('ronda 2: cruza nacionalidad para los NOT_FOUND de ronda 1', async () => {
    // Pass 1: search returns empty for both doc and name → NOT_FOUND
    // Pass 2: with flipped nationality, doc search finds the person
    vi.mocked(personsApi.searchPersons)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([PERSON]);
    vi.mocked(personsApi.getTrayectoria).mockResolvedValueOnce({ ...PERSON, instituciones: ['Univ X'] });
    vi.mocked(reviewersApi.linkReviewer).mockResolvedValueOnce();

    const reviewer = buildReviewer({ nacionalidad: 'Colombiana' });
    const result = await runReviewersUpload(mockSession(), [reviewer], buildOptions());

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    const calls = vi.mocked(personsApi.searchPersons).mock.calls;
    expect(calls[0][1].tpoNacionalidad).toBe('C');
    expect(calls[2][1].tpoNacionalidad).toBe('E');
  });

  it('si el pre-check GET falla, continúa sin bloquear el flujo', async () => {
    vi.mocked(reviewersApi.listReviewersByFasciculo).mockReset().mockRejectedValueOnce(new Error('HTTP 500'));
    vi.mocked(personsApi.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(personsApi.getTrayectoria).mockResolvedValueOnce({ ...PERSON });
    vi.mocked(reviewersApi.linkReviewer).mockResolvedValueOnce();

    const result = await runReviewersUpload(mockSession(), [buildReviewer()], buildOptions());

    expect(result.successful).toHaveLength(1);
    expect(reviewersApi.linkReviewer).toHaveBeenCalledTimes(1);
  });
});
