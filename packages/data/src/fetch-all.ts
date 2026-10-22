import { unwrap } from './errors';

const PAGE_SIZE = 1000;

/**
 * Reads every row of a PostgREST query in pages (the server caps rows per
 * request). `page(from, to)` must build the same ordered query each time.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  limit = 20_000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < limit; from += PAGE_SIZE) {
    // Sequential on purpose: the total is unknown until a short page arrives.
    // oxlint-disable-next-line no-await-in-loop
    const batch = unwrap(await page(from, from + PAGE_SIZE - 1));
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}
