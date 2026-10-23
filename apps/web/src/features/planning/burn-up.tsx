import type { CycleDay } from '@daiq/data';
import { daysBetween } from '@daiq/domain';
import { m } from '../../i18n';

const WIDTH = 600;
const HEIGHT = 140;
const PAD = { top: 6, right: 4, bottom: 6, left: 4 };

/**
 * Burn-up of a cycle: work in scope (dashed) and work completed (filled) per
 * day. The x axis covers the whole cycle, so the gap to the right is the time
 * left. Counts tasks, or estimate points when `points` is set.
 */
export function BurnUp({
  days,
  startsOn,
  endsOn,
  points,
}: {
  days: readonly CycleDay[];
  startsOn: string;
  endsOn: string;
  points: boolean;
}) {
  const span = Math.max(1, daysBetween(startsOn, endsOn));
  const scope = days.map((d) => (points ? d.scopePoints : d.scope));
  const done = days.map((d) => (points ? d.completedPoints : d.completed));
  const top = Math.max(1, ...scope);
  const x = (day: string) =>
    PAD.left + (daysBetween(startsOn, day) / span) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) => PAD.top + (1 - value / top) * (HEIGHT - PAD.top - PAD.bottom);
  const line = (values: number[]) =>
    days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.day)} ${y(values[i] ?? 0)}`).join(' ');
  const last = days.at(-1);
  const summary = last
    ? m.shell.burnUp.summary(
        points ? last.completedPoints : last.completed,
        points ? last.scopePoints : last.scope,
        points,
      )
    : m.shell.burnUp.empty;

  return (
    <figure className="flex flex-col gap-1">
      <div className="flex gap-2">
        <div
          aria-hidden
          className="flex h-36 flex-col justify-between py-0.5 text-right text-[10px] text-fg-subtle tabular"
        >
          <span>{top}</span>
          <span>0</span>
        </div>
        <svg
          aria-hidden
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-36 min-w-0 flex-1"
          preserveAspectRatio="none"
        >
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(0)}
            y2={y(0)}
            className="stroke-border"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {days.length > 0 && (
            <>
              <path
                d={`${line(done)} L ${x(last?.day ?? startsOn)} ${y(0)} L ${x(startsOn)} ${y(0)} Z`}
                className="fill-accent/15"
              />
              <path
                d={line(scope)}
                fill="none"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="4 3"
                className="stroke-fg-subtle"
              />
              <path
                d={line(done)}
                fill="none"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                className="stroke-accent"
              />
            </>
          )}
        </svg>
      </div>
      <figcaption className="flex items-center gap-4 text-xs text-fg-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-accent" /> {m.shell.burnUp.completed}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0 w-4 border-t-[1.5px] border-dashed border-fg-subtle" />{' '}
          {m.shell.burnUp.scope}
        </span>
        <span className="ml-auto">{summary}</span>
      </figcaption>
    </figure>
  );
}
