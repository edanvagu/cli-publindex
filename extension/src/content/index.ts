import { detectFormType, type FormType } from './form-detectors';
import { mountWidget, unmountWidget, expandWidget } from './widget';
import { isExtensionContextValid } from '../storage';

let current: FormType | null = null;
let shuttingDown = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

function reconcile(): void {
  if (!isExtensionContextValid()) {
    shutdown();
    return;
  }
  const next = detectFormType(location.href, document);
  if (next === current) return;
  if (current) unmountWidget();
  if (next) mountWidget(next);
  current = next;
}

// When the editor reloads the extension from chrome://extensions/, this old content-script module keeps running on the page until the tab is refreshed. Every chrome.* call then throws "Extension context invalidated". Disconnect listeners so we don't spam the console.
function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  window.removeEventListener('hashchange', onUrlChange);
  window.removeEventListener('popstate', onUrlChange);
  window.removeEventListener(LOCATION_CHANGE_EVENT, onUrlChange);
  try {
    unmountWidget();
  } catch {
    /* ignore */
  }
}

function onUrlChange(): void {
  reconcile();
}

// Angular's HashLocationStrategy navigates via history.pushState, and per the HTML spec pushState never fires hashchange even when the hash changes — so without this synthetic event the widget stays on the previous form when the editor switches tabs. The window flag prevents double-wrapping if the extension is reloaded into an already-open page.
const LOCATION_CHANGE_EVENT = 'publindex:locationchange';
const PATCH_FLAG = '__publindexLocationPatched__';
function patchHistoryOnce(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w[PATCH_FLAG]) return;
  w[PATCH_FLAG] = true;
  const fire = () => window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = function (...args) {
    const ret = origPush(...(args as Parameters<typeof history.pushState>));
    fire();
    return ret;
  };
  history.replaceState = function (...args) {
    const ret = origReplace(...(args as Parameters<typeof history.replaceState>));
    fire();
    return ret;
  };
}
patchHistoryOnce();

reconcile();

window.addEventListener('hashchange', onUrlChange);
window.addEventListener('popstate', onUrlChange);
window.addEventListener(LOCATION_CHANGE_EVENT, onUrlChange);

// Safety net: Publindex's tab transitions sometimes bypass hashchange/popstate and the patched pushState/replaceState — without this poll, only a hard refresh updated the widget. reconcile() is a regex plus at most one querySelector, so a 500ms tick is invisible cost-wise and also covers the document_idle race where Angular bootstraps after our first reconcile.
const POLL_INTERVAL_MS = 500;
pollIntervalId = setInterval(() => {
  if (shuttingDown) return;
  reconcile();
}, POLL_INTERVAL_MS);

// The popup sends SHOW_WIDGET when the editor clicks "Mostrar widget" — useful after the widget was minimized (or when the content script is still loading on a fresh tab and the widget hasn't auto-mounted yet).
if (isExtensionContextValid()) {
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type !== 'SHOW_WIDGET') return;
      if (expandWidget()) return;
      const type = detectFormType(location.href, document);
      if (type) {
        mountWidget(type);
        current = type;
      }
    });
  } catch {
    /* context invalidated between load and listener wiring — ignore */
  }
}
