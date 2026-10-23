import { useCustomFieldActions } from '@daiq/data';
import {
  can,
  CUSTOM_FIELD_KINDS,
  FIELD_KIND_LABEL,
  type CustomField,
  type CustomFieldKind,
  type FieldOption,
} from '@daiq/domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FieldError,
  Input,
  Label,
  Textarea,
} from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';
import { formString } from '../../../lib/forms';
import { newId } from '../../../lib/ids';

export const Route = createFileRoute('/$workspace/settings/fields')({ component: FieldsSettings });

const hasOptions = (kind: CustomFieldKind) => kind === 'select' || kind === 'multi_select';

/** One option per line; existing options keep their ids so task values survive renames. */
function parseOptions(text: string, existing: readonly FieldOption[]): FieldOption[] {
  const names = [
    ...new Set(
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
  return names.map(
    (name) => existing.find((o) => o.name === name) ?? { id: newId().slice(0, 8), name },
  );
}

function FieldsSettings() {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const actions = useCustomFieldActions(workspace.id);
  const admin = can(workspace.role, 'workspace.update');
  const [kind, setKind] = useState<CustomFieldKind>('select');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [deleting, setDeleting] = useState<CustomField | null>(null);
  const usedBy = (id: string) =>
    data.teams.filter((team) => team.fieldIds.includes(id)).map((team) => team.name);

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold font-display">Custom fields</h2>
        <p className="text-[13px] text-fg-muted">
          Fields are shared by the workspace. Each team turns on the ones it needs (up to 12) in its
          settings.
        </p>
      </header>

      {admin ? (
        <form
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const form = new FormData(event.currentTarget);
            const name = formString(form, 'name').trim();
            const options = hasOptions(kind) ? parseOptions(formString(form, 'options'), []) : [];
            if (hasOptions(kind) && options.length === 0) {
              setError('Add at least one option, one per line.');
              return;
            }
            const formElement = event.currentTarget;
            actions.create.mutate(
              { id: newId(), name, kind, options, position: data.fields.length },
              {
                onSuccess: () => formElement.reset(),
                onError: (e) => setError(e.message),
              },
            );
          }}
        >
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor="field-name">New field</Label>
              <Input id="field-name" name="name" required maxLength={60} placeholder="Severity" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="field-kind">Type</Label>
              <select
                id="field-kind"
                value={kind}
                onChange={(event) => {
                  const next = CUSTOM_FIELD_KINDS.find((k) => k === event.target.value);
                  if (next) setKind(next);
                }}
                className="h-8 rounded-md border border-border bg-surface px-2 text-[13px]"
              >
                {CUSTOM_FIELD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {FIELD_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary">
              Add field
            </Button>
          </div>
          {hasOptions(kind) && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="field-options">Options, one per line</Label>
              <Textarea
                id="field-options"
                name="options"
                rows={3}
                placeholder={'Minor\nMajor\nCritical'}
              />
            </div>
          )}
          {error && <FieldError>{error}</FieldError>}
        </form>
      ) : (
        <p className="text-[13px] text-fg-muted">Only admins can add or change fields.</p>
      )}

      {data.fields.length === 0 ? (
        <p className="text-[13px] text-fg-subtle">No custom fields yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {data.fields.map((field) => {
            const teams = usedBy(field.id);
            return (
              <li key={field.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{field.name}</span>
                  <span className="text-xs text-fg-subtle">
                    {FIELD_KIND_LABEL[field.kind]}
                    {hasOptions(field.kind) && ` · ${field.options.map((o) => o.name).join(', ')}`}
                    {' · '}
                    {teams.length ? `Used by ${teams.join(', ')}` : 'Not used by any team'}
                  </span>
                </span>
                {admin && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(field)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${field.name}`}
                      onClick={() => setDeleting(field)}
                    >
                      <Trash2Icon />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogTitle>Edit {editing?.name}</DialogTitle>
          {editing && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                actions.update.mutate({
                  id: editing.id,
                  patch: {
                    name: formString(form, 'name').trim() || editing.name,
                    ...(hasOptions(editing.kind) && {
                      options: parseOptions(formString(form, 'options'), editing.options),
                    }),
                  },
                });
                setEditing(null);
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-field-name">Name</Label>
                <Input
                  id="edit-field-name"
                  name="name"
                  defaultValue={editing.name}
                  maxLength={60}
                  autoFocus
                />
              </div>
              {hasOptions(editing.kind) && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-field-options">Options, one per line</Label>
                  <Textarea
                    id="edit-field-options"
                    name="options"
                    rows={5}
                    defaultValue={editing.options.map((o) => o.name).join('\n')}
                  />
                  <p className="text-xs text-fg-subtle">
                    Removing an option clears it from tasks that use it.
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save
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
            Its values are removed from every task, in every team. This can’t be undone.
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
              Delete field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
