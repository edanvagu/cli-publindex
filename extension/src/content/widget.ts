import {
  getState,
  subscribeToState,
  updateArticleState,
  updateAuthorState,
  updateReviewerState,
  type ExtensionState,
  type StoredArticle,
  type StoredAuthor,
  type StoredReviewer,
} from '../storage';
import { fillArticleForm, fillAuthorForm, fillReviewerForm, type FillResult } from './form-fillers';
import type { FormType } from './form-detectors';

let host: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;

const LABELS: Record<FormType, string> = {
  article: 'Artículos',
  author: 'Autores',
  reviewer: 'Evaluadores',
};

export function mountWidget(formType: FormType): void {
  unmountWidget();

  host = document.createElement('div');
  host.id = 'publindex-autofill-widget';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = template(formType);

  // Minimize (vs. destroy) so the editor can't accidentally lose the widget by clicking the close button. Re-expand by clicking the pill.
  const root = shadow.querySelector('.root')!;
  shadow.querySelector<HTMLButtonElement>('.minimize')!.addEventListener('click', () => {
    root.classList.add('minimized');
  });
  shadow.querySelector<HTMLButtonElement>('.pill')!.addEventListener('click', () => {
    root.classList.remove('minimized');
  });

  document.body.appendChild(host);

  const refresh = (state: ExtensionState | null) => renderList(formType, shadow, state);
  getState().then(refresh);
  unsubscribe = subscribeToState(refresh);
}

export function unmountWidget(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (host) {
    host.remove();
    host = null;
  }
}

// Called by the content-script message listener when the popup's "Mostrar widget" button is clicked. Expands the pill back to the full panel.
export function expandWidget(): boolean {
  const shadow = host?.shadowRoot;
  if (!shadow) return false;
  shadow.querySelector('.root')?.classList.remove('minimized');
  return true;
}

function template(formType: FormType): string {
  return `
    <style>
      :host { all: initial; }
      .root {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        font-size: 13px;
        color: #1f2328;
      }
      .container {
        width: 340px;
        max-height: 520px;
        background: #ffffff;
        border: 1px solid #d0d7de;
        border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .root.minimized .container { display: none; }
      .root:not(.minimized) .pill { display: none; }
      .pill {
        background: #1a5490;
        color: #fff;
        border: 0;
        border-radius: 20px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      .pill:hover { background: #14406d; }
      header {
        padding: 10px 12px;
        background: #1a5490;
        color: #fff;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      header h1 { margin: 0; font-size: 13px; font-weight: 600; }
      .minimize {
        background: transparent;
        border: 0;
        color: #fff;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0 4px;
      }
      .body { padding: 8px 10px; overflow-y: auto; flex: 1; min-height: 80px; max-height: 380px; }
      .item {
        padding: 8px 10px;
        border: 1px solid #e4e7eb;
        border-radius: 6px;
        margin-bottom: 6px;
        cursor: pointer;
        background: #fff;
      }
      .item:hover { background: #f6f8fa; border-color: #b6bec7; }
      .item .name { font-size: 12px; font-weight: 500; word-break: break-word; line-height: 1.3; }
      .item .affiliation { font-size: 11px; color: #656d76; margin-top: 2px; word-break: break-word; line-height: 1.3; }
      .item .meta { font-size: 11px; color: #656d76; margin-top: 4px; display: flex; gap: 8px; }
      .state { padding: 1px 6px; border-radius: 3px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
      .state-pendiente { background: #fff8c5; color: #6e5a00; }
      .state-rellenado { background: #ddf4ff; color: #0a3069; }
      .state-subido { background: #dcffe4; color: #0a5223; }
      .item-actions { display: flex; gap: 6px; margin-top: 6px; }
      .item-actions button {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        border: 1px solid #d0d7de;
        background: #f6f8fa;
        cursor: pointer;
      }
      .item-actions button:hover { background: #eaeef2; }
      .empty { text-align: center; padding: 24px 12px; color: #656d76; }
      .group-header {
        font-size: 13px;
        font-weight: 600;
        color: #1a5490;
        padding: 12px 2px 6px 2px;
        margin-top: 8px;
        border-top: 1px solid #e4e7eb;
        line-height: 1.35;
        word-break: break-word;
      }
      .group-header.first { border-top: 0; margin-top: 0; padding-top: 4px; }
      .group-header .untitled { color: #8b949e; font-style: italic; }
      footer { padding: 8px 12px; border-top: 1px solid #eee; font-size: 11px; color: #656d76; }
      .status-line { padding: 4px 12px; background: #f6f8fa; font-size: 11px; color: #656d76; min-height: 14px; word-break: break-word; }
    </style>
    <div class="root">
      <div class="container">
        <header>
          <h1>Publindex · ${LABELS[formType]}</h1>
          <button class="minimize" title="Minimizar">–</button>
        </header>
        <div class="status-line"></div>
        <div class="body"></div>
        <footer>Revisa los campos antes de guardar.</footer>
      </div>
      <button class="pill" title="Mostrar Publindex Autofill">Publindex · ${LABELS[formType]}</button>
    </div>
  `;
}

function renderList(formType: FormType, shadow: ShadowRoot, state: ExtensionState | null): void {
  const body = shadow.querySelector('.body')!;
  body.innerHTML = '';

  if (!state) {
    body.innerHTML = `<div class="empty">No hay Excel cargado.<br>Abre el popup para cargar uno.</div>`;
    return;
  }

  const items: (StoredArticle | StoredAuthor | StoredReviewer)[] =
    formType === 'article'
      ? state.articles
      : formType === 'author'
        ? state.authors
        : state.reviewers;

  if (items.length === 0) {
    body.innerHTML = `<div class="empty">No hay filas para ${LABELS[formType].toLowerCase()}.</div>`;
    return;
  }

  if (formType === 'author') {
    renderAuthorsGrouped(body, items as StoredAuthor[], shadow);
    return;
  }

  for (const item of items) {
    body.appendChild(renderItem(formType, item, shadow));
  }
}

const spanishCollator = new Intl.Collator('es', { sensitivity: 'base' });

// Group authors by their parent article title (alphabetical), and within each group sort by author name. Each group gets a small <h3>-style header — makes it obvious which authors belong to which article when the editor is working across many rows.
function renderAuthorsGrouped(body: Element, authors: StoredAuthor[], shadow: ShadowRoot): void {
  const sorted = [...authors].sort((a, b) => {
    const ta = (a.titulo_articulo ?? '').trim();
    const tb = (b.titulo_articulo ?? '').trim();
    const byTitle = spanishCollator.compare(ta, tb);
    if (byTitle !== 0) return byTitle;
    return spanishCollator.compare(a.nombre_completo ?? '', b.nombre_completo ?? '');
  });

  let currentTitle: string | null = null;
  let isFirstGroup = true;
  for (const author of sorted) {
    const title = (author.titulo_articulo ?? '').trim();
    if (title !== currentTitle) {
      const header = document.createElement('div');
      header.className = 'group-header' + (isFirstGroup ? ' first' : '');
      if (title) header.textContent = title;
      else header.innerHTML = `<span class="untitled">(sin artículo)</span>`;
      body.appendChild(header);
      currentTitle = title;
      isFirstGroup = false;
    }
    body.appendChild(renderItem('author', author, shadow));
  }
}

function renderItem(
  formType: FormType,
  item: StoredArticle | StoredAuthor | StoredReviewer,
  shadow: ShadowRoot,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'item';

  const name = itemName(formType, item);
  const affiliation =
    formType !== 'article'
      ? (item as StoredAuthor | StoredReviewer).filiacion_institucional ?? ''
      : '';
  wrap.innerHTML = `
    <div class="name"></div>
    ${affiliation ? '<div class="affiliation"></div>' : ''}
    <div class="meta">
      <span class="state state-${item._state}">${item._state}</span>
    </div>
    <div class="item-actions">
      <button data-action="fill">Rellenar</button>
      <button data-action="mark-subido">Marcar subido</button>
    </div>
  `;
  wrap.querySelector('.name')!.textContent = name;
  if (affiliation) {
    wrap.querySelector('.affiliation')!.textContent = affiliation;
  }

  wrap.querySelector<HTMLButtonElement>('[data-action="fill"]')!.addEventListener('click', async () => {
    setStatus(shadow, 'Rellenando...');
    const result = await fillByFormType(formType, item);
    console.info('[Publindex Autofill] Fill result:', {
      row: item._fila,
      filled: result.filled,
      missing: result.skipped.filter((s) => s.reason === 'no-element').map((s) => s.key),
      emptyInExcel: result.skipped.filter((s) => s.reason === 'empty-value').map((s) => s.key),
      noOption: result.skipped.filter((s) => s.reason === 'no-option').map((s) => s.key),
    });
    setStatus(shadow, formatFillResult(result));
    if (result.filled.length > 0) {
      void markAs(formType, item._fila, 'rellenado');
    }
  });

  wrap
    .querySelector<HTMLButtonElement>('[data-action="mark-subido"]')!
    .addEventListener('click', () => {
      void markAs(formType, item._fila, 'subido');
      setStatus(shadow, `Fila ${item._fila} marcada como subida.`);
    });

  return wrap;
}

function itemName(
  formType: FormType,
  item: StoredArticle | StoredAuthor | StoredReviewer,
): string {
  if (formType === 'article') return (item as StoredArticle).titulo || '—';
  return (item as StoredAuthor | StoredReviewer).nombre_completo || '—';
}

function fillByFormType(
  formType: FormType,
  item: StoredArticle | StoredAuthor | StoredReviewer,
): Promise<FillResult> {
  if (formType === 'article') return fillArticleForm(item as StoredArticle);
  if (formType === 'author') return fillAuthorForm(item as StoredAuthor);
  return fillReviewerForm(item as StoredReviewer);
}

async function markAs(formType: FormType, rowFila: number, state: 'rellenado' | 'subido') {
  if (formType === 'article') await updateArticleState(rowFila, state);
  else if (formType === 'author') await updateAuthorState(rowFila, state);
  else await updateReviewerState(rowFila, state);
}

function formatFillResult(r: FillResult): string {
  const missing = r.skipped.filter((s) => s.reason === 'no-element').map((s) => s.key);
  const noOption = r.skipped.filter((s) => s.reason === 'no-option').map((s) => s.key);
  const empty = r.skipped.filter((s) => s.reason === 'empty-value').length;
  let line = `Rellenados ${r.filled.length} · vacíos ${empty} · no encontrados ${missing.length}`;
  if (missing.length > 0 && missing.length <= 5) line += ` (${missing.join(', ')})`;
  if (noOption.length > 0) line += ` · sin-option: ${noOption.join(', ')}`;
  return line;
}

function setStatus(shadow: ShadowRoot, text: string): void {
  const line = shadow.querySelector('.status-line');
  if (line) line.textContent = text;
}
