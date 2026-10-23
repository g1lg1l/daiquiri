import { addMonths, isMonth, monthGrid, reschedule, tasksByDueDate } from './calendar';
import type { Task } from './model';

const task = (id: string, dueDate: string | null): Task => ({
  id,
  workspaceId: 'w',
  teamId: 't',
  number: 1,
  title: id,
  statusId: 's',
  priority: 0,
  projectId: null,
  parentId: null,
  creatorId: 'u',
  startDate: null,
  dueDate,
  estimate: null,
  cycleId: null,
  milestoneId: null,
  attachmentCount: 0,
  sortKey: 'a0',
  completedAt: null,
  canceledAt: null,
  createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  assigneeIds: [],
  labelIds: [],
});

describe('month grid', () => {
  it('covers the month in whole weeks starting on Monday', () => {
    const grid = monthGrid('2026-10');
    expect(grid).toHaveLength(5);
    expect(grid[0]?.[0]).toEqual({ date: '2026-09-28', inMonth: false });
    expect(grid[0]?.[3]).toEqual({ date: '2026-10-01', inMonth: true });
    expect(grid.at(-1)?.at(-1)).toEqual({ date: '2026-11-01', inMonth: false });
  });

  it('can start weeks on Sunday and needs six rows for long months', () => {
    const grid = monthGrid('2026-08', 0);
    expect(grid[0]?.[0]?.date).toBe('2026-07-26');
    expect(grid).toHaveLength(6);
  });

  it('fits February 2027 in four weeks', () => {
    expect(monthGrid('2027-02')).toHaveLength(4);
  });
});

describe('months', () => {
  it('adds months across years', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', -22)).toBe('2024-12');
  });

  it('validates month params', () => {
    expect(isMonth('2026-10')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('2026-1')).toBe(false);
  });
});

describe('rescheduling', () => {
  it('moves the due date and keeps the span', () => {
    expect(reschedule({ startDate: '2026-10-20', dueDate: '2026-10-22' }, '2026-10-29')).toEqual({
      startDate: '2026-10-27',
      dueDate: '2026-10-29',
    });
  });

  it('gives undated tasks a due date only', () => {
    expect(reschedule({ startDate: null, dueDate: null }, '2026-11-02')).toEqual({
      startDate: null,
      dueDate: '2026-11-02',
    });
  });

  it('groups tasks by due day in order', () => {
    const days = tasksByDueDate([
      task('a', '2026-10-22'),
      task('b', null),
      task('c', '2026-10-22'),
    ]);
    expect(days.get('2026-10-22')?.map((t) => t.id)).toEqual(['a', 'c']);
    expect(days.size).toBe(1);
  });
});
