import { useCycles, useTasks } from '@daiq/data';
import { cycleLabel, cycleState, isClosedCategory, parseIsoDate, type Cycle } from '@daiq/domain';
import { buttonVariants, cn } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { RefreshCcwIcon } from 'lucide-react';
import { useMemo } from 'react';
import { NotFoundPanel } from '../../../../components/not-found-panel';
import { TeamBadge } from '../../../../components/team-badge';
import { ViewHeader } from '../../../../features/shell/view-header';
import { useWorkspace, useWorkspaceData } from '../../../../features/workspace/workspace-context';
import { locale } from '../../../../i18n';
import { m } from '../../../../i18n/team';
import { useToday } from '../../../../lib/use-today';

export const Route = createFileRoute('/$workspace/team/$teamKey/cycles')({
  component: TeamCycles,
});

export const cycleDates = (cycle: Pick<Cycle, 'startsOn' | 'endsOn'>) => {
  const dates = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  return `${dates.format(parseIsoDate(cycle.startsOn))} – ${dates.format(parseIsoDate(cycle.endsOn))}`;
};

function TeamCycles() {
  const { teamKey } = Route.useParams();
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const team = data.teamsByKey.get(teamKey);
  const cycles = useCycles(team?.cyclesEnabled ? team.id : undefined);
  const tasks = useTasks(team ? { kind: 'team', id: team.id } : null);
  const today = useToday();

  const counts = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const task of tasks.data ?? []) {
      if (!task.cycleId) continue;
      const category = data.statuses.get(task.statusId)?.category;
      if (category === 'canceled') continue;
      const entry = map.get(task.cycleId) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (category && isClosedCategory(category)) entry.done += 1;
      map.set(task.cycleId, entry);
    }
    return map;
  }, [tasks.data, data.statuses]);

  if (!team) return <NotFoundPanel title={m.team.notFound} message={m.team.noTeam(teamKey)} />;

  const sorted = (cycles.data ?? []).toSorted((a, b) => b.number - a.number);
  const t = m.team.cycles;
  const sections = [
    {
      key: 'current',
      title: t.current,
      items: sorted.filter((c) => cycleState(c, today) === 'current'),
    },
    {
      key: 'upcoming',
      title: t.upcoming,
      items: sorted.filter((c) => cycleState(c, today) === 'upcoming').toReversed(),
    },
    { key: 'past', title: t.past, items: sorted.filter((c) => cycleState(c, today) === 'past') },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title={t.title(team.name)} icon={<TeamBadge teamKey={team.key} />} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 scrollbar-thin md:px-6">
        {!team.cyclesEnabled ? (
          <div className="flex max-w-md flex-col items-start gap-3 py-10">
            <RefreshCcwIcon className="size-5 text-fg-subtle" aria-hidden />
            <p className="font-medium">{t.off(team.name)}</p>
            <p className="text-[13px] text-fg-muted">{t.offHint}</p>
            <Link
              to="/$workspace/settings/teams/$teamKey"
              params={{ workspace: workspace.slug, teamKey: team.key }}
              className={buttonVariants({ variant: 'primary', size: 'sm' })}
            >
              {t.turnOn}
            </Link>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-8">
            {sections.map(
              (section) =>
                section.items.length > 0 && (
                  <section key={section.key} aria-labelledby={`cycles-${section.key}`}>
                    <h2
                      id={`cycles-${section.key}`}
                      className="mb-2 text-xs font-medium text-fg-subtle"
                    >
                      {section.title}
                    </h2>
                    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                      {section.items.map((cycle) => {
                        const count = counts.get(cycle.id) ?? { done: 0, total: 0 };
                        const percent = count.total
                          ? Math.round((count.done / count.total) * 100)
                          : 0;
                        return (
                          <li key={cycle.id}>
                            <Link
                              to="/$workspace/team/$teamKey/cycle/$number"
                              params={{
                                workspace: workspace.slug,
                                teamKey: team.key,
                                number: String(cycle.number),
                              }}
                              className={cn(
                                'flex items-center gap-4 px-4 py-3 text-[13px] hover:bg-surface-subtle',
                                section.key === 'current' && 'py-4',
                              )}
                            >
                              <RefreshCcwIcon
                                aria-hidden
                                className={cn(
                                  'size-4 shrink-0',
                                  section.key === 'current' ? 'text-accent-text' : 'text-fg-subtle',
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {cycleLabel(cycle)}
                                </span>
                                <span className="text-xs text-fg-muted">{cycleDates(cycle)}</span>
                              </span>
                              <span className="flex w-40 items-center gap-2">
                                <span
                                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
                                  aria-hidden
                                >
                                  <span
                                    className="block h-full rounded-full bg-accent"
                                    style={{ width: `${percent}%` }}
                                  />
                                </span>
                                <span className="w-16 text-right text-xs text-fg-muted tabular">
                                  {count.done}/{count.total}
                                  <span className="sr-only"> {t.tasksDone}</span>
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
