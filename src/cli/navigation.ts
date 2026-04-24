const VIEW_LABELS = {
  'main':           'Menú principal',
  'upload-channel': 'Cargar a Publindex',
  'auto-menu':      'Ruta automatizada',
  'ext-menu':       'Ruta con extensión',
} as const;

export type View = keyof typeof VIEW_LABELS;

// `upload-channel` has an empty set on purpose: it only branches into sub-views (auto-menu / ext-menu) and has no leaf action of its own. A missing key would also work but an explicit empty set keeps the table exhaustive.
const LEAVES_BY_VIEW = {
  'main':           ['import-ojs', 'help-ojs', 'about'],
  'upload-channel': [],
  'auto-menu':      ['upload-articles', 'upload-authors', 'upload-reviewers'],
  'ext-menu':       ['install-extension', 'open-publindex', 'help-extension'],
} as const;

export type LeafAction = typeof LEAVES_BY_VIEW[View][number];

export type NavAction = 'back' | 'exit';

export type MenuSelection = LeafAction | View | NavAction;

export type DispatchResult =
  | { kind: 'push'; view: View }
  | { kind: 'run'; action: LeafAction }
  | { kind: 'nav'; action: NavAction }
  | { kind: 'invalid' };

const VIEW_SET: ReadonlySet<string> = new Set(Object.keys(VIEW_LABELS));

export function dispatch(view: View, selection: MenuSelection): DispatchResult {
  if (selection === 'back' || selection === 'exit') {
    return { kind: 'nav', action: selection };
  }
  if (VIEW_SET.has(selection)) {
    return { kind: 'push', view: selection as View };
  }
  if ((LEAVES_BY_VIEW[view] as readonly string[]).includes(selection)) {
    return { kind: 'run', action: selection as LeafAction };
  }
  return { kind: 'invalid' };
}

export function breadcrumb(stack: readonly View[]): string {
  return stack.map(v => VIEW_LABELS[v]).join(' · ');
}
