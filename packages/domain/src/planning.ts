import type { Cycle, EstimateScale } from './model';

/*
 * Estimates and cycles (feature spec §3.10, §11).
 */

const ESTIMATE_OPTIONS: Record<EstimateScale, readonly number[]> = {
  points: [1, 2, 3, 5, 8, 13],
  hours: [1, 2, 4, 8, 16, 24, 40],
};

export function estimateOptions(scale: EstimateScale): readonly number[] {
  return ESTIMATE_OPTIONS[scale];
}

export function formatEstimate(value: number, scale: EstimateScale): string {
  if (scale === 'hours') return `${value}h`;
  return `${value} ${value === 1 ? 'point' : 'points'}`;
}

/** "Cycle 7", or "Cycle 7 · Launch" when it has a name. */
export function cycleLabel(cycle: Pick<Cycle, 'number' | 'name'>): string {
  return cycle.name ? `Cycle ${cycle.number} · ${cycle.name}` : `Cycle ${cycle.number}`;
}

export type CycleState = 'past' | 'current' | 'upcoming';

export function cycleState(cycle: Pick<Cycle, 'startsOn' | 'endsOn'>, today: string): CycleState {
  if (cycle.endsOn < today) return 'past';
  if (cycle.startsOn > today) return 'upcoming';
  return 'current';
}

/** Cycles a task can be planned into: the current one and upcoming ones, in order. */
export function plannableCycles(cycles: readonly Cycle[], today: string): Cycle[] {
  return cycles
    .filter((cycle) => cycleState(cycle, today) !== 'past')
    .toSorted((a, b) => a.number - b.number);
}
