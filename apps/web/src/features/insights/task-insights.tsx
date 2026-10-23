import { useStatusFlow } from '@daiq/data';
import {
  formatHours,
  STATUS_CATEGORIES,
  summarize,
  weeklyThroughput,
  type InsightWeek,
  type Task,
} from '@daiq/domain';
import { Avatar, Skeleton } from '@daiq/ui';
import { useMemo, type ReactNode } from 'react';
import { useToday } from '../../lib/use-today';
import { BurnUp } from '../planning/burn-up';
import { StatusIcon } from '../tasks/icons';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4 ${className ?? ''}`}
    >
      <header>
        <h2 className="text-[13px] font-medium">{title}</h2>
        {description && <p className="text-xs text-fg-subtle">{description}</p>}
      </header>
      {children}
    </section>
  );
}

interface Bar {
  key: string;
  label: ReactNode;
  value: number;
  display: string;
}

/** Horizontal bars, one series: the label and value are text, the bar is decoration. */
function BarList({ bars, empty }: { bars: readonly Bar[]; empty: string }) {
  if (bars.length === 0) return <p className="text-[13px] text-fg-subtle">{empty}</p>;
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <ul className="flex flex-col gap-2">
      {bars.map((bar) => (
        <li key={bar.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px]">
            {bar.label}
          </span>
          <span aria-hidden className="h-3">
            <span
              className="block h-full rounded-r-[4px] bg-accent"
              style={{ width: `${Math.max((bar.value / max) * 100, 1.5)}%` }}
            />
          </span>
          <span className="text-right text-xs text-fg-muted tabular">{bar.display}</span>
        </li>
      ))}
    </ul>
  );
}

/** Created (neutral) and completed (accent) columns per week. */
function Throughput({ weeks }: { weeks: readonly InsightWeek[] }) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.created, w.completed]));
  const height = (value: number) => `${(value / max) * 100}%`;
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div
          aria-hidden
          className="flex h-36 flex-col justify-between text-right text-[10px] text-fg-subtle tabular"
        >
          <span>{max}</span>
          <span>0</span>
        </div>
        <div
          aria-hidden
          className="flex h-36 min-w-0 flex-1 items-end gap-1 border-b border-border"
        >
          {weeks.map((week) => (
            <div
              key={week.week}
              title={`Week of ${shortDate(week.week)}: ${week.created} created, ${week.completed} completed`}
              className="flex h-full flex-1 items-end justify-center gap-0.5 hover:bg-surface-muted"
            >
              <span
                className="w-full max-w-3 rounded-t-[4px] bg-border-strong"
                style={{ height: height(week.created) }}
              />
              <span
                className="w-full max-w-3 rounded-t-[4px] bg-accent"
                style={{ height: height(week.completed) }}
              />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="flex justify-between pl-6 text-[10px] text-fg-subtle">
        <span>{shortDate(weeks[0]?.week ?? '')}</span>
        <span>This week</span>
      </div>
      <figcaption className="flex items-center gap-4 text-xs text-fg-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px] bg-border-strong" /> Created
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px] bg-accent" /> Completed
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Tasks created and completed per week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Created</th>
            <th scope="col">Completed</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.week}>
              <th scope="row">{shortDate(week.week)}</th>
              <td>{week.created}</td>
              <td>{week.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border px-4 py-3">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-fg-subtle">{hint}</dd>}
    </div>
  );
}

/**
 * Fixed, live charts over the tasks a view shows (feature spec §14). Counts
 * come from the loaded tasks; time in status and cycle time need the status
 * history, which the database aggregates.
 */
export function TaskInsights({ tasks }: { tasks: readonly Task[] }) {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const today = useToday();
  const summary = useMemo(() => summarize(tasks, data.statuses, today), [tasks, data, today]);
  const weeks = useMemo(() => weeklyThroughput(tasks, today), [tasks, today]);
  const ids = useMemo(() => tasks.flatMap((t) => (t.number === null ? [] : [t.id])), [tasks]);
  const flow = useStatusFlow(workspace.id, ids);
  const cycle = flow.data?.cycle_time;
  const pending = <Skeleton className="mt-1 h-6 w-16" />;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px] text-fg-muted">
        No tasks match this view. Clear a filter to see its insights.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Stat label="Open" value={summary.open} />
          <Stat
            label="Overdue"
            value={summary.overdue}
            {...(summary.open > 0 && {
              hint: `${Math.round((summary.overdue / summary.open) * 100)}% of open work`,
            })}
          />
          <Stat label="Completed in the last 7 days" value={summary.completedThisWeek} />
          <Stat
            label="Median lead time"
            value={summary.leadTimeDays === null ? '–' : `${summary.leadTimeDays} d`}
            hint="Created to completed, last 12 weeks"
          />
          <Stat
            label="Median cycle time"
            value={
              flow.isPending
                ? pending
                : cycle?.median_hours == null
                  ? '–'
                  : formatHours(cycle.median_hours)
            }
            {...(cycle?.p85_hours != null && {
              hint: `85% within ${formatHours(cycle.p85_hours)}`,
            })}
          />
        </dl>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Throughput" description="Tasks created and completed per week">
            <Throughput weeks={weeks} />
          </Panel>
          <Panel title="Burn-up" description="All work and completed work over 12 weeks">
            <BurnUp
              days={weeks.map((w) => ({
                day: w.week,
                scope: w.scope,
                completed: w.done,
                scopePoints: 0,
                completedPoints: 0,
              }))}
              startsOn={weeks[0]?.week ?? today}
              endsOn={weeks.at(-1)?.week ?? today}
              points={false}
            />
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Status">
            <BarList
              empty="No tasks."
              bars={summary.byStatus.map(({ status, tasks: count }) => ({
                key: status.id,
                label: (
                  <>
                    <StatusIcon category={status.category} className="size-3.5 shrink-0" />
                    <span className="truncate">{status.name}</span>
                  </>
                ),
                value: count,
                display: String(count),
              }))}
            />
          </Panel>
          <Panel title="Open work by assignee">
            <BarList
              empty="No open work."
              bars={summary.byAssignee.map((entry) => {
                const name = entry.assigneeId
                  ? (data.membersById.get(entry.assigneeId)?.displayName ?? 'Former member')
                  : 'Unassigned';
                return {
                  key: entry.assigneeId ?? 'none',
                  label: (
                    <>
                      {entry.assigneeId && <Avatar name={name} size="xs" />}
                      <span className="truncate">{name}</span>
                    </>
                  ),
                  value: entry.tasks,
                  display: entry.estimate
                    ? `${entry.tasks} · ${entry.estimate} est.`
                    : String(entry.tasks),
                };
              })}
            />
          </Panel>
          <Panel title="Time in status" description="Median time tasks spend in each status">
            {flow.isPending ? (
              <Skeleton className="h-24" />
            ) : (
              <BarList
                empty="No status history yet."
                bars={(flow.data?.statuses ?? []).map((entry) => {
                  const category = STATUS_CATEGORIES.find((c) => c === entry.category);
                  return {
                    key: entry.status,
                    label: (
                      <>
                        {category && (
                          <StatusIcon category={category} className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate">{entry.status}</span>
                      </>
                    ),
                    value: entry.median_hours,
                    display: formatHours(entry.median_hours),
                  };
                })}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
