import { firstStatusOf, isClosedCategory, sortStatuses } from './status';

const statuses = [
  { id: 'done', category: 'completed' as const, position: 0 },
  { id: 'review', category: 'started' as const, position: 1 },
  { id: 'todo', category: 'unstarted' as const, position: 0 },
  { id: 'doing', category: 'started' as const, position: 0 },
  { id: 'backlog', category: 'backlog' as const, position: 0 },
];

describe('status categories', () => {
  it('sorts by category then position', () => {
    expect(sortStatuses(statuses).map((s) => s.id)).toEqual([
      'backlog',
      'todo',
      'doing',
      'review',
      'done',
    ]);
  });

  it('finds the first status of a category', () => {
    expect(firstStatusOf(statuses, 'started')?.id).toBe('doing');
    expect(firstStatusOf(statuses, 'canceled')).toBeUndefined();
  });

  it('knows which categories are closed', () => {
    expect(isClosedCategory('completed')).toBe(true);
    expect(isClosedCategory('canceled')).toBe(true);
    expect(isClosedCategory('started')).toBe(false);
  });
});
