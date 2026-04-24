import { detectFormType, type FormType } from './form-detectors';
import { mountWidget, unmountWidget, expandWidget } from './widget';
import { isExtensionContextValid } from '../storage';

let current: FormType | null = null;
let shuttingDown = false;

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
  window.removeEventListener('hashchange', onUrlChange);
  window.removeEventListener('popstate', onUrlChange);
  try {
    unmountWidget();
  } catch {
    /* ignore */
  }
}

function onUrlChange(): void {
  reconcile();
}

reconcile();

// Publindex is an Angular SPA with hash routing. `hashchange` + `popstate` cover every route transition — no MutationObserver needed. Earlier iterations listened to body mutations but that fires dozens of times per second as PrimeNG opens/closes overlays during a fill.
window.addEventListener('hashchange', onUrlChange);
window.addEventListener('popstate', onUrlChange);

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
