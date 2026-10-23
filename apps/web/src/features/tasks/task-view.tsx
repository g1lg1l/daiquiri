import {
  exportRows,
  filterTasks,
  groupTasks,
  slugify,
  sortStatuses,
  sortTasks,
  subgroupTasks,
  toCsv,
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
import { downloadText } from '../../lib/download';
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
import type { BoardLane } from './task-board';
import { TaskContextMenu } from './task-context-menu';
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
const TaskInsights = lazy(() =>
  import('../insights/task-insights').then((m) => ({ default: m.TaskInsights })),
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

  const tasksWithId = (id: string) => (tasks ?? []).filter((task) => task.id === id);
  const visible = useMemo<Task[]>(() => {
    if (!tasks) return [];
    // Insights need the whole history, not just recently completed work.
    const filters = layout === 'insights' ? { ...search, completed: 'all' as const } : search;
    return sortTasks(
      filterTasks(tasks, filters, { userId, today, statuses: data.statuses }),
      order,
    );
  }, [tasks, search, layout, userId, today, data.statuses, order]);

  const label = typeof title === 'string' ? title : 'Tasks';
  const onExport = (format: 'csv' | 'json') => {
    const rows = exportRows(visible, {
      identifier,
      statuses: data.statuses,
      members: data.membersById,
      labels: data.labelsById,
      projects: data.projectsById,
      fields: data.fields.filter((field) =>
        teamIds.some((id) => data.teamsById.get(id)?.fieldIds.includes(field.id)),
      ),
    });
    const name = `${slugify(`${workspace.slug} ${label}`)}-${today}.${format}`;
    if (format === 'csv') downloadText(name, toCsv(rows), 'text/csv;charset=utf-8');
    else downloadText(name, JSON.stringify(rows, null, 2), 'application/json');
  };

  // Sub-groups (list) and swimlanes (board): a second property other than the first.
  const subgroup =
    (layout === 'list' || layout === 'board') &&
    group !== 'none' &&
    search.subgroup &&
    search.subgroup !== group &&
    search.subgroup !== 'field' &&
    allowedGroups.includes(search.subgroup)
      ? search.subgroup
      : undefined;

  const { groups, lanes } = useMemo((): { groups: TaskGroup[]; lanes?: BoardLane[] } => {
    if (!tasks) return { groups: [] };
    const orderedStatuses = sortStatuses(
      teamIds.flatMap((id) => data.teamsById.get(id)?.statuses ?? []),
    );
    const context = {
      userId,
      today,
      statuses: data.statuses,
      orderedStatuses,
      members: data.membersById,
      projects: data.projectsById,
      labels: data.labelsById,
      milestones,
      ...(group === 'field' && search.groupField
        ? { field: data.fieldsById.get(search.groupField) }
        : {}),
    };
    const top = groupTasks(visible, group, context);
    if (!subgroup) return { groups: top };
    if (layout !== 'board') return { groups: subgroupTasks(top, subgroup, context) };
    return {
      groups: top,
      lanes: groupTasks(visible, subgroup, context)
        .filter((lane) => lane.tasks.length > 0)
        .map((lane) => ({
          key: lane.key,
          label: lane.label,
          taskIds: new Set(lane.tasks.map((t) => t.id)),
        })),
    };
  }, [
    tasks,
    visible,
    userId,
    data,
    teamIds,
    group,
    subgroup,
    layout,
    today,
    milestones,
    search.groupField,
  ]);

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
    (taskGroup: TaskGroup, lane?: BoardLane): ComposerDefaults => {
      const valuesOf = (g: Pick<TaskGroup, 'key' | 'kind'>): ComposerDefaults => {
        const extra: ComposerDefaults = {};
        if (g.kind === 'status') extra.statusId = g.key;
        if (g.kind === 'project' && g.key !== 'none') extra.projectId = g.key;
        if (g.kind === 'assignee' && g.key !== 'none') extra.assigneeIds = [g.key];
        if (g.kind === 'label' && g.key !== 'none') extra.labelIds = [g.key];
        return extra;
      };
      // A sub-group's task also gets its parent group's value.
      const parent = taskGroup.parentKey
        ? groups.find((g) => g.key === taskGroup.parentKey)
        : undefined;
      return {
        ...composerDefaults,
        ...(parent && valuesOf(parent)),
        ...valuesOf(taskGroup),
        // A board cell is in a swimlane too.
        ...(lane && subgroup && valuesOf({ key: lane.key, kind: subgroup })),
      };
    },
    [composerDefaults, groups, subgroup],
  );

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ViewHeader title={title} icon={icon}>
          {headerExtra}
          <LayoutToggle layout={layout} setSearch={setSearch} />
          <FilterMenu search={search} setSearch={setSearch} teamIds={teamIds} />
          <DisplayMenu
            teamIds={teamIds}
            layout={layout}
            search={search}
            defaults={defaults}
            setSearch={setSearch}
            allowedGroups={allowedGroups}
            onExport={onExport}
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
        ) : layout === 'insights' ? (
          <Suspense fallback={null}>
            <TaskInsights tasks={visible} />
          </Suspense>
        ) : layout === 'timeline' ? (
          <TaskContextMenu onOpen={onOpen} tasksFor={tasksWithId}>
            <Suspense fallback={null}>
              <TaskTimeline
                groups={groups}
                showGroupHeaders={group !== 'none'}
                peekId={peekTask?.id}
                onOpen={onOpen}
              />
            </Suspense>
          </TaskContextMenu>
        ) : layout === 'calendar' ? (
          <TaskContextMenu onOpen={onOpen} tasksFor={tasksWithId}>
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
          </TaskContextMenu>
        ) : layout === 'board' ? (
          <TaskContextMenu onOpen={onOpen} tasksFor={tasksWithId}>
            <Suspense fallback={null}>
              <TaskBoard
                groups={groups}
                {...(group === 'field' && search.groupField
                  ? { groupField: data.fieldsById.get(search.groupField) }
                  : {})}
                groupBy={group}
                canReorder={order === 'manual'}
                peekId={peekTask?.id}
                onOpen={onOpen}
                composerDefaults={groupDefaults}
                onCreate={composer}
                {...(lanes && subgroup && { lanes, laneBy: subgroup })}
              />
            </Suspense>
          </TaskContextMenu>
        ) : (
          <TaskList
            label={label}
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
