import { useLatestProjectUpdates, useMilestones, useTasks, useUpdateProject } from '@daiq/data';
import {
  DEFAULT_VIEW,
  GROUP_BY,
  isClosedCategory,
  viewSearchSchema,
  type ProjectStatus,
} from '@daiq/domain';
import { Avatar, Button, cn, Select } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArchiveIcon, ArchiveRestoreIcon, LayoutTemplateIcon, UserIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { NotFoundPanel } from '../../../components/not-found-panel';
import { rememberRecent } from '../../../features/command-palette/recent';
import { memberOptions } from '../../../features/pickers/options';
import { PickerPopover } from '../../../features/pickers/picker-popover';
import { Milestones } from '../../../features/projects/milestones';
import {
  HealthBadge,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  ProjectStatusIcon,
  progressOf,
} from '../../../features/projects/project-status';
import { ProjectUpdates } from '../../../features/projects/project-updates';
import { ViewHeader } from '../../../features/shell/view-header';
import { SaveTemplateDialog } from '../../../features/templates/save-template-dialog';
import { DateField } from '../../../features/tasks/task-actions';
import { TaskView } from '../../../features/tasks/task-view';
import { FavoriteButton } from '../../../features/views/favorite-button';
import { useSetSearch } from '../../../features/views/use-set-search';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';

// Monday first; 2023-01-01 was a Sunday.
const REMINDER_DAYS = [
  { value: '', label: 'Off' },
  ...[1, 2, 3, 4, 5, 6, 0].map((day) => ({
    value: String(day),
    label: `${new Date(2023, 0, 1 + day).toLocaleDateString('en', { weekday: 'long' })}s`,
  })),
];

export const Route = createFileRoute('/$workspace/project/$projectId')({
  validateSearch: viewSearchSchema.extend({
    tab: z.enum(['updates']).optional().catch(undefined),
  }),
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
  const milestones = useMilestones(project?.id);
  const latest = useLatestProjectUpdates(workspace.id).data?.get(projectId);
  const updateProject = useUpdateProject(workspace.id);
  const [savingTemplate, setSavingTemplate] = useState(false);
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

  const tabs = (
    <nav aria-label="Project" className="flex rounded-md border border-border p-0.5">
      {(
        [
          [undefined, 'Tasks'],
          ['updates', 'Updates'],
        ] as const
      ).map(([tab, label]) => (
        <Link
          key={label}
          to="/$workspace/project/$projectId"
          params={{ workspace: workspace.slug, projectId: project.id }}
          search={{ tab }}
          activeOptions={{ includeSearch: true, explicitUndefined: true }}
          className="rounded-[5px] px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
          activeProps={{ className: 'bg-surface-emphasis text-fg' }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );

  const summary = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2 text-xs text-fg-muted">
      {tabs}
      {latest && <HealthBadge health={latest.health} />}
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
      <label htmlFor="update-reminder" className="flex items-center gap-1">
        Update reminder
        <Select
          id="update-reminder"
          aria-label="Remind the lead to post an update"
          size="sm"
          value={String(project.updateReminderDay ?? '')}
          onValueChange={(value) =>
            update({ updateReminderDay: value === '' ? null : Number(value) })
          }
          options={REMINDER_DAYS}
          className="h-6 border-transparent bg-transparent pl-1 text-xs shadow-none hover:border-border"
        />
      </label>
      {workspace.role !== 'guest' && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-1.5 text-xs"
            onClick={() => setSavingTemplate(true)}
          >
            <LayoutTemplateIcon /> Save as template
          </Button>
          <SaveTemplateDialog
            kind="project"
            sourceId={project.id}
            defaultName={project.name}
            open={savingTemplate}
            onOpenChange={setSavingTemplate}
          />
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-6 px-1.5 text-xs', workspace.role === 'guest' && 'ml-auto')}
        onClick={() => update({ archivedAt: project.archivedAt ? null : new Date().toISOString() })}
      >
        {project.archivedAt ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
        {project.archivedAt ? 'Unarchive' : 'Archive'}
      </Button>
    </div>
  );

  if (search.tab === 'updates') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ViewHeader
          title={project.name}
          icon={
            <ProjectStatusIcon status={project.status} progress={progress} className="size-4" />
          }
        >
          <FavoriteButton kind="project" id={project.id} />
        </ViewHeader>
        {summary}
        <ProjectUpdates project={project} />
      </div>
    );
  }

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
      milestones={milestones.data}
      subheader={
        <>
          {summary}
          <Milestones project={project} tasks={tasks.data ?? []} />
        </>
      }
      headerExtra={<FavoriteButton kind="project" id={project.id} />}
    />
  );
}
