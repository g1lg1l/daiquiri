import { moveTaskDates, taskSpan, timelineRange } from './timeline';

describe('task spans', () => {
  it('runs from start to due date', () => {
    expect(taskSpan({ startDate: '2026-10-20', dueDate: '2026-10-24' })).toEqual({
      start: '2026-10-20',
      end: '2026-10-24',
    });
  });

  it('makes a one-day bar from a single date and none without dates', () => {
    expect(taskSpan({ startDate: null, dueDate: '2026-10-24' })).toEqual({
      start: '2026-10-24',
      end: '2026-10-24',
    });
    expect(taskSpan({ startDate: null, dueDate: null })).toBeNull();
  });

  it('tolerates a start after the due date', () => {
    expect(taskSpan({ startDate: '2026-10-30', dueDate: '2026-10-24' })?.start).toBe('2026-10-24');
  });
});

describe('timeline range', () => {
  it('pads a week before and four weeks after, starting on a Monday', () => {
    const range = timelineRange([{ start: '2026-10-20', end: '2026-11-02' }], '2026-10-23');
    expect(range.start).toBe('2026-10-12');
    expect(range.days).toBe(50);
  });

  it('always includes today', () => {
    expect(timelineRange([], '2026-10-23').start).toBe('2026-10-12');
  });
});

describe('moving bars', () => {
  const ranged = { startDate: '2026-10-20', dueDate: '2026-10-24' };
  const dueOnly = { startDate: null, dueDate: '2026-10-24' };

  it('moves the whole bar and only the dates the task has', () => {
    expect(moveTaskDates(ranged, 3, 'both')).toEqual({
      startDate: '2026-10-23',
      dueDate: '2026-10-27',
    });
    expect(moveTaskDates(dueOnly, -1, 'both')).toEqual({ startDate: null, dueDate: '2026-10-23' });
  });

  it('resizes an edge without crossing the other', () => {
    expect(moveTaskDates(ranged, 2, 'end').dueDate).toBe('2026-10-26');
    expect(moveTaskDates(ranged, 9, 'start')).toEqual({
      startDate: '2026-10-24',
      dueDate: '2026-10-24',
    });
    expect(moveTaskDates(ranged, -9, 'end').dueDate).toBe('2026-10-20');
  });

  it('turns a single date into a range when resized', () => {
    expect(moveTaskDates(dueOnly, -3, 'start')).toEqual({
      startDate: '2026-10-21',
      dueDate: '2026-10-24',
    });
  });
});
