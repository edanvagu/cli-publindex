import { describe, it, expect } from 'vitest';
import { assertValidLinkAuthorPayload } from '../../../src/entities/authors/payload-schema';
import type { LinkAuthorPayload } from '../../../src/entities/authors/types';

function validPayload(overrides: Partial<LinkAuthorPayload> = {}): LinkAuthorPayload {
  return {
    codRh: 'COD-FICTICIO-0001',
    idArticulo: 9999,
    anoFasciculo: 2026,
    tpoNacionalidad: 'C',
    txtTotalNames: 'Autor Probe Ficticio',
    ...overrides,
  } as LinkAuthorPayload;
}

describe('linkAuthorPayloadSchema', () => {
  it('acepta payload válido', () => {
    expect(() => assertValidLinkAuthorPayload(validPayload())).not.toThrow();
  });

  it('acepta tpoNacionalidad null o ausente', () => {
    expect(() => assertValidLinkAuthorPayload(validPayload({ tpoNacionalidad: null }))).not.toThrow();
    const p = validPayload();
    delete (p as Partial<LinkAuthorPayload>).tpoNacionalidad;
    expect(() => assertValidLinkAuthorPayload(p)).not.toThrow();
  });

  it('rechaza codRh vacío', () => {
    expect(() => assertValidLinkAuthorPayload(validPayload({ codRh: '' }))).toThrow(/codRh/);
  });

  it('rechaza codRh ausente', () => {
    const p = validPayload();
    delete (p as Partial<LinkAuthorPayload>).codRh;
    expect(() => assertValidLinkAuthorPayload(p)).toThrow(/codRh/);
  });

  it('rechaza idArticulo no numérico', () => {
    expect(() => assertValidLinkAuthorPayload(validPayload({ idArticulo: 'foo' as never }))).toThrow(/idArticulo/);
  });

  it('rechaza idArticulo negativo o cero', () => {
    expect(() => assertValidLinkAuthorPayload(validPayload({ idArticulo: 0 }))).toThrow(/idArticulo/);
    expect(() => assertValidLinkAuthorPayload(validPayload({ idArticulo: -1 }))).toThrow(/idArticulo/);
  });

  it('rechaza anoFasciculo string', () => {
    expect(() => assertValidLinkAuthorPayload(validPayload({ anoFasciculo: 'dosmilveinte' as never }))).toThrow(
      /anoFasciculo/,
    );
  });

  it('rechaza anoFasciculo fuera de rango', () => {
    expect(() => assertValidLinkAuthorPayload(validPayload({ anoFasciculo: 1800 }))).toThrow(/anoFasciculo/);
    expect(() => assertValidLinkAuthorPayload(validPayload({ anoFasciculo: 2200 }))).toThrow(/anoFasciculo/);
  });

  it('rechaza tpoNacionalidad fuera de C/E', () => {
    expect(() => assertValidLinkAuthorPayload(validPayload({ tpoNacionalidad: 'X' as never }))).toThrow(
      /tpoNacionalidad/,
    );
  });

  it('rechaza tpoNacionalidad lowercase', () => {
    expect(() => assertValidLinkAuthorPayload(validPayload({ tpoNacionalidad: 'c' as never }))).toThrow(
      /tpoNacionalidad/,
    );
  });
});
