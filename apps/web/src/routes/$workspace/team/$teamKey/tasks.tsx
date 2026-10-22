import { useTasks } from '@daiq/data';
import { DEFAULT_VIEW, GROUP_BY, viewSearchSchema } from '@daiq/domain';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { NotFoundPanel } from '../../../../components/not-found-panel';
import { TeamBadge } from '../../../../components/team-badge';
import { TaskView } from '../../../../features/tasks/task-view';
import { useSetSearch } from '../../../../features/views/use-set-search';
import { useWorkspaceData } from '../../../../features/workspace/workspace-context';

export const Route = createFileRoute('/$workspace/team/$teamKey/tasks')({
  validateSearch: viewSearchSchema,
  component: TeamTasks,
});

function TeamTasks() {
  const { teamKey } = Route.useParams();
  const search = Route.useSearch();
  const setSearch = useSetSearch();
  const data = useWorkspaceData();
  const team = data.teamsByKey.get(teamKey);
  const tasks = useTasks(team ? { kind: 'team', id: team.id } : null);
  const teamIds = useMemo(() => (team ? [team.id] : []), [team]);
  const composerDefaults = useMemo(() => (team ? { teamId: team.id } : {}), [team]);

  if (!team)
    return (
      <NotFoundPanel
        title="Team not found"
        message={`There is no team with the key ${teamKey}, or it is private.`}
      />
    );
  return (
    <TaskView
      title={team.name}
      icon={<TeamBadge teamKey={team.key} />}
      tasks={tasks.data}
      search={search}
      setSearch={setSearch}
      defaults={DEFAULT_VIEW}
      teamIds={teamIds}
      composerDefaults={composerDefaults}
      allowedGroups={GROUP_BY}
    />
  );
}
