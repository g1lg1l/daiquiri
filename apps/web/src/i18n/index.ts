import { en, type Messages } from './en';

/*
 * Languages (ADR-0016). English is bundled; other languages are chunks loaded
 * before the first render. Components read strings from `m` at render time:
 * `m.tasks.delete`, `m.tasks.created(identifier)`. Changing the language
 * reloads the page, so nothing needs to re-render on a switch.
 */

export const LOCALES = [
  { id: 'en', name: 'English' },
  { id: 'it', name: 'Italiano' },
] as const;
export type Locale = (typeof LOCALES)[number]['id'];

const STORAGE_KEY = 'daiq-locale';

const isLocale = (value: unknown): value is Locale => LOCALES.some((l) => l.id === value);

/** The person's choice, else the first browser language we have. */
function preferred(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage blocked: fall back to the browser's languages.
  }
  for (const tag of navigator.languages) {
    const base = tag.slice(0, 2).toLowerCase();
    if (isLocale(base)) return base;
  }
  return 'en';
}

/**
 * The active strings. Replaced in place by `loadLocale`, so imports stay valid.
 * Route namespaces are added by `provide` when their screens' modules load,
 * which is always before those screens render.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const m = { ...en } as Messages;

/** Adds English namespaces that the loaded language did not already provide. */
export function provide(part: Partial<Messages>): void {
  for (const [key, value] of Object.entries(part))
    if (!(key in m)) Object.assign(m, { [key]: value });
}
/** The active language, for `Intl` formatting. */
export let locale: Locale = 'en';

export async function loadLocale(): Promise<void> {
  locale = preferred();
  document.documentElement.lang = locale;
  if (locale === 'it') {
    const italian = await import('./it');
    Object.assign(m, italian.it);
    italian.localizePackages();
  }
}

export function setLocale(next: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Without storage the choice lasts until reload; nothing else to do.
  }
  window.location.reload();
}

export { count } from './count';
