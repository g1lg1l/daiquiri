import { describeRecurrence, type RecurrenceRule } from './recurrence';

describe('recurrence', () => {
  it('describes a rule in words', () => {
    const rule: RecurrenceRule = { unit: 'day', every: 1, weekdays: [], afterCompletion: false };
    expect(describeRecurrence(rule)).toBe('Every day');
    expect(describeRecurrence({ ...rule, every: 3 })).toBe('Every 3 days');
    // Weeks read Monday first.
    expect(describeRecurrence({ ...rule, unit: 'week', every: 2, weekdays: [0, 4, 1] })).toBe(
      'Every 2 weeks on Mon, Thu, Sun',
    );
    expect(describeRecurrence({ ...rule, unit: 'month', afterCompletion: true })).toBe(
      '1 month after completion',
    );
    expect(describeRecurrence({ ...rule, every: 2, afterCompletion: true })).toBe(
      '2 days after completion',
    );
  });
});
