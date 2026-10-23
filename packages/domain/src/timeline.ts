import { addDays, daysBetween, startOfWeek } from './dates';
import type { Task } from './model';

/*
 * Timeline layout: tasks as bars from start to due date (feature spec §6).
 */

export interface Span {
  start: string;
  end: string;
}

/** The days a task covers; a single date makes a one-day bar. Undated tasks have none. */
export function taskSpan(task: Pick<Task, 'startDate' | 'dueDate'>): Span | null {
  const start = task.startDate ?? task.dueDate;
  const end = task.dueDate ?? task.startDate;
  if (!start || !end) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

/** Days on screen: a week of margin before the earliest bar (or today), four after the latest. */
export function timelineRange(
  spans: readonly Span[],
  today: string,
  weekStartsOn: 0 | 1 = 1,
): { start: string; days: number } {
  const first = spans.reduce((min, span) => (span.start < min ? span.start : min), today);
  const last = spans.reduce((max, span) => (span.end > max ? span.end : max), today);
  const start = startOfWeek(addDays(first, -7), weekStartsOn);
  return { start, days: daysBetween(start, addDays(last, 28)) + 1 };
}

export type SpanEdge = 'start' | 'end' | 'both';

/**
 * New dates after dragging a bar `delta` days: the whole bar keeps its length
 * and only moves the dates the task has; an edge resizes the bar (never past
 * the other edge) and turns a single date into a range.
 */
export function moveTaskDates(
  task: Pick<Task, 'startDate' | 'dueDate'>,
  delta: number,
  edge: SpanEdge,
): { startDate: string | null; dueDate: string | null } {
  const span = taskSpan(task);
  if (!span || delta === 0) return { startDate: task.startDate, dueDate: task.dueDate };
  if (edge === 'both') {
    return {
      startDate: task.startDate ? addDays(task.startDate, delta) : null,
      dueDate: task.dueDate ? addDays(task.dueDate, delta) : null,
    };
  }
  if (edge === 'start') {
    const start = addDays(span.start, delta);
    return { startDate: start > span.end ? span.end : start, dueDate: span.end };
  }
  const end = addDays(span.end, delta);
  return { startDate: span.start, dueDate: end < span.start ? span.start : end };
}
