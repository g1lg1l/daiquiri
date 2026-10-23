const pluralRules = new Map<string, Intl.PluralRules>();

/**
 * "1 task" / "3 tasks": picks the form for `n` in the page's language (set on
 * <html lang> by loadLocale) and puts the formatted number in place of `#`.
 */
export function count(n: number, one: string, other: string): string {
  const lang = document.documentElement.lang || 'en';
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRules.set(lang, rules);
  }
  return (rules.select(n) === 'one' ? one : other).replace('#', n.toLocaleString(lang));
}
