import { parseExcelFile } from '../shared/excel-parser';
import { PUBLINDEX_APP_URL } from '../shared/constants';
import {
  clearState,
  getState,
  setState,
  subscribeToState,
  type ExtensionState,
  type StoredArticle,
  type StoredAuthor,
  type StoredReviewer,
} from '../storage';

type TabKey = 'articles' | 'authors' | 'reviewers';

let activeTab: TabKey = 'articles';

async function init() {
  render(await getState());
  subscribeToState(render);

  const fileInput = document.getElementById('file-input') as HTMLInputElement;

  document.getElementById('load-button')?.addEventListener('click', () => fileInput.click());
  document.getElementById('clear-button')?.addEventListener('click', onClear);
  document
    .getElementById('open-publindex')
    ?.addEventListener('click', () => chrome.tabs.create({ url: PUBLINDEX_APP_URL }));
  document.getElementById('show-widget')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined) {
      // `sendMessage` rejects if no content script is listening on the active tab (e.g. not on Publindex). Swallow the error — the popup UI will still close and nothing harmful happened.
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_WIDGET' }).catch(() => {});
    }
  });
  fileInput.addEventListener('change', onFileChosen);

  document.querySelectorAll<HTMLButtonElement>('.tab-button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      activeTab = (btn.dataset.tab as TabKey) ?? 'articles';
      document
        .querySelectorAll('.tab-button')
        .forEach((b) => b.classList.toggle('active', b === btn));
      renderList(await getState());
    });
  });
}

async function onFileChosen(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const parsed = await parseExcelFile(file);
    const state: ExtensionState = {
      fileName: file.name,
      loadedAt: new Date().toISOString(),
      articles: parsed.articles.map((r) => ({ ...r, _state: 'pendiente' as const })),
      authors: parsed.authors.map((r) => ({ ...r, _state: 'pendiente' as const })),
      reviewers: parsed.reviewers.map((r) => ({ ...r, _state: 'pendiente' as const })),
    };
    await setState(state);
  } catch (err) {
    alert(`No se pudo leer el Excel: ${(err as Error).message}`);
  } finally {
    input.value = '';
  }
}

async function onClear(): Promise<void> {
  if (!confirm('¿Eliminar los datos cargados?')) return;
  await clearState();
}

function render(state: ExtensionState | null): void {
  const fileInfo = document.getElementById('file-info')!;
  const loadBtn = document.getElementById('load-button')!;
  const clearBtn = document.getElementById('clear-button') as HTMLButtonElement;
  const summary = document.getElementById('summary-section') as HTMLElement;
  const list = document.getElementById('list-section') as HTMLElement;

  if (!state) {
    fileInfo.textContent = 'Sin datos cargados';
    loadBtn.textContent = 'Cargar Excel';
    clearBtn.hidden = true;
    summary.hidden = true;
    list.hidden = true;
    return;
  }

  const loaded = new Date(state.loadedAt);
  fileInfo.textContent = `${state.fileName} · ${loaded.toLocaleString()}`;
  loadBtn.textContent = 'Reemplazar Excel';
  clearBtn.hidden = false;
  summary.hidden = false;
  list.hidden = false;

  document.getElementById('articles-count')!.textContent = String(state.articles.length);
  document.getElementById('authors-count')!.textContent = String(state.authors.length);
  document.getElementById('reviewers-count')!.textContent = String(state.reviewers.length);

  renderList(state);
}

function renderList(state: ExtensionState | null): void {
  const ul = document.getElementById('item-list')!;
  ul.innerHTML = '';
  if (!state) return;

  const items = state[activeTab];
  if (items.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin filas';
    li.style.padding = '8px';
    li.style.color = '#656d76';
    ul.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    li.className = `row row-${item._state}`;
    const name = activeTab === 'articles'
      ? (item as StoredArticle).titulo
      : (item as StoredAuthor | StoredReviewer).nombre_completo;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'row-name';
    nameSpan.textContent = name || '—';
    const stateSpan = document.createElement('span');
    stateSpan.className = 'row-state';
    stateSpan.textContent = item._state;
    li.appendChild(nameSpan);
    li.appendChild(stateSpan);
    ul.appendChild(li);
  }
}

init();
