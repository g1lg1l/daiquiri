export const RECURRENCE_UNITS = ['day', 'week', 'month'] as const;
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number];
export const isRecurrenceUnit = (value: string): value is RecurrenceUnit =>
  RECURRENCE_UNITS.some((unit) => unit === value);

/** A recurring series, attached to its latest task (feature spec §3.7). */
export interface Recurrence {
  taskId: string;
  unit: RecurrenceUnit;
  every: number;
  /** Weekly series: days of the week, 0 = Sunday; empty means the anchor's weekday. */
  weekdays: number[];
  afterCompletion: boolean;
  anchorOn: string;
  /** The next scheduled task; null while waiting for a completion. */
  nextOn: string | null;
}

export type RecurrenceRule = Pick<Recurrence, 'unit' | 'every' | 'weekdays' | 'afterCompletion'>;

/** Sunday-first, as stored. */
export const WEEKDAY_SHORT = Array.from({ length: 7 }, (_, day) =>
  // 2023-01-01 was a Sunday.
  new Date(2023, 0, 1 + day).toLocaleDateString('en', { weekday: 'short' }),
);

/** "Every 2 weeks on Mon, Thu", "3 days after completion". */
export function describeRecurrence(rule: RecurrenceRule): string {
  const plural = rule.every === 1 ? rule.unit : `${rule.every} ${rule.unit}s`;
  if (rule.afterCompletion)
    return `${rule.every === 1 ? `1 ${rule.unit}` : plural} after completion`;
  const days =
    rule.unit === 'week' && rule.weekdays.length > 0
      ? ` on ${rule.weekdays
          .toSorted((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
          .map((day) => WEEKDAY_SHORT[day])
          .join(', ')}`
      : '';
  return `Every ${plural}${days}`;
}
