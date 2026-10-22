import { compareSortKeys, sortKeyBetween, sortKeyForMove, sortKeysBetween } from './ordering';

describe('ordering', () => {
  it('generates keys strictly between neighbours', () => {
    const a = sortKeyBetween(null, null);
    const b = sortKeyBetween(a, null);
    const mid = sortKeyBetween(a, b);
    expect(compareSortKeys(a, mid)).toBe(-1);
    expect(compareSortKeys(mid, b)).toBe(-1);
  });

  it('moves an item to any index and keeps order consistent', () => {
    const keys = sortKeysBetween(null, null, 5);
    const items = keys.map((sortKey, i) => ({ id: i, sortKey }));
    for (let from = 0; from < items.length; from++) {
      for (let to = 0; to < items.length; to++) {
        const moved = { ...items[from]!, sortKey: sortKeyForMove(items, from, to) };
        const reordered = [...items.filter((_, i) => i !== from), moved].sort((x, y) =>
          compareSortKeys(x.sortKey, y.sortKey),
        );
        expect(reordered.indexOf(moved)).toBe(to);
      }
    }
  });
});
