import { words } from './text';

/*
 * Calendar-date helpers. Due/start dates are ISO calendar days ("2026-10-22"),
 * never instants, so all arithmetic happens on local calendar days.
 */

export type DueBucket = 'overdue' | 'today' | 'this_week' | 'next_week' | 'later' | 'none';

export const DUE_BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  this_week: 'This week',
  next_week: 'Next week',
  later: 'Later',
  none: 'No date',
};

export const DUE_BUCKETS: readonly DueBucket[] = [
  'overdue',
  'today',
  'this_week',
  'next_week',
  'later',
  'none',
];

/** Local calendar date as ISO "YYYY-MM-DD". */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / 86_400_000);
}

/** Start of the week containing `iso` (weekStartsOn: 1 = Monday, 0 = Sunday). */
export function startOfWeek(iso: string, weekStartsOn: 0 | 1 = 1): string {
  const weekday = parseIsoDate(iso).getDay();
  return addDays(iso, -((weekday - weekStartsOn + 7) % 7));
}

export function dueBucket(due: string | null, today: string, weekStartsOn: 0 | 1 = 1): DueBucket {
  if (!due) return 'none';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  const nextWeek = addDays(startOfWeek(today, weekStartsOn), 7);
  if (due < nextWeek) return 'this_week';
  if (due < addDays(nextWeek, 7)) return 'next_week';
  return 'later';
}

/** Short human label: "Today", "Tomorrow", "Yesterday", "Fri", "Oct 30", "Jan 3, 2027". */
export function formatDueDate(due: string, today: string, locale = words.locale): string {
  const delta = daysBetween(today, due);
  if (delta === 0) return words.today;
  if (delta === 1) return words.tomorrow;
  if (delta === -1) return words.yesterday;
  const date = parseIsoDate(due);
  if (delta > 1 && delta < 7) return date.toLocaleDateString(locale, { weekday: 'short' });
  const sameYear = due.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
