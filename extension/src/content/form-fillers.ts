import type { StoredArticle, StoredAuthor, StoredReviewer } from '../storage';

export type FieldElement = HTMLInputElement | HTMLTextAreaElement;

// Angular reactive forms listen on the `input` event; setting `.value` directly mutates the property but Angular's control value accessor only reacts to the dispatched event. Going through the prototype's native setter is necessary because Angular's compiler patches the property setter on some inputs.
export function setNativeValue(el: FieldElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc?.set) {
    desc.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export interface FillResult {
  filled: string[];
  skipped: { key: string; reason: 'no-element' | 'empty-value' | 'no-option' | 'overlay-timeout' }[];
}

const ARTICLE_TEXT_FIELDS: Record<string, string> = {
  titulo: 'tituloArticulo',
  doi: 'doi',
  url: 'url',
  paginaInicial: 'paginaInicial',
  paginaFinal: 'paginaFinal',
  numeroAutores: 'autores',
  numeroParesEvaluadores: 'paresEvaluo',
  proyecto: 'proyecto',
  numeroReferencias: 'numeroReferencias',
  palabrasClave: 'palabraClave',
  palabrasClaveOtroIdioma: 'palabraClaveIdioma',
  tituloIngles: 'tituloParalelo',
  resumen: 'resumen',
  resumenOtroIdioma: 'abstract',
  resumenIdiomaAdicional: 'resumenOtro',
};

const ARTICLE_DATE_FIELDS: Record<string, string> = {
  fechaRecepcion: 'fechaRecepcion',
  fechaAceptacion: 'fechaVerifFechaAceptacion',
};

// Order matters: cascade parents (granArea, area) are picked before their dependents so the dependent <p-dropdown> has mounted by the time we reach it.
const ARTICLE_DROPDOWN_FIELDS: [string, string][] = [
  ['granArea', 'codGranArea'],
  ['area', 'codAreaConocimiento'],
  ['subarea', 'codSubAreaConocimiento'],
  ['tipoDocumento', 'tipoDocumento'],
  ['idioma', 'codIdioma'],
  ['otroIdioma', 'codIdiomaOtro'],
  ['evalInterna', 'esInternoInstiTit'],
  ['evalNacional', 'esNacionalExternoInst'],
  ['evalInternacional', 'esInternacionalExternoInst'],
  ['tipoResumen', 'tipoResumen'],
  ['tipoEspecialista', 'tipoEspecialista'],
];

// Cascade parents: after picking one of these, wait for the child dropdown to mount before proceeding.
const CASCADE_PARENTS: Record<string, string> = {
  granArea: 'codAreaConocimiento',
  area: 'codSubAreaConocimiento',
};

const DROPDOWN_OVERLAY_TIMEOUT_MS = 3000;
const CASCADE_MOUNT_TIMEOUT_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForSelector(
  selector: string,
  timeoutMs: number,
  root: ParentNode = document,
): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = root.querySelector(selector);
    if (el) return el;
    await sleep(100);
  }
  return null;
}

// Simulate a user click-and-pick on a PrimeNG p-dropdown. Works via pure DOM clicks — no CDP / trusted events required.
async function pickPrimeNGOption(
  formControlName: string,
  optionText: string,
  timeoutMs: number,
): Promise<'ok' | 'no-element' | 'no-option' | 'overlay-timeout'> {
  const pd = document.querySelector(`p-dropdown[formcontrolname="${formControlName}"]`);
  if (!pd) return 'no-element';
  const inner = pd.querySelector('.ui-dropdown') as HTMLElement | null;
  if (!inner) return 'no-element';

  const itemsBelong = () => pd.contains(document.querySelector('p-dropdownitem li.ui-dropdown-item'));
  const anyOverlayOpen = () => !!document.querySelector('p-dropdownitem li.ui-dropdown-item');

  // PrimeNG only keeps one overlay open at a time. If another dropdown's overlay is still up, close it by clicking the body; otherwise our `inner.click()` can be interpreted as "click outside" and just dismiss the other overlay without opening ours.
  if (anyOverlayOpen() && !itemsBelong()) {
    document.body.click();
    await sleep(200);
  }

  inner.click();
  const start = Date.now();
  while (!itemsBelong() && Date.now() - start < timeoutMs) {
    await sleep(100);
  }
  if (!itemsBelong()) return 'overlay-timeout';

  const normalized = optionText.trim().toLowerCase();
  const items = Array.from(document.querySelectorAll('p-dropdownitem li.ui-dropdown-item')) as HTMLElement[];
  const target = items.find((i) => (i.textContent ?? '').trim().toLowerCase() === normalized);
  if (!target) {
    document.body.click();
    return 'no-option';
  }
  target.click();
  await sleep(500);
  return 'ok';
}

// Defensive: if the Excel was generated before the numFmt change, fecha cells may still arrive as YYYY-MM-DD. PrimeNG's p-calendar (dateFormat="dd/mm/yy") cannot parse that, leaves its buffer empty, and onBlur clobbers the field. Convert here so old-format Excels still work.
function toPublindexDateFormat(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// PrimeNG p-calendar commits the parsed date to the Angular model on the `input` event that setNativeValue dispatches. We deliberately do NOT dispatch blur — PrimeNG's onBlur reformats the field from its internal buffer and would clobber the value if PrimeNG hadn't synchronized it yet.
async function fillDateField(pCalendarFormControlName: string, value: string): Promise<'ok' | 'no-element'> {
  const pc = document.querySelector(`p-calendar[formcontrolname="${pCalendarFormControlName}"]`);
  if (!pc) return 'no-element';
  const input = pc.querySelector('input') as HTMLInputElement | null;
  if (!input) return 'no-element';
  setNativeValue(input, toPublindexDateFormat(value));
  return 'ok';
}

export async function fillArticleForm(row: StoredArticle): Promise<FillResult> {
  const filled: string[] = [];
  const skipped: FillResult['skipped'] = [];

  const textValues: Record<string, string | undefined> = {
    titulo: row.titulo,
    doi: row.doi,
    url: row.url,
    paginaInicial: row.pagina_inicial,
    paginaFinal: row.pagina_final,
    numeroAutores: row.numero_autores,
    numeroParesEvaluadores: row.numero_pares_evaluadores,
    proyecto: row.proyecto,
    numeroReferencias: row.numero_referencias,
    palabrasClave: row.palabras_clave,
    palabrasClaveOtroIdioma: row.palabras_clave_otro_idioma,
    tituloIngles: row.titulo_ingles,
    resumen: row.resumen,
    resumenOtroIdioma: row.resumen_otro_idioma,
    resumenIdiomaAdicional: row.resumen_idioma_adicional,
  };
  for (const [key, controlName] of Object.entries(ARTICLE_TEXT_FIELDS)) {
    const value = textValues[key] ?? '';
    if (!value) {
      skipped.push({ key, reason: 'empty-value' });
      continue;
    }
    const el = document.querySelector(`[formcontrolname="${controlName}"]`) as FieldElement | null;
    if (!el) {
      skipped.push({ key, reason: 'no-element' });
      continue;
    }
    setNativeValue(el, value);
    filled.push(key);
  }

  const dateValues: Record<string, string | undefined> = {
    fechaRecepcion: row.fecha_recepcion,
    fechaAceptacion: row.fecha_aceptacion,
  };
  for (const [key, formControlName] of Object.entries(ARTICLE_DATE_FIELDS)) {
    const value = dateValues[key] ?? '';
    if (!value) {
      skipped.push({ key, reason: 'empty-value' });
      continue;
    }
    const status = await fillDateField(formControlName, value);
    if (status === 'ok') filled.push(key);
    else skipped.push({ key, reason: status });
  }

  const dropdownValues: Record<string, string | undefined> = {
    granArea: row.gran_area,
    area: row.area,
    subarea: row.subarea,
    tipoDocumento: row.tipo_documento,
    idioma: row.idioma,
    otroIdioma: row.otro_idioma,
    evalInterna: row.eval_interna ? valorEvalLabel(row.eval_interna) : undefined,
    evalNacional: row.eval_nacional ? valorEvalLabel(row.eval_nacional) : undefined,
    evalInternacional: row.eval_internacional ? valorEvalLabel(row.eval_internacional) : undefined,
    tipoResumen: row.tipo_resumen,
    tipoEspecialista: row.tipo_especialista,
  };
  // Hide PrimeNG's dropdown overlay panels visually while we iterate. The selection logic (click .ui-dropdown → pick item) still needs the overlay in the DOM, but the user shouldn't see ~11 overlays open and close one-by-one. opacity:0 (rather than visibility:hidden) keeps the panel pointer-event-receiving so the programmatic click on `<li>` items still fires the PrimeNG handler. transition:none kills the fade-in animation so the panel doesn't briefly flash before opacity drops.
  const overlayHider = document.createElement('style');
  overlayHider.textContent = '.ui-dropdown-panel { opacity: 0 !important; transition: none !important; }';
  document.head.appendChild(overlayHider);

  try {
    for (const [key, formControlName] of ARTICLE_DROPDOWN_FIELDS) {
      const value = dropdownValues[key] ?? '';
      if (!value) {
        skipped.push({ key, reason: 'empty-value' });
        continue;
      }

      // Cascade waits: if this key depends on a parent having been picked, wait for the element to mount first.
      const parentChild = Object.entries(CASCADE_PARENTS).find(([, child]) => child === formControlName);
      if (parentChild) {
        const mounted = await waitForSelector(
          `p-dropdown[formcontrolname="${formControlName}"]`,
          CASCADE_MOUNT_TIMEOUT_MS,
        );
        if (!mounted) {
          skipped.push({ key, reason: 'no-element' });
          continue;
        }
      }

      const status = await pickPrimeNGOption(formControlName, value, DROPDOWN_OVERLAY_TIMEOUT_MS);
      if (status === 'ok') filled.push(key);
      else skipped.push({ key, reason: status });
    }
  } finally {
    overlayHider.remove();
  }

  return { filled, skipped };
}

// The Excel template's eval_* dropdown emits "T"/"F" (see src/io/excel-writer.ts); Publindex's p-dropdown labels show "Sí"/"No". Translate so pickPrimeNGOption's case-insensitive match lands on the rendered option.
const EVAL_YES = new Set(['t', 's', 'si', 'sí', '1', 'true']);
const EVAL_NO = new Set(['f', 'n', 'no', '0', 'false']);

function valorEvalLabel(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (EVAL_YES.has(t)) return 'Sí';
  if (EVAL_NO.has(t)) return 'No';
  return raw;
}

// Publindex's person-search modal is shared between autor and evaluador: same three formcontrolnames regardless of which form you're on. Nacionalidad (p-dropdown), cédula, and nombre. We fill these three to prime the search; the editor clicks Buscar and confirms the match manually — automating picker selection is risky with homonyms.
async function fillPersonSearchForm(fields: {
  nacionalidad?: string;
  identificacion?: string;
  nombreCompleto?: string;
}): Promise<FillResult> {
  const filled: string[] = [];
  const skipped: FillResult['skipped'] = [];

  // The modal opens by default on /evaluadores/crear but NOT on /autores/crear — there we need to click "Buscar" first. Detect by checking if tpoNacionalidad exists in the DOM; if not, click the outer Buscar button.
  let hasModal = !!document.querySelector('p-dropdown[formcontrolname="tpoNacionalidad"]');
  if (!hasModal) {
    const outerBuscar = Array.from(document.querySelectorAll('button')).find(
      (b) => !b.disabled && (b.textContent ?? '').trim().toLowerCase() === 'buscar',
    );
    if (outerBuscar) {
      outerBuscar.click();
      const start = Date.now();
      while (!hasModal && Date.now() - start < 3000) {
        await sleep(100);
        hasModal = !!document.querySelector('p-dropdown[formcontrolname="tpoNacionalidad"]');
      }
    }
  }

  if (!hasModal) {
    return { filled, skipped: [{ key: 'nacionalidad', reason: 'no-element' }] };
  }

  if (fields.nacionalidad) {
    const status = await pickPrimeNGOption('tpoNacionalidad', fields.nacionalidad, DROPDOWN_OVERLAY_TIMEOUT_MS);
    if (status === 'ok') filled.push('nacionalidad');
    else skipped.push({ key: 'nacionalidad', reason: status });
  } else {
    skipped.push({ key: 'nacionalidad', reason: 'empty-value' });
  }

  const ident = document.querySelector('[formcontrolname="nroDocumentoIdent"]') as FieldElement | null;
  if (fields.identificacion) {
    if (ident) {
      setNativeValue(ident, fields.identificacion);
      filled.push('identificacion');
    } else skipped.push({ key: 'identificacion', reason: 'no-element' });
  } else {
    skipped.push({ key: 'identificacion', reason: 'empty-value' });
  }

  const nombre = document.querySelector('[formcontrolname="txtTotalNames"]') as FieldElement | null;
  if (fields.nombreCompleto) {
    if (nombre) {
      setNativeValue(nombre, fields.nombreCompleto);
      filled.push('nombreCompleto');
    } else skipped.push({ key: 'nombreCompleto', reason: 'no-element' });
  } else {
    skipped.push({ key: 'nombreCompleto', reason: 'empty-value' });
  }

  return { filled, skipped };
}

export async function fillAuthorForm(row: StoredAuthor): Promise<FillResult> {
  return fillPersonSearchForm({
    nacionalidad: row.nacionalidad,
    identificacion: row.identificacion,
    nombreCompleto: row.nombre_completo,
  });
}

export async function fillReviewerForm(row: StoredReviewer): Promise<FillResult> {
  return fillPersonSearchForm({
    nacionalidad: row.nacionalidad,
    identificacion: row.identificacion,
    nombreCompleto: row.nombre_completo,
  });
}
