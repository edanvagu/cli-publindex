import { describe, it, expect } from 'vitest';
import { assertValidLinkReviewerPayload } from '../../../src/entities/reviewers/payload-schema';
import type { LinkReviewerPayload } from '../../../src/entities/reviewers/types';

function validPayload(overrides: Partial<LinkReviewerPayload> = {}): LinkReviewerPayload {
  return {
    codRh: 'COD-FICTICIO-0001',
    idFasciculo: 9999,
    anoFasciculo: 2026,
    tpoNacionalidad: 'C',
    txtTotalNames: 'Evaluador Probe Ficticio',
    ...overrides,
  } as LinkReviewerPayload;
}

describe('linkReviewerPayloadSchema', () => {
  it('acepta payload válido', () => {
    expect(() => assertValidLinkReviewerPayload(validPayload())).not.toThrow();
  });

  it('acepta tpoNacionalidad null o ausente', () => {
    expect(() => assertValidLinkReviewerPayload(validPayload({ tpoNacionalidad: null }))).not.toThrow();
    const p = validPayload();
    delete (p as Partial<LinkReviewerPayload>).tpoNacionalidad;
    expect(() => assertValidLinkReviewerPayload(p)).not.toThrow();
  });

  it('rechaza codRh vacío', () => {
    expect(() => assertValidLinkReviewerPayload(validPayload({ codRh: '' }))).toThrow(/codRh/);
  });

  it('rechaza idFasciculo no numérico', () => {
    expect(() => assertValidLinkReviewerPayload(validPayload({ idFasciculo: 'foo' as never }))).toThrow(/idFasciculo/);
  });

  it('rechaza idFasciculo cero o negativo', () => {
    expect(() => assertValidLinkReviewerPayload(validPayload({ idFasciculo: 0 }))).toThrow(/idFasciculo/);
  });

  it('rechaza anoFasciculo string', () => {
    expect(() => assertValidLinkReviewerPayload(validPayload({ anoFasciculo: 'dosmilveinte' as never }))).toThrow(
      /anoFasciculo/,
    );
  });

  it('rechaza tpoNacionalidad fuera de C/E', () => {
    expect(() => assertValidLinkReviewerPayload(validPayload({ tpoNacionalidad: 'X' as never }))).toThrow(
      /tpoNacionalidad/,
    );
  });
});
