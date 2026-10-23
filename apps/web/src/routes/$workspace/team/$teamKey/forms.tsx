import { useFormActions, useForms, type FormInput } from '@daiq/data';
import { can, type IntakeForm, type Team } from '@daiq/domain';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FieldError,
  Input,
  Label,
  Textarea,
  toast,
} from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { ClipboardListIcon, CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { NotFoundPanel } from '../../../../components/not-found-panel';
import { NO_VALUE, statusOptions } from '../../../../features/pickers/options';
import { PickerPopover } from '../../../../features/pickers/picker-popover';
import { ViewHeader } from '../../../../features/shell/view-header';
import { useWorkspace, useWorkspaceData } from '../../../../features/workspace/workspace-context';

export const Route = createFileRoute('/$workspace/team/$teamKey/forms')({ component: TeamForms });

const EMPTY: FormInput = {
  name: '',
  description: null,
  isPublic: false,
  askPriority: true,
  fieldIds: [],
  statusId: null,
  enabled: true,
};

/** The link people open; the app's base path is part of it on the Pages demo. */
const formUrl = (slug: string) =>
  new URL(`${import.meta.env.BASE_URL}f/${slug}`, window.location.origin).toString();

function FormBuilder({
  team,
  initial,
  onDone,
}: {
  team: Team;
  initial: IntakeForm | null;
  onDone: () => void;
}) {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const actions = useFormActions(workspace.id, team.id);
  const [draft, setDraft] = useState<FormInput>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const fields = team.fieldIds.flatMap((id) => data.fieldsById.get(id) ?? []);
  const askable = fields.filter((f) => !(draft.isPublic && f.kind === 'person'));
  const triage = team.statuses.find((s) => s.category === 'triage');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const input = {
          ...draft,
          name: draft.name.trim(),
          description: draft.description?.trim() || null,
          fieldIds: draft.fieldIds.filter((id) => askable.some((f) => f.id === id)),
        };
        const done = { onSuccess: onDone, onError: (e: Error) => setError(e.message) };
        if (initial) actions.update.mutate({ id: initial.id, patch: input }, done);
        else actions.create.mutate(input, done);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="form-name">Name</Label>
        <Input
          id="form-name"
          value={draft.name}
          maxLength={80}
          required
          autoFocus
          placeholder="Report a bug"
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="form-description">Intro</Label>
        <Textarea
          id="form-description"
          rows={2}
          maxLength={1000}
          value={draft.description ?? ''}
          placeholder="Tell us what happened and how to reproduce it."
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold">Who can send it</legend>
        {[
          {
            value: false,
            label: 'Members of the workspace',
            hint: 'They are signed in; no email asked.',
          },
          {
            value: true,
            label: 'Anyone with the link',
            hint: workspace.isDemo
              ? 'Not available in the demo.'
              : 'People leave their email. Limited to 5 submissions per person every 10 minutes.',
          },
        ].map((option) => (
          <label key={option.label} className="flex items-start gap-2 text-[13px]">
            <input
              type="radio"
              name="form-audience"
              checked={draft.isPublic === option.value}
              disabled={option.value && workspace.isDemo}
              onChange={() => setDraft({ ...draft, isPublic: option.value })}
              className="mt-0.5 accent-(--accent)"
            />
            <span>
              {option.label}
              <span className="block text-xs text-fg-subtle">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold">Questions</legend>
        <p className="text-xs text-fg-subtle">A subject and details are always asked.</p>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={draft.askPriority}
            onChange={(event) => setDraft({ ...draft, askPriority: event.target.checked })}
            className="accent-(--accent)"
          />
          How urgent is it (priority)
        </label>
        {askable.map((field) => (
          <label key={field.id} className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={draft.fieldIds.includes(field.id)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  fieldIds: event.target.checked
                    ? [...draft.fieldIds, field.id]
                    : draft.fieldIds.filter((id) => id !== field.id),
                })
              }
              className="accent-(--accent)"
            />
            {field.name}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">New tasks land in</span>
        <PickerPopover
          trigger={
            <Button type="button" size="sm" className="self-start">
              {team.statuses.find((s) => s.id === draft.statusId)?.name ??
                (triage ? 'Triage' : 'The team’s default status')}
            </Button>
          }
          options={[
            {
              value: NO_VALUE,
              label: triage ? 'Triage' : 'The team’s default status',
            },
            ...statusOptions(team.statuses.filter((s) => s.category !== 'triage')),
          ]}
          selected={[draft.statusId ?? NO_VALUE]}
          placeholder="Status…"
          onSelect={([id]) => setDraft({ ...draft, statusId: id && id !== NO_VALUE ? id : null })}
        />
        {!triage && (
          <p className="text-xs text-fg-subtle">
            Turn on Triage in team settings to review requests first.
          </p>
        )}
      </div>

      {error && <FieldError>{error}</FieldError>}
      <DialogFooter>
        <Button type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={actions.create.isPending || actions.update.isPending}
        >
          {initial ? 'Save form' : 'Create form'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TeamForms() {
  const { teamKey } = Route.useParams();
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const team = data.teamsByKey.get(teamKey);
  const forms = useForms(team?.id);
  const actions = useFormActions(workspace.id, team?.id ?? '');
  const [editing, setEditing] = useState<IntakeForm | 'new' | null>(null);
  const [deleting, setDeleting] = useState<IntakeForm | null>(null);

  if (!team) {
    return (
      <NotFoundPanel title="Team not found" message={`There is no team with the key ${teamKey}.`} />
    );
  }
  const canManage =
    can(workspace.role, 'workspace.update') ||
    (workspace.role !== 'guest' && team.memberIds.includes(userId));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title="Forms" icon={<ClipboardListIcon className="size-4 text-fg-muted" />}>
        {canManage && (
          <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
            <PlusIcon /> New form
          </Button>
        )}
      </ViewHeader>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-6">
          <p className="text-[13px] text-fg-muted">
            Forms turn requests into {team.name} tasks. Share the link; every submission arrives as
            a task{team.triageEnabled ? ' in Triage' : ''}, with the sender recorded in its
            activity.
          </p>
          {forms.data?.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-[13px] text-fg-subtle">
              No forms yet.
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {forms.data?.map((form) => (
              <li
                key={form.id}
                aria-label={form.name}
                className="flex items-start gap-3 rounded-lg border border-border p-4"
              >
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={form.enabled}
                  aria-label={`Accept submissions to ${form.name}`}
                  checked={form.enabled}
                  disabled={!canManage}
                  onChange={(event) =>
                    actions.update.mutate({ id: form.id, patch: { enabled: event.target.checked } })
                  }
                  className="mt-1 accent-(--accent)"
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[13px] font-medium', !form.enabled && 'text-fg-muted')}>
                    {form.name}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {form.isPublic ? 'Anyone with the link' : 'Members only'},{' '}
                    {form.submissions === 1 ? '1 submission' : `${form.submissions} submissions`}
                  </p>
                  <code className="mt-1 block truncate text-xs text-fg-subtle">
                    {formUrl(form.slug)}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(formUrl(form.slug))
                      .then(() => toast('Link copied', { id: 'copy' }))
                  }
                >
                  <CopyIcon /> Copy link
                </Button>
                {canManage && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(form)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${form.name}`}
                      onClick={() => setDeleting(form)}
                    >
                      <Trash2Icon />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogTitle>{editing === 'new' ? 'New form' : 'Edit form'}</DialogTitle>
          {editing !== null && (
            <FormBuilder
              team={team}
              initial={editing === 'new' ? null : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          <DialogDescription>Its link stops working. Tasks it created stay.</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) actions.remove.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Delete form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
