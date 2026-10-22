import { useCreateProject, useTasks } from '@daiq/data';
import { formatDueDate, isClosedCategory, type ProjectStatus } from '@daiq/domain';
import { useToday } from '../../../../lib/use-today';
import {
  Avatar,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  FieldError,
  Input,
  Label,
} from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FolderIcon, PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NotFoundPanel } from '../../../../components/not-found-panel';
import { TeamBadge } from '../../../../components/team-badge';
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  ProjectStatusIcon,
  progressOf,
} from '../../../../features/projects/project-status';
import { ViewHeader } from '../../../../features/shell/view-header';
import { useWorkspace, useWorkspaceData } from '../../../../features/workspace/workspace-context';
import { formString } from '../../../../lib/forms';
import { newId } from '../../../../lib/ids';

export const Route = createFileRoute('/$workspace/team/$teamKey/projects')({
  component: TeamProjects,
});

function TeamProjects() {
  const { teamKey } = Route.useParams();
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const team = data.teamsByKey.get(teamKey);
  const tasks = useTasks(team ? { kind: 'team', id: team.id } : null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const today = useToday();

  const counts = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const task of tasks.data ?? []) {
      if (!task.projectId) continue;
      const category = data.statuses.get(task.statusId)?.category;
      if (category === 'canceled') continue;
      const entry = map.get(task.projectId) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (category && isClosedCategory(category)) entry.done += 1;
      map.set(task.projectId, entry);
    }
    return map;
  }, [tasks.data, data.statuses]);

  if (!team)
    return (
      <NotFoundPanel title="Team not found" message={`There is no team with the key ${teamKey}.`} />
    );
  const projects = data.projects.filter(
    (p) => p.teamId === team.id && (showArchived || !p.archivedAt),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title={`${team.name} projects`} icon={<TeamBadge teamKey={team.key} />}>
        <label className="mr-2 flex items-center gap-1.5 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="accent-(--accent)"
          />
          Show archived
        </label>
        <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
          <PlusIcon /> New project
        </Button>
      </ViewHeader>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {projects.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-6 py-16">
            <FolderIcon className="size-5 text-fg-subtle" aria-hidden />
            <p className="font-medium">No projects yet</p>
            <p className="max-w-md text-[13px] text-fg-muted">
              Projects group tasks around an outcome with a lead and a target date. Tasks without a
              project stay in the team backlog.
            </p>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              Create a project
            </Button>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="sr-only sm:not-sr-only">
              <tr className="border-b border-border text-left text-xs text-fg-subtle">
                <th className="px-4 py-2 font-normal">Name</th>
                <th className="hidden px-2 py-2 font-normal md:table-cell">Lead</th>
                <th className="hidden px-2 py-2 font-normal md:table-cell">Target</th>
                <th className="px-4 py-2 text-right font-normal">Progress</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const count = counts.get(project.id) ?? { done: 0, total: 0 };
                const progress = progressOf(count);
                const lead = project.leadId ? data.membersById.get(project.leadId) : undefined;
                return (
                  <tr
                    key={project.id}
                    className="border-b border-border/60 hover:bg-surface-subtle"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to="/$workspace/project/$projectId"
                        params={{ workspace: workspace.slug, projectId: project.id }}
                        className="flex items-center gap-2 font-medium"
                      >
                        <ProjectStatusIcon status={project.status} progress={progress} />
                        <span className="truncate">{project.name}</span>
                        <span className="text-xs font-normal text-fg-subtle">
                          {PROJECT_STATUS_LABEL[project.status]}
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-2 py-2.5 md:table-cell">
                      {lead ? (
                        <span className="flex items-center gap-1.5 text-fg-muted">
                          <Avatar name={lead.displayName} size="xs" /> {lead.displayName}
                        </span>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="hidden px-2 py-2.5 text-fg-muted tabular md:table-cell">
                      {project.targetDate ? formatDueDate(project.targetDate, today) : '—'}
                    </td>
                    <td
                      className="px-4 py-2.5"
                      aria-label={`${Math.round(progress * 100)}% complete`}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-fg-subtle tabular">
                          {Math.round(progress * 100)}%
                        </span>
                        <span
                          className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted"
                          aria-hidden
                        >
                          <span
                            className="block h-full rounded-full bg-status-completed"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <NewProjectDialog teamId={team.id} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function NewProjectDialog({
  teamId,
  open,
  onOpenChange,
}: {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspace, userId } = useWorkspace();
  const createProject = useCreateProject(workspace.id);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New project</DialogTitle>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const status = formString(form, 'status');
            createProject.mutate(
              {
                id: newId(),
                teamId,
                name: formString(form, 'name').trim(),
                status:
                  PROJECT_STATUSES.find((s) => s === status) ?? ('planned' satisfies ProjectStatus),
                leadId: userId,
                targetDate: formString(form, 'target') || null,
              },
              { onSuccess: () => onOpenChange(false), onError: (e) => setError(e.message) },
            );
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              name="name"
              required
              maxLength={120}
              autoFocus
              placeholder="Launch v2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-status">Status</Label>
              <select
                id="project-status"
                name="status"
                defaultValue="planned"
                className="h-8 rounded-md border border-border bg-surface px-2 text-[13px]"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-target">Target date</Label>
              <Input id="project-target" name="target" type="date" />
            </div>
          </div>
          <p className="text-xs text-fg-subtle">
            You’ll be the project lead. You can change it later.
          </p>
          {error && <FieldError>{error}</FieldError>}
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createProject.isPending}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
