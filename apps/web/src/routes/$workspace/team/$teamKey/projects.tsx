import {
  useCreateProject,
  useLatestProjectUpdates,
  useTasks,
  useTemplateActions,
  useTemplates,
} from '@daiq/data';
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
  Select,
} from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FolderIcon, PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NotFoundPanel } from '../../../../components/not-found-panel';
import { TeamBadge } from '../../../../components/team-badge';
import {
  HealthBadge,
  PROJECT_STATUSES,
  ProjectStatusIcon,
  progressOf,
} from '../../../../features/projects/project-status';
import { ViewHeader } from '../../../../features/shell/view-header';
import { DateField } from '../../../../features/tasks/task-actions';
import { useWorkspace, useWorkspaceData } from '../../../../features/workspace/workspace-context';
import { m } from '../../../../i18n/team';
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
  const latest = useLatestProjectUpdates(workspace.id);
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

  if (!team) return <NotFoundPanel title={m.team.notFound} message={m.team.noTeam(teamKey)} />;
  const t = m.team.projects;
  const projects = data.projects.filter(
    (p) => p.teamId === team.id && (showArchived || !p.archivedAt),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title={t.title(team.name)} icon={<TeamBadge teamKey={team.key} />}>
        <label className="mr-2 flex items-center gap-1.5 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="switch"
          />
          {t.showArchived}
        </label>
        <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
          <PlusIcon /> {t.new}
        </Button>
      </ViewHeader>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {projects.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-6 py-16">
            <FolderIcon className="size-5 text-fg-subtle" aria-hidden />
            <p className="font-medium">{t.empty}</p>
            <p className="max-w-md text-[13px] text-fg-muted">{t.emptyHint}</p>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              {t.createFirst}
            </Button>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="sr-only sm:not-sr-only">
              <tr className="border-b border-border text-left text-xs text-fg-subtle">
                <th className="px-4 py-2 font-normal">{t.columns.name}</th>
                <th className="hidden px-2 py-2 font-normal md:table-cell">{t.columns.lead}</th>
                <th className="hidden px-2 py-2 font-normal md:table-cell">{t.columns.target}</th>
                <th className="hidden px-2 py-2 font-normal sm:table-cell">{t.columns.health}</th>
                <th className="px-4 py-2 text-right font-normal">{t.columns.progress}</th>
              </tr>
            </thead>
            <tbody className="rise-children">
              {projects.map((project) => {
                const count = counts.get(project.id) ?? { done: 0, total: 0 };
                const progress = progressOf(count);
                const lead = project.leadId ? data.membersById.get(project.leadId) : undefined;
                const health = latest.data?.get(project.id)?.health;
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
                          {m.team.projectStatus[project.status]}
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
                    <td className="hidden px-2 py-2.5 sm:table-cell">
                      {health ? (
                        <HealthBadge health={health} />
                      ) : (
                        <span className="text-xs text-fg-subtle">{t.noUpdates}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" aria-label={t.complete(Math.round(progress * 100))}>
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

/** A date picker that submits with its form under `name`. */
function FormDate({
  name,
  label,
  defaultValue = null,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
}) {
  const [date, setDate] = useState(defaultValue);
  return (
    <>
      <DateField label={label} value={date} onChange={setDate} variant="secondary" />
      <input type="hidden" name={name} value={date ?? ''} />
    </>
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
  const { createProject: createFromTemplate } = useTemplateActions(workspace.id);
  const templates = (useTemplates(workspace.id).data ?? []).filter(
    (t) => t.kind === 'project' && t.teamId === teamId,
  );
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const today = useToday();
  const t = m.team.projects.dialog;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{m.team.projects.new}</DialogTitle>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const status = formString(form, 'status');
            const handlers = {
              onSuccess: () => onOpenChange(false),
              onError: (e: Error) => setError(e.message),
            };
            if (templateId) {
              if (!formString(form, 'start')) {
                setError(t.chooseStart);
                return;
              }
              createFromTemplate.mutate(
                {
                  templateId,
                  name: formString(form, 'name').trim(),
                  startDate: formString(form, 'start') || null,
                },
                handlers,
              );
              return;
            }
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
              handlers,
            );
          }}
        >
          {templates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-template">{t.template}</Label>
              <Select
                id="project-template"
                value={templateId}
                onValueChange={setTemplateId}
                options={[
                  { value: '', label: t.noTemplate },
                  ...templates.map((tpl) => ({
                    value: tpl.id,
                    label: t.templateOption(tpl.name, tpl.counts.milestones, tpl.counts.tasks),
                  })),
                ]}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">{m.team.nameLabel}</Label>
            <Input
              id="project-name"
              name="name"
              required
              maxLength={120}
              autoFocus
              placeholder={t.namePlaceholder}
            />
          </div>
          {templateId ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">{m.team.startDate}</span>
              <FormDate name="start" label={m.team.startDate} defaultValue={today} />
              <p className="text-xs text-fg-subtle">{t.startHint}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-status">{t.status}</Label>
                <Select
                  id="project-status"
                  name="status"
                  defaultValue="planned"
                  options={PROJECT_STATUSES.map((s) => ({
                    value: s,
                    label: m.team.projectStatus[s],
                  }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">{m.team.targetDate}</span>
                <FormDate name="target" label={m.team.targetDate} />
              </div>
            </div>
          )}
          <p className="text-xs text-fg-subtle">{t.leadHint}</p>
          {error && <FieldError>{error}</FieldError>}
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              {m.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createProject.isPending || createFromTemplate.isPending}
            >
              {t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
