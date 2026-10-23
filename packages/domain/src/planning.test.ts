import type { Cycle } from './model';
import {
  cycleLabel,
  cycleState,
  estimateOptions,
  formatEstimate,
  plannableCycles,
} from './planning';

const cycle = (number: number, startsOn: string, endsOn: string): Cycle => ({
  id: `c${number}`,
  workspaceId: 'w',
  teamId: 't',
  number,
  name: null,
  startsOn,
  endsOn,
  completedAt: null,
});

describe('estimates', () => {
  it('offers a scale of points or hours', () => {
    expect(estimateOptions('points')).toEqual([1, 2, 3, 5, 8, 13]);
    expect(estimateOptions('hours')).toContain(40);
  });

  it('formats values in their unit', () => {
    expect(formatEstimate(1, 'points')).toBe('1 point');
    expect(formatEstimate(5, 'points')).toBe('5 points');
    expect(formatEstimate(8, 'hours')).toBe('8h');
  });
});

describe('cycles', () => {
  const cycles = [
    cycle(3, '2026-10-26', '2026-11-08'),
    cycle(1, '2026-09-28', '2026-10-11'),
    cycle(2, '2026-10-12', '2026-10-25'),
  ];

  it('knows past, current and upcoming cycles, ends included', () => {
    expect(cycleState(cycles[1]!, '2026-10-23')).toBe('past');
    expect(cycleState(cycles[2]!, '2026-10-25')).toBe('current');
    expect(cycleState(cycles[0]!, '2026-10-23')).toBe('upcoming');
  });

  it('plans into the current and upcoming cycles in order', () => {
    expect(plannableCycles(cycles, '2026-10-23').map((c) => c.number)).toEqual([2, 3]);
  });

  it('labels cycles by number and name', () => {
    expect(cycleLabel({ number: 7, name: null })).toBe('Cycle 7');
    expect(cycleLabel({ number: 7, name: 'Launch' })).toBe('Cycle 7 · Launch');
  });
});
