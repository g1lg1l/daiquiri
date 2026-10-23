import {
  filterTasks,
  groupTasks,
  sortStatuses,
  sortTasks,
  type GroupBy,
  type Milestone,
  type Task,
  type TaskGroup,
  type ViewDefaults,
  type ViewSearch,
} from '@daiq/domain';
import { Skeleton } from '@daiq/ui';
import { useNavigate } from '@tanstack/react-router';
import { lazy, Suspense, useCallback, useMemo, type ReactNode } from 'react';
import { useToday } from '../../lib/use-today';
import { ViewHeader } from '../shell/view-header';
import { useShell } from '../shell/shell-context';
import { useShortcuts } from '../shortcuts/use-shortcuts';
import {
  DisplayMenu,
  FilterChips,
  FilterMenu,
  LayoutToggle,
  type SetSearch,
} from '../views/view-controls';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { useComposer, type ComposerDefaults } from './composer';
import { TaskList } from './task-list';
import { TaskPeek } from './task-peek';
import { useIdentifier } from './use-identifier';

const TaskBoard = lazy(() => import('./task-board').then((m) => ({ default: m.TaskBoard })));
const TaskCalendar = lazy(() =>
  import('./task-calendar').then((m) => ({ default: m.TaskCalendar })),
);
const TaskTimeline = lazy(() =>
  import('./task-timeline').then((m) => ({ default: m.TaskTimeline })),
);

export interface TaskViewProps {
  title: ReactNode;
  icon?: ReactNode;
  tasks: Task[] | undefined;
  search: ViewSearch;
  setSearch: SetSearch;
  defaults: ViewDefaults;
  /** Teams whose workflow defines the status groups (single-team views). */
  teamIds: readonly string[];
  composerDefaults: ComposerDefaults;
  allowedGroups: readonly GroupBy[];
  headerExtra?: ReactNode;
  /** A project's milestones, for grouping by milestone. */
  milestones?: readonly Milestone[];
  /** Context shown under the header (e.g. project properties). */
  subheader?: ReactNode;
}

export function TaskView({
  title,
  icon,
  tasks,
  search,
  setSearch,
  defaults,
  teamIds,
  composerDefaults,
  allowedGroups,
  headerExtra,
  milestones,
  subheader,
}: TaskViewProps) {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const navigate = useNavigate();
  const composer = useComposer();
  // C creates in this view's context (team, project, cycle), not just the current team.
  useShortcuts({ create: () => composer(composerDefaults) });
  const identifier = useIdentifier();
  const { canPeek } = useShell();
  const today = useToday();
  const layout = search.layout ?? defaults.layout;
  const requestedGroup = search.group ?? defaults.group;
  const group = allowedGroups.includes(requestedGroup)
    ? requestedGroup
    : (allowedGroups[0] ?? 'none');
  const order = search.order ?? defaults.order;

  const visible = useMemo<Task[]>(
    () =>
      tasks
        ? sortTasks(filterTasks(tasks, search, { userId, today, statuses: data.statuses }), order)
        : [],
    [tasks, search, userId, today, data.statuses, order],
  );

  const groups = useMemo<TaskGroup[]>(() => {
    if (!tasks) return [];
    const orderedStatuses = sortStatuses(
      teamIds.flatMap((id) => data.teamsById.get(id)?.statuses ?? []),
    );
    return groupTasks(visible, group, {
      userId,
      today,
      statuses: data.statuses,
      orderedStatuses,
      members: data.membersById,
      projects: data.projectsById,
      labels: data.labelsById,
      milestones,
    });
  }, [tasks, visible, userId, data, teamIds, group, today, milestones]);

  const peekTask = useMemo(
    () => (search.peek ? tasks?.find((task) => identifier(task) === search.peek) : undefined),
    [search.peek, tasks, identifier],
  );

  const onOpen = useCallback(
    (task: Task, mode: 'peek' | 'page') => {
      if (task.number === null) return;
      const ident = identifier(task);
      if (mode === 'page' || !canPeek) {
        void navigate({
          to: '/$workspace/task/$identifier',
          params: { workspace: workspace.slug, identifier: ident },
        });
      } else {
        setSearch({ peek: search.peek === ident ? undefined : ident });
      }
    },
    [identifier, canPeek, navigate, workspace.slug, setSearch, search.peek],
  );

  const groupDefaults = useCallback(
    (taskGroup: TaskGroup): ComposerDefaults => {
      const extra: ComposerDefaults = {};
      if (taskGroup.kind === 'status') extra.statusId = taskGroup.key;
      if (taskGroup.kind === 'project' && taskGroup.key !== 'none') extra.projectId = taskGroup.key;
      if (taskGroup.kind === 'assignee' && taskGroup.key !== 'none')
        extra.assigneeIds = [taskGroup.key];
      if (taskGroup.kind === 'label' && taskGroup.key !== 'none') extra.labelIds = [taskGroup.key];
      return { ...composerDefaults, ...extra };
    },
    [composerDefaults],
  );

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ViewHeader title={title} icon={icon}>
          {headerExtra}
          <LayoutToggle layout={layout} setSearch={setSearch} />
          <FilterMenu search={search} setSearch={setSearch} teamIds={teamIds} />
          <DisplayMenu
            layout={layout}
            search={search}
            defaults={defaults}
            setSearch={setSearch}
            allowedGroups={allowedGroups}
          />
        </ViewHeader>
        {subheader}
        <FilterChips search={search} setSearch={setSearch} />
        {!tasks ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-7" style={{ width: `${70 + ((i * 13) % 30)}%` }} />
            ))}
          </div>
        ) : layout === 'timeline' ? (
          <Suspense fallback={null}>
            <TaskTimeline
              groups={groups}
              showGroupHeaders={group !== 'none'}
              peekId={peekTask?.id}
              onOpen={onOpen}
            />
          </Suspense>
        ) : layout === 'calendar' ? (
          <Suspense fallback={null}>
            <TaskCalendar
              tasks={visible}
              month={search.month}
              setSearch={setSearch}
              peekId={peekTask?.id}
              onOpen={onOpen}
              onCreate={composer}
              composerDefaults={composerDefaults}
            />
          </Suspense>
        ) : layout === 'board' ? (
          <Suspense fallback={null}>
            <TaskBoard
              groups={groups}
              groupBy={group}
              canReorder={order === 'manual'}
              peekId={peekTask?.id}
              onOpen={onOpen}
              composerDefaults={groupDefaults}
              onCreate={composer}
            />
          </Suspense>
        ) : (
          <TaskList
            label={typeof title === 'string' ? title : 'Tasks'}
            groups={groups}
            showGroupHeaders={group !== 'none'}
            canReorder={order === 'manual'}
            peekId={peekTask?.id}
            onOpen={onOpen}
            composerDefaults={groupDefaults}
            onCreate={composer}
          />
        )}
      </div>
      {peekTask && canPeek && (
        <TaskPeek task={peekTask} onClose={() => setSearch({ peek: undefined })} />
      )}
    </div>
  );
}
