import { describe, it, expect } from 'vitest';
import {
  areaExists,
  getAreaName,
  getAreaParent,
  getGranAreas,
  getChildAreas,
  getChildSubareas,
  areaBelongsToParent,
  subareaBelongsToArea,
} from '../../../src/entities/areas/tree';

describe('areaExists', () => {
  it('retorna true para códigos de gran área válidos', () => {
    expect(areaExists('1')).toBe(true);
    expect(areaExists('6')).toBe(true);
  });

  it('retorna true para códigos de área válidos', () => {
    expect(areaExists('6A')).toBe(true);
    expect(areaExists('1F')).toBe(true);
  });

  it('retorna true para códigos de subárea válidos', () => {
    expect(areaExists('6A01')).toBe(true);
    expect(areaExists('1F13')).toBe(true);
  });

  it('retorna false para códigos inexistentes', () => {
    expect(areaExists('99')).toBe(false);
    expect(areaExists('9Z99')).toBe(false);
    expect(areaExists('')).toBe(false);
  });
});

describe('getAreaName', () => {
  it('retorna el nombre para gran área', () => {
    expect(getAreaName('6')).toBe('Humanidades');
    expect(getAreaName('1')).toBe('Ciencias Naturales');
  });

  it('retorna el nombre para área', () => {
    expect(getAreaName('6A')).toBe('Historia y Arqueología');
  });

  it('retorna el nombre para subárea', () => {
    expect(getAreaName('6A01')).toBe('Historia');
    expect(getAreaName('6A03')).toBe('Historia de Colombia');
  });

  it('retorna undefined para códigos inexistentes', () => {
    expect(getAreaName('ZZ')).toBeUndefined();
  });
});

describe('getAreaParent', () => {
  it('retorna null para gran áreas', () => {
    expect(getAreaParent('1')).toBeNull();
    expect(getAreaParent('6')).toBeNull();
  });

  it('retorna el código padre para áreas', () => {
    expect(getAreaParent('6A')).toBe('6');
    expect(getAreaParent('1F')).toBe('1');
  });

  it('retorna el código padre para subáreas', () => {
    expect(getAreaParent('6A01')).toBe('6A');
    expect(getAreaParent('1F13')).toBe('1F');
  });

  it('retorna undefined para códigos inexistentes', () => {
    expect(getAreaParent('ZZ')).toBeUndefined();
  });
});

describe('getGranAreas', () => {
  it('retorna las 6 grandes áreas', () => {
    const granAreas = getGranAreas();
    expect(granAreas).toHaveLength(6);
  });

  it('incluye Humanidades con código 6', () => {
    const granAreas = getGranAreas();
    const humanidades = granAreas.find(g => g.code === '6');
    expect(humanidades).toBeDefined();
    expect(humanidades?.name).toBe('Humanidades');
  });

  it('todos los códigos son strings de un solo dígito', () => {
    const granAreas = getGranAreas();
    for (const ga of granAreas) {
      expect(ga.code).toMatch(/^[1-6]$/);
    }
  });
});

describe('getChildAreas', () => {
  it('retorna las áreas de Humanidades', () => {
    const areas = getChildAreas('6');
    expect(areas.length).toBeGreaterThan(0);
    const codes =areas.map(a => a.code);
    expect(codes).toContain('6A');
    expect(codes).toContain('6B');
  });

  it('retorna array vacío para gran área inexistente', () => {
    expect(getChildAreas('99')).toEqual([]);
  });

  it('todas las áreas tienen nombre no vacío', () => {
    const areas = getChildAreas('1');
    for (const a of areas) {
      expect(a.name).toBeTruthy();
    }
  });
});

describe('getChildSubareas', () => {
  it('retorna las subáreas de 6A (Historia y Arqueología)', () => {
    const subareas = getChildSubareas('6A');
    const codes =subareas.map(s => s.code);
    expect(codes).toContain('6A01');
    expect(codes).toContain('6A02');
    expect(codes).toContain('6A03');
  });

  it('retorna array vacío para área inexistente', () => {
    expect(getChildSubareas('99Z')).toEqual([]);
  });

  it('retorna array vacío para gran área (no tiene subáreas directas)', () => {
    expect(getChildSubareas('6')).toEqual([]);
  });
});

describe('areaBelongsToParent', () => {
  it('retorna true cuando el área pertenece a la gran área', () => {
    expect(areaBelongsToParent('6A', '6')).toBe(true);
    expect(areaBelongsToParent('1F', '1')).toBe(true);
  });

  it('retorna false cuando no pertenece', () => {
    expect(areaBelongsToParent('6A', '5')).toBe(false);
    expect(areaBelongsToParent('1A', '6')).toBe(false);
  });

  it('retorna false para códigos inexistentes', () => {
    expect(areaBelongsToParent('9Z', '1')).toBe(false);
  });
});

describe('subareaBelongsToArea', () => {
  it('retorna true cuando la subárea pertenece al área', () => {
    expect(subareaBelongsToArea('6A01', '6A')).toBe(true);
    expect(subareaBelongsToArea('6A03', '6A')).toBe(true);
  });

  it('retorna false cuando no pertenece', () => {
    expect(subareaBelongsToArea('6A01', '6B')).toBe(false);
    expect(subareaBelongsToArea('1A01', '6A')).toBe(false);
  });

  it('retorna false para códigos inexistentes', () => {
    expect(subareaBelongsToArea('ZZZ', '6A')).toBe(false);
  });
});
