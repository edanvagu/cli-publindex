import { describe, it, expect } from 'vitest';
import {
  existeArea,
  getNombreArea,
  getPadreArea,
  getGranAreas,
  getAreasDeGranArea,
  getSubareasDeArea,
  areaPerteneceAGranArea,
  subareaPerteneceAArea,
} from '../../src/data/areas';

describe('existeArea', () => {
  it('retorna true para códigos de gran área válidos', () => {
    expect(existeArea('1')).toBe(true);
    expect(existeArea('6')).toBe(true);
  });

  it('retorna true para códigos de área válidos', () => {
    expect(existeArea('6A')).toBe(true);
    expect(existeArea('1F')).toBe(true);
  });

  it('retorna true para códigos de subárea válidos', () => {
    expect(existeArea('6A01')).toBe(true);
    expect(existeArea('1F13')).toBe(true);
  });

  it('retorna false para códigos inexistentes', () => {
    expect(existeArea('99')).toBe(false);
    expect(existeArea('9Z99')).toBe(false);
    expect(existeArea('')).toBe(false);
  });
});

describe('getNombreArea', () => {
  it('retorna el nombre para gran área', () => {
    expect(getNombreArea('6')).toBe('Humanidades');
    expect(getNombreArea('1')).toBe('Ciencias Naturales');
  });

  it('retorna el nombre para área', () => {
    expect(getNombreArea('6A')).toBe('Historia y Arqueología');
  });

  it('retorna el nombre para subárea', () => {
    expect(getNombreArea('6A01')).toBe('Historia');
    expect(getNombreArea('6A03')).toBe('Historia de Colombia');
  });

  it('retorna undefined para códigos inexistentes', () => {
    expect(getNombreArea('ZZ')).toBeUndefined();
  });
});

describe('getPadreArea', () => {
  it('retorna null para gran áreas', () => {
    expect(getPadreArea('1')).toBeNull();
    expect(getPadreArea('6')).toBeNull();
  });

  it('retorna el código padre para áreas', () => {
    expect(getPadreArea('6A')).toBe('6');
    expect(getPadreArea('1F')).toBe('1');
  });

  it('retorna el código padre para subáreas', () => {
    expect(getPadreArea('6A01')).toBe('6A');
    expect(getPadreArea('1F13')).toBe('1F');
  });

  it('retorna undefined para códigos inexistentes', () => {
    expect(getPadreArea('ZZ')).toBeUndefined();
  });
});

describe('getGranAreas', () => {
  it('retorna las 6 grandes áreas', () => {
    const granAreas = getGranAreas();
    expect(granAreas).toHaveLength(6);
  });

  it('incluye Humanidades con código 6', () => {
    const granAreas = getGranAreas();
    const humanidades = granAreas.find(g => g.codigo === '6');
    expect(humanidades).toBeDefined();
    expect(humanidades?.nombre).toBe('Humanidades');
  });

  it('todos los códigos son strings de un solo dígito', () => {
    const granAreas = getGranAreas();
    for (const ga of granAreas) {
      expect(ga.codigo).toMatch(/^[1-6]$/);
    }
  });
});

describe('getAreasDeGranArea', () => {
  it('retorna las áreas de Humanidades', () => {
    const areas = getAreasDeGranArea('6');
    expect(areas.length).toBeGreaterThan(0);
    const codigos = areas.map(a => a.codigo);
    expect(codigos).toContain('6A');
    expect(codigos).toContain('6B');
  });

  it('retorna array vacío para gran área inexistente', () => {
    expect(getAreasDeGranArea('99')).toEqual([]);
  });

  it('todas las áreas tienen nombre no vacío', () => {
    const areas = getAreasDeGranArea('1');
    for (const a of areas) {
      expect(a.nombre).toBeTruthy();
    }
  });
});

describe('getSubareasDeArea', () => {
  it('retorna las subáreas de 6A (Historia y Arqueología)', () => {
    const subareas = getSubareasDeArea('6A');
    const codigos = subareas.map(s => s.codigo);
    expect(codigos).toContain('6A01');
    expect(codigos).toContain('6A02');
    expect(codigos).toContain('6A03');
  });

  it('retorna array vacío para área inexistente', () => {
    expect(getSubareasDeArea('99Z')).toEqual([]);
  });

  it('retorna array vacío para gran área (no tiene subáreas directas)', () => {
    expect(getSubareasDeArea('6')).toEqual([]);
  });
});

describe('areaPerteneceAGranArea', () => {
  it('retorna true cuando el área pertenece a la gran área', () => {
    expect(areaPerteneceAGranArea('6A', '6')).toBe(true);
    expect(areaPerteneceAGranArea('1F', '1')).toBe(true);
  });

  it('retorna false cuando no pertenece', () => {
    expect(areaPerteneceAGranArea('6A', '5')).toBe(false);
    expect(areaPerteneceAGranArea('1A', '6')).toBe(false);
  });

  it('retorna false para códigos inexistentes', () => {
    expect(areaPerteneceAGranArea('9Z', '1')).toBe(false);
  });
});

describe('subareaPerteneceAArea', () => {
  it('retorna true cuando la subárea pertenece al área', () => {
    expect(subareaPerteneceAArea('6A01', '6A')).toBe(true);
    expect(subareaPerteneceAArea('6A03', '6A')).toBe(true);
  });

  it('retorna false cuando no pertenece', () => {
    expect(subareaPerteneceAArea('6A01', '6B')).toBe(false);
    expect(subareaPerteneceAArea('1A01', '6A')).toBe(false);
  });

  it('retorna false para códigos inexistentes', () => {
    expect(subareaPerteneceAArea('ZZZ', '6A')).toBe(false);
  });
});
