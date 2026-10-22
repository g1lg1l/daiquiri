import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/*
 * Manual ordering uses fractional index keys (base-62 strings compared
 * byte-wise; the database column uses COLLATE "C"). Moving an item rewrites
 * only that item's key.
 */

export function sortKeyBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

export function sortKeysBetween(
  before: string | null,
  after: string | null,
  count: number,
): string[] {
  return generateNKeysBetween(before, after, count);
}

export function compareSortKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Key for moving `items[from]` so it ends up at index `to` of the same ordered list
 * (keyboard reordering and drag-and-drop within a group).
 */
export function sortKeyForMove(
  items: readonly { sortKey: string }[],
  from: number,
  to: number,
): string {
  const others = items.filter((_, index) => index !== from);
  const target = Math.max(0, Math.min(to, others.length));
  return sortKeyBetween(others[target - 1]?.sortKey ?? null, others[target]?.sortKey ?? null);
}
