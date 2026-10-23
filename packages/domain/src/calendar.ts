import { addDays, daysBetween, startOfWeek } from './dates';
import type { Task } from './model';

/*
 * Calendar layout: month grids and rescheduling, on ISO calendar days.
 */

/** "YYYY-MM" of an ISO day. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function addMonths(month: string, delta: number): string {
  const [year = 1970, m = 1] = month.split('-').map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export interface CalendarDay {
  date: string;
  inMonth: boolean;
}

/** Whole weeks covering `month` (4 to 6 of them), each starting on `weekStartsOn`. */
export function monthGrid(month: string, weekStartsOn: 0 | 1 = 1): CalendarDay[][] {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const start = startOfWeek(first, weekStartsOn);
  const weeks = Math.ceil((daysBetween(start, last) + 1) / 7);
  return Array.from({ length: weeks }, (_week, week) =>
    Array.from({ length: 7 }, (_day, day) => {
      const date = addDays(start, week * 7 + day);
      return { date, inMonth: monthOf(date) === month };
    }),
  );
}

/** Tasks by due day, keeping the given order within a day. Undated tasks are left out. */
export function tasksByDueDate(tasks: readonly Task[]): Map<string, Task[]> {
  const days = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const list = days.get(task.dueDate);
    if (list) list.push(task);
    else days.set(task.dueDate, [task]);
  }
  return days;
}

/** New dates for a task dropped on `day`: the due date moves there and the start keeps its distance. */
export function reschedule(
  task: Pick<Task, 'startDate' | 'dueDate'>,
  day: string,
): { dueDate: string; startDate: string | null } {
  if (!task.startDate || !task.dueDate) return { dueDate: day, startDate: task.startDate };
  const shift = daysBetween(task.dueDate, day);
  return { dueDate: day, startDate: addDays(task.startDate, shift) };
}
