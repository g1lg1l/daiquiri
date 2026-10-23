import { locale, m } from '../i18n';

let relative: Intl.RelativeTimeFormat | undefined;

const steps: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

/** "just now", "5 min. ago", "yesterday", "3 wk. ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  // Created on first use: the language is set before the first render and never changes after.
  relative ??= new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  let value = (new Date(iso).getTime() - now) / 1000;
  if (Math.abs(value) < 45) return m.task.justNow;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit);
    value /= size;
  }
  return relative.format(Math.round(value), 'year');
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
