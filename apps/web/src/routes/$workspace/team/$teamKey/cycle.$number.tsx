import { useCycleProgress, useCycles, useRenameCycle, useTasks } from '@daiq/data';
import {
  cycleLabel,
  cycleState,
  daysBetween,
  DEFAULT_VIEW,
  GROUP_BY,
  isClosedCategory,
  viewSearchSchema,
} from '@daiq/domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { PencilIcon, RefreshCcwIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NotFoundPanel } from '../../../../components/not-found-panel';
import { BurnUp } from '../../../../features/planning/burn-up';
import { TaskView } from '../../../../features/tasks/task-view';
import { useSetSearch } from '../../../../features/views/use-set-search';
import { useWorkspaceData } from '../../../../features/workspace/workspace-context';
import { formString } from '../../../../lib/forms';
import { useToday } from '../../../../lib/use-today';
import { cycleDates } from './cycles';

export const Route = createFileRoute('/$workspace/team/$teamKey/cycle/$number')({
  validateSearch: viewSearchSchema,
  component: CyclePage,
});

/** One cycle: its tasks in any layout, progress and burn-up. */
function CyclePage() {
  const { teamKey, number } = Route.useParams();
  const search = Route.useSearch();
  const setSearch = useSetSearch();
  const data = useWorkspaceData();
  const today = useToday();
  const team = data.teamsByKey.get(teamKey);
  const cycles = useCycles(team?.id);
  const cycle = cycles.data?.find((c) => c.number === Number(number));
  const tasks = useTasks(cycle ? { kind: 'cycle', id: cycle.id } : null);
  const progress = useCycleProgress(cycle?.id);
  const rename = useRenameCycle(team?.id ?? '');
  const [renaming, setRenaming] = useState(false);
  const teamIds = useMemo(() => (team ? [team.id] : []), [team]);
  const composerDefaults = useMemo(
    () => (team && cycle ? { teamId: team.id, cycleId: cycle.id } : {}),
    [team, cycle],
  );

  if (!team || (cycles.isSuccess && !cycle)) {
    return (
      <NotFoundPanel
        title="Cycle not found"
        message={`${teamKey} has no cycle ${number}, or cycles are off for this team.`}
      />
    );
  }
  if (!cycle) return <Skeleton className="m-6 h-8 w-64" />;

  const open = (tasks.data ?? []).filter((task) => {
    const category = data.statuses.get(task.statusId)?.category;
    return category !== 'canceled';
  });
  const done = open.filter((task) => {
    const category = data.statuses.get(task.statusId)?.category;
    return category ? isClosedCategory(category) : false;
  }).length;
  const state = cycleState(cycle, today);
  const daysLeft = daysBetween(today, cycle.endsOn) + 1;

  const summary = (
    <div className="flex flex-col gap-4 border-b border-border px-4 py-4 md:flex-row md:items-start md:gap-8 md:px-6">
      <dl className="grid shrink-0 grid-cols-3 gap-6 text-[13px] md:grid-cols-1 md:gap-3">
        <div>
          <dt className="text-xs text-fg-subtle">Dates</dt>
          <dd>{cycleDates(cycle)}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">
            {state === 'past' ? 'Ended' : state === 'upcoming' ? 'Starts in' : 'Time left'}
          </dt>
          <dd>
            {state === 'past'
              ? 'Closed'
              : state === 'upcoming'
                ? `${daysBetween(today, cycle.startsOn)} days`
                : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Done</dt>
          <dd className="tabular">
            {done} of {open.length}
            {open.length > 0 && ` (${Math.round((done / open.length) * 100)}%)`}
          </dd>
        </div>
      </dl>
      <div className="min-w-0 flex-1">
        <BurnUp
          days={progress.data ?? []}
          startsOn={cycle.startsOn}
          endsOn={cycle.endsOn}
          points={team.estimatesEnabled}
        />
      </div>
    </div>
  );

  return (
    <>
      <TaskView
        title={cycleLabel(cycle)}
        icon={<RefreshCcwIcon className="size-4 text-accent-text" />}
        tasks={tasks.data}
        search={search}
        setSearch={setSearch}
        defaults={DEFAULT_VIEW}
        teamIds={teamIds}
        composerDefaults={composerDefaults}
        allowedGroups={GROUP_BY}
        subheader={summary}
        headerExtra={
          <Button variant="ghost" size="sm" onClick={() => setRenaming(true)}>
            <PencilIcon /> <span className="max-md:sr-only">Rename</span>
          </Button>
        }
      />
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogTitle>Rename cycle {cycle.number}</DialogTitle>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = formString(new FormData(event.currentTarget), 'name').trim();
              rename.mutate({ id: cycle.id, name: name || null });
              setRenaming(false);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cycle-name">Name</Label>
              <Input
                id="cycle-name"
                name="name"
                maxLength={80}
                autoFocus
                defaultValue={cycle.name ?? ''}
                placeholder="Launch week"
              />
              <p className="text-xs text-fg-subtle">Leave empty to use the number only.</p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
