import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAuthorsUpload } from '../../../src/entities/authors/uploader';
import { AuthorRow, PersonSearchResult } from '../../../src/entities/authors/types';
import { Session } from '../../../src/entities/auth/types';
import * as api from '../../../src/entities/authors/api';
import { ProgressTracker } from '../../../src/io/progress';

vi.mock('../../../src/entities/authors/api');

// Pausas y retries — neutralizar para que los tests corran rápido.
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
    nmeRevista: 'Revista Test',
    expiresAt: new Date(Date.now() + 3600_000),
  };
}

function buildAuthor(overrides: Partial<AuthorRow> = {}): AuthorRow {
  return {
    titulo_articulo: 'Mi artículo',
    id_articulo: '253026',
    nombre_completo: 'Pablo Rodríguez',
    identificacion: '71772091',
    nacionalidad: 'Colombiana',
    _fila: 2,
    ...overrides,
  };
}

function mockTracker() {
  const tracker = { actualizarAutor: vi.fn() };
  return tracker as unknown as ProgressTracker;
}

function buildOptions(extra: Partial<Parameters<typeof runAuthorsUpload>[2]> = {}) {
  return {
    progressTracker: mockTracker(),
    anoFasciculo: 2025,
    onProgress: vi.fn(),
    onPause: vi.fn(),
    onRemainingTime: vi.fn(),
    onRetry: vi.fn(),
    onTokenExpiring: vi.fn(),
    onWarning: vi.fn(),
    onPickPerson: vi.fn().mockResolvedValue(null),
    ...extra,
  } as any;
}

const PERSON: PersonSearchResult = {
  codRh: '0000207039',
  nroDocumentoIdent: '71772091',
  txtTotalNames: 'Pablo Rodríguez Cumplido',
  staCertificado: 'T',
  nmePaisNacim: 'Colombia',
};

describe('runAuthorsUpload', () => {
  beforeEach(() => {
    vi.mocked(api.searchPersons).mockReset();
    vi.mocked(api.getTrayectoria).mockReset();
    vi.mocked(api.linkAuthor).mockReset();
  });

  it('matchea por documento y vincula al artículo', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce({ ...PERSON, staCertificado: 'T' });
    vi.mocked(api.linkAuthor).mockResolvedValueOnce();

    const options = buildOptions();
    const result = await runAuthorsUpload(mockSession(), [buildAuthor()], options);

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(api.searchPersons).toHaveBeenCalledWith('x', expect.objectContaining({
      tpoNacionalidad: 'C',
      nroDocumentoIdent: '71772091',
    }));
    expect(api.linkAuthor).toHaveBeenCalledWith('x', expect.objectContaining({
      codRh: '0000207039',
      idArticulo: 253026,
      anoFasciculo: 2025,
    }));
    expect(options.progressTracker.actualizarAutor).toHaveBeenCalledWith(
      expect.objectContaining({ estadoCarga: 'subido', tieneCvlac: 'Sí' }),
      expect.any(Function),
    );
  });

  it('si no matchea por documento, pide al usuario escoger de la lista de nombre', async () => {
    const candidato = { ...PERSON, codRh: 'OTHER', nroDocumentoIdent: '99' };
    vi.mocked(api.searchPersons)
      .mockResolvedValueOnce([])               // búsqueda por doc: vacía
      .mockResolvedValueOnce([candidato]);     // búsqueda por nombre: 1 resultado
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce(candidato);
    vi.mocked(api.linkAuthor).mockResolvedValueOnce();

    const onPickPerson = vi.fn().mockResolvedValue(candidato);
    const options = buildOptions({ onPickPerson });

    const result = await runAuthorsUpload(mockSession(), [buildAuthor()], options);

    expect(onPickPerson).toHaveBeenCalled();
    expect(result.successful).toHaveLength(1);
    expect(api.linkAuthor).toHaveBeenCalledWith('x', expect.objectContaining({ codRh: 'OTHER' }));
  });

  it('marca error si el usuario escoge "Ninguno" en el picker', async () => {
    vi.mocked(api.searchPersons)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([PERSON]);

    const onPickPerson = vi.fn().mockResolvedValue(null);
    const options = buildOptions({ onPickPerson });

    const result = await runAuthorsUpload(mockSession(), [buildAuthor()], options);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe('No encontrado en Publindex');
    expect(api.linkAuthor).not.toHaveBeenCalled();
    expect(options.progressTracker.actualizarAutor).toHaveBeenCalledWith(
      expect.objectContaining({
        estadoCarga: 'error:No encontrado en Publindex',
        accionRequerida: 'Registrar autor manualmente en Publindex',
      }),
      expect.any(Function),
    );
  });

  it('marca error si ambas búsquedas devuelven 0 resultados', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const options = buildOptions();
    const result = await runAuthorsUpload(mockSession(), [buildAuthor()], options);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe('No encontrado en Publindex');
    expect(api.linkAuthor).not.toHaveBeenCalled();
  });

  it('extranjero: manda tpoNacionalidad="E" en la búsqueda', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce(PERSON);
    vi.mocked(api.linkAuthor).mockResolvedValueOnce();

    const options = buildOptions();
    await runAuthorsUpload(
      mockSession(),
      [buildAuthor({ nacionalidad: 'Extranjera' })],
      options,
    );

    expect(api.searchPersons).toHaveBeenCalledWith('x', expect.objectContaining({
      tpoNacionalidad: 'E',
    }));
  });

  it('marca tiene_cvlac="No" cuando staCertificado no es "T"', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce({ ...PERSON, staCertificado: 'F' });
    vi.mocked(api.linkAuthor).mockResolvedValueOnce();

    const options = buildOptions();
    await runAuthorsUpload(mockSession(), [buildAuthor()], options);

    expect(options.progressTracker.actualizarAutor).toHaveBeenCalledWith(
      expect.objectContaining({ tieneCvlac: 'No' }),
      expect.any(Function),
    );
  });

  it('bloquea vinculación si colombiano no tiene CvLAC (staCertificado != T)', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce({ ...PERSON, staCertificado: 'F' });

    const options = buildOptions();
    const result = await runAuthorsUpload(
      mockSession(),
      [buildAuthor({ nacionalidad: 'Colombiana' })],
      options,
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe('Colombiano sin CvLAC');
    expect(api.linkAuthor).not.toHaveBeenCalled();
    expect(options.progressTracker.actualizarAutor).toHaveBeenCalledWith(
      expect.objectContaining({
        estadoCarga: 'error:Colombiano sin CvLAC',
        tieneCvlac: 'No',
        accionRequerida: expect.stringContaining('CvLAC'),
      }),
      expect.any(Function),
    );
  });

  it('al linkear con filiación vigente (instituciones no vacía), limpia accion_requerida', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce({
      ...PERSON,
      staCertificado: 'T',
      instituciones: ['UNIVERSIDAD DE MEDELLIN'],
    });
    vi.mocked(api.linkAuthor).mockResolvedValueOnce();

    const options = buildOptions();
    await runAuthorsUpload(mockSession(), [buildAuthor()], options);

    expect(options.progressTracker.actualizarAutor).toHaveBeenCalledWith(
      expect.objectContaining({
        estadoCarga: 'subido',
        accionRequerida: '',
      }),
      expect.any(Function),
    );
  });

  it('al linkear SIN filiación vigente (instituciones vacía), avisa endogamia en accion_requerida', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce({
      ...PERSON,
      staCertificado: 'T',
      instituciones: [],
    });
    vi.mocked(api.linkAuthor).mockResolvedValueOnce();

    const options = buildOptions();
    await runAuthorsUpload(mockSession(), [buildAuthor()], options);

    expect(options.progressTracker.actualizarAutor).toHaveBeenCalledWith(
      expect.objectContaining({
        estadoCarga: 'subido',
        accionRequerida: expect.stringMatching(/filiaci[oó]n (interna|vigente)/i),
      }),
      expect.any(Function),
    );
    expect(options.onWarning).toHaveBeenCalledWith(expect.stringMatching(/filiaci[oó]n (interna|vigente)/i));
  });

  it('al linkear con instituciones null/undefined, mismo aviso de endogamia', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce({
      ...PERSON,
      staCertificado: 'T',
      instituciones: null,
    });
    vi.mocked(api.linkAuthor).mockResolvedValueOnce();

    const options = buildOptions();
    await runAuthorsUpload(mockSession(), [buildAuthor()], options);

    expect(options.progressTracker.actualizarAutor).toHaveBeenCalledWith(
      expect.objectContaining({ accionRequerida: expect.stringMatching(/filiaci[oó]n (interna|vigente)/i) }),
      expect.any(Function),
    );
  });

  it('SÍ permite vincular extranjero sin CvLAC', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockResolvedValueOnce({ ...PERSON, staCertificado: 'F' });
    vi.mocked(api.linkAuthor).mockResolvedValueOnce();

    const options = buildOptions();
    const result = await runAuthorsUpload(
      mockSession(),
      [buildAuthor({ nacionalidad: 'Extranjera' })],
      options,
    );

    expect(result.successful).toHaveLength(1);
    expect(api.linkAuthor).toHaveBeenCalled();
  });

  it('propaga errores de API como error row con accion_requerida', async () => {
    vi.mocked(api.searchPersons).mockResolvedValueOnce([PERSON]);
    vi.mocked(api.getTrayectoria).mockRejectedValueOnce(new Error('HTTP 500'));

    const options = buildOptions();
    const result = await runAuthorsUpload(mockSession(), [buildAuthor()], options);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain('HTTP 500');
    expect(options.progressTracker.actualizarAutor).toHaveBeenCalledWith(
      expect.objectContaining({ accionRequerida: 'Revisar error y reintentar' }),
      expect.any(Function),
    );
  });
});
