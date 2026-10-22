import { useTasks, useUpdateProject } from '@daiq/data';
import {
  DEFAULT_VIEW,
  GROUP_BY,
  isClosedCategory,
  viewSearchSchema,
  type ProjectStatus,
} from '@daiq/domain';
import { Avatar, Button, cn } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArchiveIcon, ArchiveRestoreIcon, UserIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { NotFoundPanel } from '../../../components/not-found-panel';
import { rememberRecent } from '../../../features/command-palette/recent';
import { memberOptions } from '../../../features/pickers/options';
import { PickerPopover } from '../../../features/pickers/picker-popover';
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  ProjectStatusIcon,
  progressOf,
} from '../../../features/projects/project-status';
import { DateField } from '../../../features/tasks/task-actions';
import { TaskView } from '../../../features/tasks/task-view';
import { FavoriteButton } from '../../../features/views/favorite-button';
import { useSetSearch } from '../../../features/views/use-set-search';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';

export const Route = createFileRoute('/$workspace/project/$projectId')({
  validateSearch: viewSearchSchema,
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const search = Route.useSearch();
  const setSearch = useSetSearch();
  const project = data.projectsById.get(projectId);
  const tasks = useTasks(project ? { kind: 'project', id: project.id } : null);
  const updateProject = useUpdateProject(workspace.id);
  const teamIds = useMemo(() => (project ? [project.teamId] : []), [project]);
  const composerDefaults = useMemo(
    () => (project ? { teamId: project.teamId, projectId: project.id } : {}),
    [project],
  );

  useEffect(() => {
    if (project)
      rememberRecent(workspace.id, {
        kind: 'project',
        id: project.id,
        title: project.name,
        subtitle: null,
      });
  }, [project, workspace.id]);

  if (!project)
    return (
      <NotFoundPanel
        title="Project not found"
        message="It may have been deleted, or it belongs to a team you can’t access."
      />
    );

  const counts = (tasks.data ?? []).reduce(
    (acc, task) => {
      const category = data.statuses.get(task.statusId)?.category;
      if (category === 'canceled') return acc;
      return {
        total: acc.total + 1,
        done: acc.done + (category && isClosedCategory(category) ? 1 : 0),
      };
    },
    { done: 0, total: 0 },
  );
  const progress = progressOf(counts);
  const lead = project.leadId ? data.membersById.get(project.leadId) : undefined;
  const team = data.teamsById.get(project.teamId);
  const update = (patch: Parameters<typeof updateProject.mutate>[0]['patch']) =>
    updateProject.mutate({ id: project.id, patch });

  const summary = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2 text-xs text-fg-muted">
      {team && (
        <Link
          to="/$workspace/team/$teamKey/projects"
          params={{ workspace: workspace.slug, teamKey: team.key }}
          className="hover:text-fg"
        >
          {team.name}
        </Link>
      )}
      <PickerPopover
        trigger={
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
            <ProjectStatusIcon status={project.status} progress={progress} />
            {PROJECT_STATUS_LABEL[project.status]}
          </Button>
        }
        options={PROJECT_STATUSES.map((s) => ({
          value: s,
          label: PROJECT_STATUS_LABEL[s],
          icon: <ProjectStatusIcon status={s} progress={0.6} />,
        }))}
        selected={[project.status]}
        placeholder="Project status…"
        onSelect={([value]) => {
          const status = PROJECT_STATUSES.find((s): s is ProjectStatus => s === value);
          if (status) update({ status });
        }}
      />
      <PickerPopover
        trigger={
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
            {lead ? <Avatar name={lead.displayName} size="xs" /> : <UserIcon />}
            {lead ? `Lead: ${lead.displayName}` : 'No lead'}
          </Button>
        }
        options={memberOptions(
          data.members.filter((m) => m.role !== 'guest'),
          userId,
        )}
        selected={project.leadId ? [project.leadId] : []}
        placeholder="Project lead…"
        onSelect={([id]) => update({ leadId: id ?? null })}
      />
      <span className="flex items-center gap-1">
        Start{' '}
        <DateField
          label="Start date"
          value={project.startDate}
          onChange={(startDate) => update({ startDate })}
        />
      </span>
      <span className="flex items-center gap-1">
        Target{' '}
        <DateField
          label="Target date"
          value={project.targetDate}
          onChange={(targetDate) => update({ targetDate })}
        />
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          <span
            className="block h-full rounded-full bg-status-completed transition-[width] duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
        <span className="tabular">
          {counts.done}/{counts.total} done
        </span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        className={cn('ml-auto h-6 px-1.5 text-xs')}
        onClick={() => update({ archivedAt: project.archivedAt ? null : new Date().toISOString() })}
      >
        {project.archivedAt ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
        {project.archivedAt ? 'Unarchive' : 'Archive'}
      </Button>
    </div>
  );

  return (
    <TaskView
      title={project.name}
      icon={<ProjectStatusIcon status={project.status} progress={progress} className="size-4" />}
      tasks={tasks.data}
      search={search}
      setSearch={setSearch}
      defaults={DEFAULT_VIEW}
      teamIds={teamIds}
      composerDefaults={composerDefaults}
      allowedGroups={GROUP_BY.filter((g) => g !== 'project')}
      subheader={summary}
      headerExtra={<FavoriteButton kind="project" id={project.id} />}
    />
  );
}
