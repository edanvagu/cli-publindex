import { describe, it, expect } from 'vitest';
import { dispatch, breadcrumb, View } from '../../src/cli/navigation';

describe('dispatch - navegación', () => {
  it('main + import-ojs ejecuta la acción', () => {
    expect(dispatch('main', 'import-ojs')).toEqual({ kind: 'run', action: 'import-ojs' });
  });

  it('main + help-ojs ejecuta la acción', () => {
    expect(dispatch('main', 'help-ojs')).toEqual({ kind: 'run', action: 'help-ojs' });
  });

  it('main + about ejecuta la acción', () => {
    expect(dispatch('main', 'about')).toEqual({ kind: 'run', action: 'about' });
  });

  it('main + upload-channel empuja la vista de canales', () => {
    expect(dispatch('main', 'upload-channel')).toEqual({ kind: 'push', view: 'upload-channel' });
  });

  it('upload-channel + auto-menu empuja el sub-menú automatizado', () => {
    expect(dispatch('upload-channel', 'auto-menu')).toEqual({ kind: 'push', view: 'auto-menu' });
  });

  it('upload-channel + ext-menu empuja el sub-menú de extensión', () => {
    expect(dispatch('upload-channel', 'ext-menu')).toEqual({ kind: 'push', view: 'ext-menu' });
  });

  it('auto-menu + upload-articles ejecuta la acción', () => {
    expect(dispatch('auto-menu', 'upload-articles')).toEqual({ kind: 'run', action: 'upload-articles' });
  });

  it('auto-menu + upload-authors ejecuta la acción', () => {
    expect(dispatch('auto-menu', 'upload-authors')).toEqual({ kind: 'run', action: 'upload-authors' });
  });

  it('auto-menu + upload-reviewers ejecuta la acción', () => {
    expect(dispatch('auto-menu', 'upload-reviewers')).toEqual({ kind: 'run', action: 'upload-reviewers' });
  });

  it('ext-menu + install-extension ejecuta la acción', () => {
    expect(dispatch('ext-menu', 'install-extension')).toEqual({ kind: 'run', action: 'install-extension' });
  });

  it('ext-menu + open-publindex ejecuta la acción', () => {
    expect(dispatch('ext-menu', 'open-publindex')).toEqual({ kind: 'run', action: 'open-publindex' });
  });

  it('ext-menu + help-extension ejecuta la acción', () => {
    expect(dispatch('ext-menu', 'help-extension')).toEqual({ kind: 'run', action: 'help-extension' });
  });
});

describe('dispatch - back y exit', () => {
  it('back desde cualquier vista devuelve nav', () => {
    expect(dispatch('upload-channel', 'back')).toEqual({ kind: 'nav', action: 'back' });
    expect(dispatch('auto-menu', 'back')).toEqual({ kind: 'nav', action: 'back' });
    expect(dispatch('ext-menu', 'back')).toEqual({ kind: 'nav', action: 'back' });
  });

  it('exit desde cualquier vista devuelve nav', () => {
    expect(dispatch('main', 'exit')).toEqual({ kind: 'nav', action: 'exit' });
    expect(dispatch('upload-channel', 'exit')).toEqual({ kind: 'nav', action: 'exit' });
    expect(dispatch('auto-menu', 'exit')).toEqual({ kind: 'nav', action: 'exit' });
  });
});

describe('dispatch - rechazos cruzados', () => {
  it('acciones del sub-menú automatizado no funcionan desde main', () => {
    expect(dispatch('main', 'upload-articles')).toEqual({ kind: 'invalid' });
  });

  it('upload-channel no tiene acciones hoja propias', () => {
    expect(dispatch('upload-channel', 'upload-articles')).toEqual({ kind: 'invalid' });
    expect(dispatch('upload-channel', 'install-extension')).toEqual({ kind: 'invalid' });
  });

  it('acciones de extensión no funcionan desde auto-menu', () => {
    expect(dispatch('auto-menu', 'install-extension')).toEqual({ kind: 'invalid' });
    expect(dispatch('auto-menu', 'open-publindex')).toEqual({ kind: 'invalid' });
  });
});

describe('breadcrumb', () => {
  it('formatea el stack con separador · y etiquetas legibles', () => {
    const stack: View[] = ['main', 'upload-channel', 'auto-menu'];
    expect(breadcrumb(stack)).toBe('Menú principal · Cargar a Publindex · Ruta automatizada');
  });

  it('una sola vista produce una sola etiqueta', () => {
    expect(breadcrumb(['main'])).toBe('Menú principal');
  });
});
