import { z } from 'zod';

/** Fixed status categories, in workflow order. Teams name statuses; categories carry meaning. */
export const STATUS_CATEGORIES = [
  'triage',
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
] as const;

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const statusCategorySchema = z.enum(STATUS_CATEGORIES);

export const STATUS_CATEGORY_LABEL: Record<StatusCategory, string> = {
  triage: 'Triage',
  backlog: 'Backlog',
  unstarted: 'Todo',
  started: 'In progress',
  completed: 'Done',
  canceled: 'Canceled',
};

export function isClosedCategory(category: StatusCategory): boolean {
  return category === 'completed' || category === 'canceled';
}

export function isActiveCategory(category: StatusCategory): boolean {
  return category === 'unstarted' || category === 'started';
}

export interface StatusLike {
  id: string;
  category: StatusCategory;
  position: number;
}

/** Sorts statuses by category order, then by their position inside the category. */
export function sortStatuses<T extends StatusLike>(statuses: readonly T[]): T[] {
  return [...statuses].sort(
    (a, b) =>
      STATUS_CATEGORIES.indexOf(a.category) - STATUS_CATEGORIES.indexOf(b.category) ||
      a.position - b.position,
  );
}

/** The first status of a category, used when a task must move into that category. */
export function firstStatusOf<T extends StatusLike>(
  statuses: readonly T[],
  category: StatusCategory,
): T | undefined {
  return sortStatuses(statuses).find((status) => status.category === category);
}
