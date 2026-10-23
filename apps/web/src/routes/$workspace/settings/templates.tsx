import { useTemplateActions, useTemplates } from '@daiq/data';
import { can, type Template } from '@daiq/domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Input,
  Label,
} from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { FolderIcon, ListChecksIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { TeamBadge } from '../../../components/team-badge';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';
import { formString } from '../../../lib/forms';

export const Route = createFileRoute('/$workspace/settings/templates')({
  component: TemplatesSettings,
});

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function contents(template: Template): string {
  const { subtasks, milestones, tasks } = template.counts;
  if (template.kind === 'task')
    return subtasks ? `Task with ${plural(subtasks, 'sub-task')}` : 'Task';
  return `Project with ${plural(milestones, 'milestone')} and ${plural(tasks, 'task')}`;
}

function TemplatesSettings() {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const templates = useTemplates(workspace.id);
  const actions = useTemplateActions(workspace.id);
  const [renaming, setRenaming] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const canManage = (t: Template) =>
    t.createdBy === userId || can(workspace.role, 'workspace.update');
  const teams = data.teams.filter((team) => templates.data?.some((t) => t.teamId === team.id));

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold font-display">Templates</h2>
        <p className="text-[13px] text-fg-muted">
          Save a task or a project as a template from its menu. Use task templates from the new task
          dialog and project templates when you create a project.
        </p>
      </header>

      {templates.data?.length === 0 && (
        <p className="text-[13px] text-fg-subtle">
          No templates yet. Open a task or a project and choose Save as template.
        </p>
      )}

      {teams.map((team) => (
        <div key={team.id} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TeamBadge teamKey={team.key} /> {team.name}
          </h3>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {templates.data
              ?.filter((t) => t.teamId === team.id)
              .map((template) => (
                <li key={template.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                  {template.kind === 'task' ? (
                    <ListChecksIcon aria-hidden className="size-4 shrink-0 text-fg-muted" />
                  ) : (
                    <FolderIcon aria-hidden className="size-4 shrink-0 text-fg-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{template.name}</span>
                    <span className="text-xs text-fg-subtle">
                      {contents(template)}
                      {template.createdBy &&
                        `, saved by ${data.membersById.get(template.createdBy)?.displayName ?? 'a former member'}`}
                    </span>
                  </span>
                  {canManage(template) && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setRenaming(template)}>
                        Rename
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${template.name}`}
                        onClick={() => setDeleting(template)}
                      >
                        <Trash2Icon />
                      </Button>
                    </>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogTitle>Rename template</DialogTitle>
          {renaming && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const name = formString(new FormData(event.currentTarget), 'name').trim();
                if (name) actions.rename.mutate({ id: renaming.id, name });
                setRenaming(null);
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rename-template">Name</Label>
                <Input
                  id="rename-template"
                  name="name"
                  defaultValue={renaming.name}
                  maxLength={80}
                  required
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setRenaming(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Rename
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          <DialogDescription>
            Tasks and projects already created from it stay as they are.
          </DialogDescription>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) actions.remove.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Delete template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
