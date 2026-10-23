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
import { m } from '../../../../i18n/team';

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
  const t = m.team.forms.builder;

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
        <Label htmlFor="form-name">{m.team.nameLabel}</Label>
        <Input
          id="form-name"
          value={draft.name}
          maxLength={80}
          required
          autoFocus
          placeholder={t.namePlaceholder}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="form-description">{t.intro}</Label>
        <Textarea
          id="form-description"
          rows={2}
          maxLength={1000}
          value={draft.description ?? ''}
          placeholder={t.introPlaceholder}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold">{t.audience}</legend>
        {[
          {
            value: false,
            label: t.members,
            hint: t.membersHint,
          },
          {
            value: true,
            label: m.team.forms.anyone,
            hint: workspace.isDemo ? t.demoUnavailable : t.anyoneHint,
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
        <legend className="mb-1.5 text-[13px] font-semibold">{t.questions}</legend>
        <p className="text-xs text-fg-subtle">{t.questionsHint}</p>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={draft.askPriority}
            onChange={(event) => setDraft({ ...draft, askPriority: event.target.checked })}
            className="accent-(--accent)"
          />
          {t.askPriority}
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
        <span className="text-[13px] font-semibold">{t.landIn}</span>
        <PickerPopover
          trigger={
            <Button type="button" size="sm" className="self-start">
              {team.statuses.find((s) => s.id === draft.statusId)?.name ??
                (triage ? t.triage : t.defaultStatus)}
            </Button>
          }
          options={[
            {
              value: NO_VALUE,
              label: triage ? t.triage : t.defaultStatus,
            },
            ...statusOptions(team.statuses.filter((s) => s.category !== 'triage')),
          ]}
          selected={[draft.statusId ?? NO_VALUE]}
          placeholder={t.statusPlaceholder}
          onSelect={([id]) => setDraft({ ...draft, statusId: id && id !== NO_VALUE ? id : null })}
        />
        {!triage && <p className="text-xs text-fg-subtle">{t.triageHint}</p>}
      </div>

      {error && <FieldError>{error}</FieldError>}
      <DialogFooter>
        <Button type="button" onClick={onDone}>
          {m.common.cancel}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={actions.create.isPending || actions.update.isPending}
        >
          {initial ? t.save : t.create}
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
  const t = m.team.forms;

  if (!team) {
    return <NotFoundPanel title={m.team.notFound} message={m.team.noTeam(teamKey)} />;
  }
  const canManage =
    can(workspace.role, 'workspace.update') ||
    (workspace.role !== 'guest' && team.memberIds.includes(userId));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title={t.title} icon={<ClipboardListIcon className="size-4 text-fg-muted" />}>
        {canManage && (
          <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
            <PlusIcon /> {t.new}
          </Button>
        )}
      </ViewHeader>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-6">
          <p className="text-[13px] text-fg-muted">{t.about(team.name, team.triageEnabled)}</p>
          {forms.data?.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-[13px] text-fg-subtle">
              {t.empty}
            </p>
          )}
          <ul className="flex rise-children flex-col gap-3">
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
                  aria-label={t.accept(form.name)}
                  checked={form.enabled}
                  disabled={!canManage}
                  onChange={(event) =>
                    actions.update.mutate({ id: form.id, patch: { enabled: event.target.checked } })
                  }
                  className="switch mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[13px] font-medium', !form.enabled && 'text-fg-muted')}>
                    {form.name}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {form.isPublic ? t.anyone : t.membersOnly}, {t.submissions(form.submissions)}
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
                      .then(() => toast(m.common.linkCopied, { id: 'copy' }))
                  }
                >
                  <CopyIcon /> {t.copyLink}
                </Button>
                {canManage && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(form)}>
                      {m.common.edit}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={m.team.deleteNamed(form.name)}
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
          <DialogTitle>{editing === 'new' ? t.new : t.edit}</DialogTitle>
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
          <DialogTitle>{m.team.deleteNamedTitle(deleting?.name ?? '')}</DialogTitle>
          <DialogDescription>{t.deleteHint}</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)}>{m.common.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) actions.remove.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              {t.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
