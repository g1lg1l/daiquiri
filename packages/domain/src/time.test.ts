import { formatClock, formatDuration, parseDuration } from './time';

describe('durations', () => {
  it('reads what people type', () => {
    expect(parseDuration('1h 30m')).toBe(5400);
    expect(parseDuration('1h30')).toBe(5400);
    expect(parseDuration('90m')).toBe(5400);
    expect(parseDuration('90')).toBe(5400);
    expect(parseDuration('1.5h')).toBe(5400);
    expect(parseDuration('1,5 h')).toBe(5400);
    expect(parseDuration('1:30')).toBe(5400);
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('soon')).toBeNull();
    expect(parseDuration('25h')).toBeNull();
    expect(parseDuration('0m')).toBeNull();
  });

  it('formats totals and running timers', () => {
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(7200)).toBe('2h');
    expect(formatDuration(45 * 60)).toBe('45m');
    expect(formatClock(751)).toBe('00:12:31');
  });
});
