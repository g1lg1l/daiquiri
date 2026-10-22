import { z } from 'zod';

/** 0 none · 1 urgent · 2 high · 3 medium · 4 low (same encoding as the database). */
export const PRIORITIES = [0, 1, 2, 3, 4] as const;
export type Priority = (typeof PRIORITIES)[number];

export const prioritySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const PRIORITY_LABEL: Record<Priority, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

/** Sort key where urgent comes first and "no priority" last. */
export function prioritySortKey(priority: Priority): number {
  return priority === 0 ? 5 : priority;
}
