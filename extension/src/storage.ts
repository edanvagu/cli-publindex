import type { ArticleRow } from '../../src/entities/articles/types';
import type { AuthorRow } from '../../src/entities/authors/types';
import type { ReviewerRow } from '../../src/entities/reviewers/types';

export type RowState = 'pendiente' | 'rellenado' | 'subido';

export interface StoredArticle extends ArticleRow {
  _state: RowState;
  _articleId?: number;
}

export interface StoredAuthor extends AuthorRow {
  _state: RowState;
}

export interface StoredReviewer extends ReviewerRow {
  _state: RowState;
}

export interface ExtensionState {
  fileName: string;
  loadedAt: string;
  articles: StoredArticle[];
  authors: StoredAuthor[];
  reviewers: StoredReviewer[];
}

const STORAGE_KEY = 'publindex-ext-state';

// When the extension is reloaded from chrome://extensions/ while a Publindex tab is already open, the old content-script module keeps executing (same page, MutationObserver still firing) but `chrome.runtime.id` becomes undefined — any chrome.* API call then throws "Extension context invalidated". Treat the ctx as disconnected and no-op storage calls until the editor refreshes the tab.
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

export async function getState(): Promise<ExtensionState | null> {
  if (!isExtensionContextValid()) return null;
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return (data[STORAGE_KEY] as ExtensionState | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function setState(state: ExtensionState): Promise<void> {
  if (!isExtensionContextValid()) return;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch {
    /* context invalidated mid-call — ignore */
  }
}

export async function clearState(): Promise<void> {
  if (!isExtensionContextValid()) return;
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function updateArticleState(
  rowFila: number,
  state: RowState,
  articleId?: number,
): Promise<void> {
  if (!isExtensionContextValid()) return;
  const current = await getState();
  if (!current) return;
  const row = current.articles.find((a) => a._fila === rowFila);
  if (!row) return;
  row._state = state;
  if (articleId !== undefined) row._articleId = articleId;
  await setState(current);
}

export async function updateAuthorState(rowFila: number, state: RowState): Promise<void> {
  if (!isExtensionContextValid()) return;
  const current = await getState();
  if (!current) return;
  const row = current.authors.find((a) => a._fila === rowFila);
  if (!row) return;
  row._state = state;
  await setState(current);
}

export async function updateReviewerState(rowFila: number, state: RowState): Promise<void> {
  if (!isExtensionContextValid()) return;
  const current = await getState();
  if (!current) return;
  const row = current.reviewers.find((a) => a._fila === rowFila);
  if (!row) return;
  row._state = state;
  await setState(current);
}

export function subscribeToState(handler: (state: ExtensionState | null) => void): () => void {
  if (!isExtensionContextValid()) return () => {};
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !(STORAGE_KEY in changes)) return;
    handler((changes[STORAGE_KEY].newValue as ExtensionState | undefined) ?? null);
  };
  try {
    chrome.storage.onChanged.addListener(listener);
  } catch {
    return () => {};
  }
  return () => {
    try {
      chrome.storage.onChanged.removeListener(listener);
    } catch {
      /* ignore */
    }
  };
}
