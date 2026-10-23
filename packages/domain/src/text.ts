/*
 * Words the text-producing functions use, read at call time. English by
 * default; `localizeDomain` (localize.ts) replaces them for another language.
 */

type Unit = 'day' | 'week' | 'month';

export const words = {
  /** Language for Intl date and number formatting. */
  locale: 'en',
  today: 'Today',
  tomorrow: 'Tomorrow',
  yesterday: 'Yesterday',
  allTasks: 'All tasks',
  formerMember: 'Former member',
  noAssignee: 'No assignee',
  project: 'Project',
  noProject: 'No project',
  noMilestone: 'No milestone',
  label: 'Label',
  noLabel: 'No label',
  noDueDate: 'No due date',
  /** Group of tasks without a value for a custom field. */
  noValue: (field: string) => `No ${field}`,
  yes: 'Yes',
  no: 'No',
  points: (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`,
  cycle: (n: number) => `Cycle ${n}`,
  /** Unit after minutes ("30m") and days ("3.5 d"). */
  minuteUnit: 'm',
  dayUnit: 'd',
  /** "Every day", "Every 2 weeks". */
  every: (n: number, unit: Unit) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`),
  /** "1 day after completion". */
  afterCompletion: (n: number, unit: Unit) =>
    `${n} ${n === 1 ? unit : `${unit}s`} after completion`,
  /** Appended to a weekly rule: " on Mon, Thu". */
  onDays: (days: string) => ` on ${days}`,
};

export type DomainWords = Omit<typeof words, 'locale'>;

/** A number in the active language, without thousands separators. */
export const formatNumber = (n: number, options?: Intl.NumberFormatOptions): string =>
  n.toLocaleString(words.locale, { useGrouping: false, ...options });
