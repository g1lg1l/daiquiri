/*
 * Words the components show, and the language of dates, read at render time.
 * English by default; apps call `localizeUi` before the first render.
 */
export const uiTexts = {
  locale: 'en',
  loading: 'Loading',
  /** Between the steps of a key sequence: "G then I". */
  sequence: 'then',
};

export type UiTexts = Omit<typeof uiTexts, 'locale'>;

export function localizeUi(texts: UiTexts, locale: string): void {
  Object.assign(uiTexts, texts, { locale });
}
