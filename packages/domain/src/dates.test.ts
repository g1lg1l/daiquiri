import { addDays, daysBetween, dueBucket, formatDueDate, startOfWeek } from './dates';

// 2026-10-22 is a Thursday.
const today = '2026-10-22';

describe('dates', () => {
  it('does calendar arithmetic across month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(daysBetween('2026-10-22', '2026-11-01')).toBe(10);
  });

  it('finds the start of the week', () => {
    expect(startOfWeek(today, 1)).toBe('2026-10-19');
    expect(startOfWeek(today, 0)).toBe('2026-10-18');
  });

  it.each([
    [null, 'none'],
    ['2026-10-21', 'overdue'],
    ['2026-10-22', 'today'],
    ['2026-10-25', 'this_week'],
    ['2026-10-26', 'next_week'],
    ['2026-11-01', 'next_week'],
    ['2026-11-02', 'later'],
  ] as const)('buckets %s as %s', (due, bucket) => {
    expect(dueBucket(due, today)).toBe(bucket);
  });

  it('formats relative due dates', () => {
    expect(formatDueDate('2026-10-22', today, 'en-US')).toBe('Today');
    expect(formatDueDate('2026-10-23', today, 'en-US')).toBe('Tomorrow');
    expect(formatDueDate('2026-10-21', today, 'en-US')).toBe('Yesterday');
    expect(formatDueDate('2026-10-24', today, 'en-US')).toBe('Sat');
    expect(formatDueDate('2026-11-30', today, 'en-US')).toBe('Nov 30');
    expect(formatDueDate('2027-01-03', today, 'en-US')).toBe('Jan 3, 2027');
  });
});
