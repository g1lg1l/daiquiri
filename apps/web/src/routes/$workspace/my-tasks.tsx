import { useTasks } from '@daiq/data';
import { viewSearchSchema, type GroupBy, type ViewDefaults } from '@daiq/domain';
import { cn } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CircleUserIcon } from 'lucide-react';
import { useMemo } from 'react';
import { z } from 'zod';
import { TaskView } from '../../features/tasks/task-view';
import { useSetSearch } from '../../features/views/use-set-search';
import { useWorkspace, useWorkspaceData } from '../../features/workspace/workspace-context';

const searchSchema = viewSearchSchema.extend({
  tab: z.enum(['assigned', 'created']).optional().catch(undefined),
});

export const Route = createFileRoute('/$workspace/my-tasks')({
  validateSearch: searchSchema,
  component: MyTasks,
});

const DEFAULTS: ViewDefaults = {
  layout: 'list',
  group: 'due',
  order: 'priority',
  completed: 'week',
};
const GROUPS: GroupBy[] = ['due', 'priority', 'project', 'label', 'none'];

function MyTasks() {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const search = Route.useSearch();
  const setSearch = useSetSearch();
  const tab = search.tab ?? 'assigned';
  const tasks = useTasks(
    tab === 'assigned'
      ? { kind: 'assignee', id: userId, workspaceId: workspace.id }
      : { kind: 'creator', id: userId, workspaceId: workspace.id },
  );
  const teamIds = useMemo(() => data.myTeams.map((team) => team.id), [data.myTeams]);
  const composerDefaults = useMemo(
    () => (tab === 'assigned' ? { assigneeIds: [userId] } : {}),
    [tab, userId],
  );

  const tabs = (
    <nav aria-label="My tasks" className="mr-2 flex items-center gap-0.5">
      {(['assigned', 'created'] as const).map((value) => (
        <Link
          key={value}
          to="."
          search={(previous: Record<string, unknown>) => ({
            ...previous,
            tab: value === 'assigned' ? undefined : value,
          })}
          replace
          className={cn(
            'rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-surface-muted hover:text-fg',
            tab === value && 'bg-surface-emphasis font-medium text-fg',
          )}
        >
          {value === 'assigned' ? 'Assigned' : 'Created'}
        </Link>
      ))}
    </nav>
  );

  return (
    <TaskView
      title="My tasks"
      icon={<CircleUserIcon className="size-4 text-fg-muted" />}
      tasks={tasks.data}
      search={search}
      setSearch={setSearch}
      defaults={DEFAULTS}
      teamIds={teamIds}
      composerDefaults={composerDefaults}
      allowedGroups={GROUPS}
      headerExtra={tabs}
    />
  );
}
