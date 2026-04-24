import { describe, it, expect, beforeEach } from 'vitest';
import { setNativeValue, fillArticleForm, fillAuthorForm, fillReviewerForm } from './form-fillers';
import type { StoredArticle, StoredAuthor, StoredReviewer } from '../storage';

function buildArticle(overrides: Partial<StoredArticle> = {}): StoredArticle {
  return {
    titulo: 'Artículo Ficticio',
    url: 'https://revistas.example.org/a/1',
    doi: '10.0000/fake.0001',
    gran_area: 'Ciencias Sociales',
    area: 'Sociología',
    tipo_documento: 'Artículo de investigación científica y tecnológica',
    palabras_clave: 'alpha; beta',
    titulo_ingles: 'Fake Title',
    resumen: 'Resumen ficticio largo',
    idioma: 'Español',
    otro_idioma: 'Inglés',
    _fila: 2,
    _state: 'pendiente',
    ...overrides,
  };
}

// Minimal happy-dom replica of the Publindex form: a few text inputs with formcontrolname + one "PrimeNG-like" p-dropdown that opens a p-dropdownitem overlay on click of .ui-dropdown. That's enough to exercise both code paths (text + dropdown) without pulling a full Angular runtime.
function buildMiniForm(): void {
  document.body.innerHTML = `
    <form>
      <textarea formcontrolname="tituloArticulo"></textarea>
      <input formcontrolname="doi" type="text" />
      <input formcontrolname="url" type="text" />

      <p-dropdown formcontrolname="tipoDocumento">
        <div class="ui-dropdown"></div>
        <span class="ui-dropdown-label">Seleccione un tipo</span>
        <div class="overlay" hidden></div>
      </p-dropdown>
    </form>
  `;

  const pd = document.querySelector('p-dropdown[formcontrolname="tipoDocumento"]')!;
  const inner = pd.querySelector('.ui-dropdown') as HTMLElement;
  const overlay = pd.querySelector('.overlay') as HTMLElement;

  // Simulate PrimeNG: clicking .ui-dropdown appends <p-dropdownitem> entries inside the overlay,
  // and clicking one commits the label into .ui-dropdown-label. No animation, no debounce.
  inner.addEventListener('click', () => {
    overlay.innerHTML = `
      <p-dropdownitem><li class="ui-dropdown-item">Artículo de investigación científica y tecnológica</li></p-dropdownitem>
      <p-dropdownitem><li class="ui-dropdown-item">Artículo de reflexión</li></p-dropdownitem>
    `;
    overlay.hidden = false;
    overlay.querySelectorAll('li').forEach((li) => {
      li.addEventListener('click', () => {
        const label = pd.querySelector('.ui-dropdown-label')!;
        label.textContent = li.textContent;
        overlay.innerHTML = '';
        overlay.hidden = true;
      });
    });
  });
}

describe('setNativeValue', () => {
  it('asigna el valor y dispara el evento input', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    let fired = false;
    el.addEventListener('input', () => {
      fired = true;
    });
    setNativeValue(el, 'nuevo valor');
    expect(el.value).toBe('nuevo valor');
    expect(fired).toBe(true);
  });
});

describe('fillArticleForm — happy path text + PrimeNG dropdown', () => {
  beforeEach(() => {
    buildMiniForm();
  });

  it('rellena los inputs con formcontrolname y selecciona una opción de p-dropdown', async () => {
    const result = await fillArticleForm(buildArticle());
    expect(
      (document.querySelector('[formcontrolname="tituloArticulo"]') as HTMLTextAreaElement).value,
    ).toBe('Artículo Ficticio');
    expect((document.querySelector('[formcontrolname="doi"]') as HTMLInputElement).value).toBe(
      '10.0000/fake.0001',
    );
    expect(
      document
        .querySelector('p-dropdown[formcontrolname="tipoDocumento"] .ui-dropdown-label')!
        .textContent,
    ).toBe('Artículo de investigación científica y tecnológica');
    expect(result.filled).toContain('titulo');
    expect(result.filled).toContain('doi');
    expect(result.filled).toContain('tipoDocumento');
  });

  it('reporta empty-value cuando el Excel no provee el campo', async () => {
    const row = buildArticle();
    row.fecha_recepcion = undefined;
    const result = await fillArticleForm(row);
    expect(result.skipped.some((s) => s.key === 'fechaRecepcion' && s.reason === 'empty-value')).toBe(
      true,
    );
  });

  it('reporta no-element para dropdowns que no existen en el DOM', async () => {
    const result = await fillArticleForm(buildArticle());
    // Only tipoDocumento p-dropdown is mocked; granArea/area/etc. are missing → no-element.
    const noElement = result.skipped.filter((s) => s.reason === 'no-element').map((s) => s.key);
    expect(noElement).toContain('granArea');
    expect(noElement).toContain('idioma');
  });
}, 10000);

function buildAuthor(): StoredAuthor {
  return {
    titulo_articulo: 'Artículo Ficticio',
    id_articulo: '123',
    nombre_completo: 'Ana Prueba Uno',
    identificacion: 'TEST-00001',
    nacionalidad: 'Colombiana',
    filiacion_institucional: 'Universidad Ficticia',
    _fila: 2,
    _state: 'pendiente',
  };
}

function buildReviewer(): StoredReviewer {
  return {
    nombre_completo: 'Autor Prueba',
    identificacion: 'TEST-00002',
    nacionalidad: 'Extranjera',
    _fila: 2,
    _state: 'pendiente',
  };
}

function buildPersonSearchModal(nacionalidad = 'Colombiana'): void {
  document.body.innerHTML = `
    <p-dropdown formcontrolname="tpoNacionalidad">
      <div class="ui-dropdown"></div>
      <span class="ui-dropdown-label">${nacionalidad}</span>
      <div class="overlay" hidden></div>
    </p-dropdown>
    <input formcontrolname="nroDocumentoIdent" type="text" />
    <input formcontrolname="txtTotalNames" type="text" />
  `;

  const pd = document.querySelector('p-dropdown[formcontrolname="tpoNacionalidad"]')!;
  const inner = pd.querySelector('.ui-dropdown') as HTMLElement;
  const overlay = pd.querySelector('.overlay') as HTMLElement;
  inner.addEventListener('click', () => {
    overlay.innerHTML = `
      <p-dropdownitem><li class="ui-dropdown-item">Colombiana</li></p-dropdownitem>
      <p-dropdownitem><li class="ui-dropdown-item">Extranjera</li></p-dropdownitem>
    `;
    overlay.hidden = false;
    overlay.querySelectorAll('li').forEach((li) => {
      li.addEventListener('click', () => {
        pd.querySelector('.ui-dropdown-label')!.textContent = li.textContent;
        overlay.innerHTML = '';
        overlay.hidden = true;
      });
    });
  });
}

describe('fillAuthorForm', () => {
  it('rellena los 3 campos del buscador de personas', async () => {
    buildPersonSearchModal();
    const result = await fillAuthorForm(buildAuthor());
    expect(
      document
        .querySelector('p-dropdown[formcontrolname="tpoNacionalidad"] .ui-dropdown-label')!
        .textContent,
    ).toBe('Colombiana');
    expect(
      (document.querySelector('[formcontrolname="nroDocumentoIdent"]') as HTMLInputElement).value,
    ).toBe('TEST-00001');
    expect(
      (document.querySelector('[formcontrolname="txtTotalNames"]') as HTMLInputElement).value,
    ).toBe('Ana Prueba Uno');
    expect(result.filled).toContain('nacionalidad');
    expect(result.filled).toContain('identificacion');
    expect(result.filled).toContain('nombreCompleto');
  });

  it('si el modal no está abierto, intenta abrir con botón Buscar primero', async () => {
    // Emulate /autores/crear state: only an outer "Buscar" button, modal mounts on click.
    document.body.innerHTML = `<button type="button">Buscar</button>`;
    const outerBtn = document.querySelector('button')!;
    outerBtn.addEventListener('click', () => {
      buildPersonSearchModal();
    });

    const result = await fillAuthorForm(buildAuthor());
    expect(document.querySelector('[formcontrolname="nroDocumentoIdent"]')).not.toBeNull();
    expect(result.filled).toContain('identificacion');
  });
});

describe('fillReviewerForm', () => {
  it('rellena los 3 campos (comparte form con autor)', async () => {
    buildPersonSearchModal('Colombiana');
    const result = await fillReviewerForm(buildReviewer());
    expect(
      document
        .querySelector('p-dropdown[formcontrolname="tpoNacionalidad"] .ui-dropdown-label')!
        .textContent,
    ).toBe('Extranjera');
    expect(
      (document.querySelector('[formcontrolname="nroDocumentoIdent"]') as HTMLInputElement).value,
    ).toBe('TEST-00002');
    expect(result.filled).toContain('nacionalidad');
  });
});

describe('fillArticleForm — dropdown con overlay-timeout', () => {
  beforeEach(() => {
    // p-dropdown sin handler de click → inner.click() no abre overlay; el filler debería reportar overlay-timeout.
    document.body.innerHTML = `
      <p-dropdown formcontrolname="tipoDocumento">
        <div class="ui-dropdown"></div>
        <span class="ui-dropdown-label">Seleccione</span>
      </p-dropdown>
    `;
  });

  it('reporta overlay-timeout si el dropdown no abre', async () => {
    const result = await fillArticleForm(buildArticle());
    const td = result.skipped.find((s) => s.key === 'tipoDocumento');
    expect(td?.reason).toBe('overlay-timeout');
  }, 10000);
});
