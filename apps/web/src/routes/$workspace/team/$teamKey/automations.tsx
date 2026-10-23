import {
  useAutomationActions,
  useAutomationRuns,
  useAutomations,
  useTasks,
  useTemplates,
  useWebhooks,
} from '@daiq/data';
import {
  ACTION_LABEL,
  automationInputSchema,
  can,
  emptyAction,
  formatIdentifier,
  PRIORITY_LABEL,
  STATUS_CATEGORIES,
  STATUS_CATEGORY_LABEL,
  TRIGGER_LABEL,
  isPriority,
  type Automation,
  type AutomationActionKind,
  type AutomationConditions,
  type AutomationTriggerKind,
  type Team,
} from '@daiq/domain';
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
} from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckIcon, PlusIcon, Trash2Icon, WorkflowIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { NotFoundPanel } from '../../../../components/not-found-panel';
import {
  labelOptions,
  memberOptions,
  NO_VALUE,
  priorityOptions,
  projectOptions,
  statusOptions,
} from '../../../../features/pickers/options';
import type { PickerOption } from '../../../../features/pickers/picker-list';
import { PickerPopover } from '../../../../features/pickers/picker-popover';
import { ViewHeader } from '../../../../features/shell/view-header';
import { StatusIcon } from '../../../../features/tasks/icons';
import {
  useWorkspace,
  useWorkspaceData,
  type WorkspaceData,
} from '../../../../features/workspace/workspace-context';
import { timeAgo } from '../../../../lib/time';

export const Route = createFileRoute('/$workspace/team/$teamKey/automations')({
  component: TeamAutomations,
});

type Fields = Record<string, unknown>;
interface Draft {
  name: string;
  trigger: Fields & { kind: AutomationTriggerKind };
  conditions: AutomationConditions;
  actions: (Fields & { kind: AutomationActionKind })[];
}

const NEW_DRAFT: Draft = {
  name: '',
  trigger: { kind: 'task_created' },
  conditions: {},
  actions: [{ kind: 'assign' }],
};

const TRIGGER_KINDS = Object.keys(TRIGGER_LABEL).filter((k): k is AutomationTriggerKind =>
  Object.hasOwn(TRIGGER_LABEL, k),
);
const ACTION_KINDS = Object.keys(ACTION_LABEL).filter((k): k is AutomationActionKind =>
  Object.hasOwn(ACTION_LABEL, k),
);
const list = (values: string[]) => (values.length ? values : undefined);
const str = (value: unknown) => (typeof value === 'string' ? value : undefined);
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/** A compact select built on the property picker. */
function Choice({
  label,
  options,
  selected,
  multiple = false,
  empty,
  onChange,
}: {
  label: string;
  options: readonly PickerOption[];
  selected: readonly string[];
  multiple?: boolean;
  empty: string;
  onChange: (values: string[]) => void;
}) {
  const names = selected.flatMap((v) => options.find((o) => o.value === v)?.label ?? []);
  return (
    <PickerPopover
      trigger={
        <Button type="button" size="sm" aria-label={`${label}: ${names.join(', ') || empty}`}>
          <span className={cn('max-w-48 truncate', names.length === 0 && 'text-fg-subtle')}>
            {names.join(', ') || empty}
          </span>
        </Button>
      }
      options={options}
      selected={selected}
      multiple={multiple}
      placeholder={`${label}…`}
      onSelect={onChange}
    />
  );
}

function DaysInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: unknown;
  max: number;
  onChange: (days: number) => void;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-fg-muted">
      <Input
        type="number"
        aria-label={label}
        min={0}
        max={max}
        value={typeof value === 'number' ? value : 0}
        onChange={(event) => onChange(Math.min(max, Math.max(0, event.target.valueAsNumber || 0)))}
        className="h-8 w-16"
      />
      {label}
    </span>
  );
}

const categoryOptions: PickerOption[] = STATUS_CATEGORIES.map((category) => ({
  value: category,
  label: STATUS_CATEGORY_LABEL[category],
  icon: <StatusIcon category={category} />,
}));

/** Readable sentence for the list (the builder shows the same parts as controls). */
function describe(automation: Automation, team: Team, data: WorkspaceData): string {
  const status = (id: string | undefined) =>
    team.statuses.find((s) => s.id === id)?.name ?? 'a status';
  const person = (id: string | undefined) =>
    data.membersById.get(id ?? '')?.displayName ?? 'someone';
  const label = (id: string | undefined) => data.labelsById.get(id ?? '')?.name ?? 'a label';
  const project = (id: string | null | undefined) =>
    id ? (data.projectsById.get(id)?.name ?? 'a project') : 'no project';
  const t = automation.trigger;
  const when =
    t.kind === 'status_changed' && (t.status_id || t.category)
      ? `the status changes to ${t.status_id ? status(t.status_id) : STATUS_CATEGORY_LABEL[t.category ?? 'started']}`
      : t.kind === 'priority_changed' && t.priority !== undefined && isPriority(t.priority)
        ? `the priority changes to ${PRIORITY_LABEL[t.priority]}`
        : t.kind === 'assignee_added' && t.user_id
          ? `${person(t.user_id)} is assigned`
          : t.kind === 'moved_to_project' && t.project_id
            ? `a task moves to ${project(t.project_id)}`
            : t.kind === 'due_approaching'
              ? t.days === 0
                ? 'a task is due today'
                : `a task is due in ${t.days} day${t.days === 1 ? '' : 's'}`
              : TRIGGER_LABEL[t.kind].charAt(0).toLowerCase() + TRIGGER_LABEL[t.kind].slice(1);
  const c = automation.conditions;
  const ifs = [
    c.priorities?.length &&
      `priority is ${c.priorities.map((p) => (isPriority(p) ? PRIORITY_LABEL[p] : p)).join(' or ')}`,
    c.categories?.length &&
      `status is ${c.categories.map((k) => STATUS_CATEGORY_LABEL[k]).join(' or ')}`,
    c.label_ids?.length && `labelled ${c.label_ids.map(label).join(' or ')}`,
    c.project_ids?.length &&
      `in ${c.project_ids.map((id) => project(id === 'none' ? null : id)).join(' or ')}`,
    c.assignee && (c.assignee === 'none' ? 'unassigned' : 'assigned'),
  ].filter(Boolean);
  const thens = automation.actions.map((a) => {
    switch (a.kind) {
      case 'set_status':
        return `set status to ${status(a.status_id)}`;
      case 'set_priority':
        return `set priority to ${isPriority(a.priority) ? PRIORITY_LABEL[a.priority] : a.priority}`;
      case 'assign':
        return `assign ${person(a.user_id)}`;
      case 'unassign':
        return 'remove assignees';
      case 'add_label':
        return `add ${label(a.label_id)}`;
      case 'remove_label':
        return `remove ${label(a.label_id)}`;
      case 'set_project':
        return `move to ${project(a.project_id)}`;
      case 'set_due_date':
        return a.days === 0 ? 'make it due today' : `make it due in ${a.days} days`;
      case 'create_subtask':
        return 'add sub-tasks from a template';
      case 'notify':
        return `notify ${a.user_ids.map(person).join(', ')}`;
      case 'call_webhook':
        return 'call a webhook';
      default:
        return a satisfies never;
    }
  });
  return `When ${when}${ifs.length ? `, if ${ifs.join(' and ')}` : ''}, ${thens.join(', then ')}.`;
}

function RunLog({ automation, team }: { automation: Automation; team: Team }) {
  const { workspace } = useWorkspace();
  const runs = useAutomationRuns(automation.id);
  const tasks = useTasks({ kind: 'team', id: team.id });
  if (runs.isPending) return <p className="text-xs text-fg-subtle">Loading runs…</p>;
  if (!runs.data?.length) return <p className="text-xs text-fg-subtle">No runs yet.</p>;
  return (
    <ol className="flex max-h-64 flex-col gap-1 overflow-y-auto text-xs scrollbar-thin">
      {runs.data.map((run) => {
        const task = tasks.data?.find((t) => t.id === run.taskId);
        return (
          <li key={run.id} className="flex items-start gap-2">
            {run.status === 'succeeded' ? (
              <CheckIcon
                aria-label="Succeeded"
                className="mt-0.5 size-3.5 shrink-0 text-accent-text"
              />
            ) : (
              <XIcon aria-label="Failed" className="mt-0.5 size-3.5 shrink-0 text-danger" />
            )}
            <span className="min-w-0 flex-1">
              {task?.number ? (
                <Link
                  to="/$workspace/task/$identifier"
                  params={{
                    workspace: workspace.slug,
                    identifier: formatIdentifier(team.key, task.number),
                  }}
                  className="font-medium hover:underline"
                >
                  {formatIdentifier(team.key, task.number)} {task.title}
                </Link>
              ) : (
                <span className="text-fg-subtle">A deleted task</span>
              )}
              {run.error && <span className="block text-danger">{run.error}</span>}
            </span>
            <time dateTime={run.createdAt} className="shrink-0 text-fg-subtle">
              {timeAgo(run.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

function Builder({
  team,
  initial,
  onDone,
}: {
  team: Team;
  initial: Automation | null;
  onDone: () => void;
}) {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const actions = useAutomationActions(workspace.id, team.id);
  // Only admins can list webhooks; everyone else gets an empty list.
  const webhooks = (
    useWebhooks(workspace.id, can(workspace.role, 'workspace.update')).data ?? []
  ).filter((hook) => hook.enabled);
  const templates = (useTemplates(workspace.id).data ?? []).filter(
    (t) => t.kind === 'task' && t.teamId === team.id,
  );
  const [draft, setDraft] = useState<Draft>(() =>
    initial
      ? {
          name: initial.name,
          trigger: initial.trigger,
          conditions: initial.conditions,
          actions: initial.actions,
        }
      : NEW_DRAFT,
  );
  const [error, setError] = useState<string | null>(null);
  const members = memberOptions(data.members, userId);
  const projects = projectOptions(data.projects.filter((p) => p.teamId === team.id));
  const statuses = statusOptions(team.statuses);
  const setTrigger = (patch: Fields) =>
    setDraft({ ...draft, trigger: { ...draft.trigger, ...patch } });
  const setConditions = (patch: AutomationConditions) =>
    setDraft({ ...draft, conditions: { ...draft.conditions, ...patch } });
  const setAction = (index: number, patch: Fields) =>
    setDraft({
      ...draft,
      actions: draft.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    });
  const t = draft.trigger;

  const triggerParam = () => {
    switch (t.kind) {
      case 'status_changed':
        return (
          <Choice
            label="To"
            empty="to any status"
            options={[...categoryOptions, ...statuses]}
            selected={[str(t.status_id) ?? str(t.category) ?? ''].filter(Boolean)}
            onChange={([value]) =>
              setDraft({
                ...draft,
                trigger: STATUS_CATEGORIES.some((c) => c === value)
                  ? { kind: 'status_changed', category: value }
                  : value
                    ? { kind: 'status_changed', status_id: value }
                    : { kind: 'status_changed' },
              })
            }
          />
        );
      case 'priority_changed':
        return (
          <Choice
            label="To priority"
            empty="to any priority"
            options={priorityOptions()}
            selected={typeof t.priority === 'number' ? [String(t.priority)] : []}
            onChange={([value]) => setTrigger({ priority: value ? Number(value) : undefined })}
          />
        );
      case 'assignee_added':
        return (
          <Choice
            label="Person"
            empty="anyone"
            options={members}
            selected={[str(t.user_id) ?? ''].filter(Boolean)}
            onChange={([value]) => setTrigger({ user_id: value })}
          />
        );
      case 'moved_to_project':
        return (
          <Choice
            label="Project"
            empty="any project"
            options={projects.filter((o) => o.value !== NO_VALUE)}
            selected={[str(t.project_id) ?? ''].filter(Boolean)}
            onChange={([value]) => setTrigger({ project_id: value })}
          />
        );
      case 'due_approaching':
        return (
          <DaysInput
            label="days before"
            value={t.days}
            max={30}
            onChange={(days) => setTrigger({ days })}
          />
        );
      case 'task_created':
      case 'comment_added':
        return null;
    }
  };

  const actionParam = (action: Draft['actions'][number], index: number) => {
    switch (action.kind) {
      case 'set_status':
        return (
          <Choice
            label="Status"
            empty="Choose a status"
            options={statuses}
            selected={[str(action.status_id) ?? ''].filter(Boolean)}
            onChange={([value]) => setAction(index, { status_id: value })}
          />
        );
      case 'set_priority':
        return (
          <Choice
            label="Priority"
            empty="Choose a priority"
            options={priorityOptions()}
            selected={typeof action.priority === 'number' ? [String(action.priority)] : []}
            onChange={([value]) => setAction(index, { priority: Number(value ?? 0) })}
          />
        );
      case 'assign':
        return (
          <Choice
            label="Person"
            empty="Choose someone"
            options={members}
            selected={[str(action.user_id) ?? ''].filter(Boolean)}
            onChange={([value]) => setAction(index, { user_id: value })}
          />
        );
      case 'add_label':
      case 'remove_label':
        return (
          <Choice
            label="Label"
            empty="Choose a label"
            options={labelOptions(data.labels)}
            selected={[str(action.label_id) ?? ''].filter(Boolean)}
            onChange={([value]) => setAction(index, { label_id: value })}
          />
        );
      case 'set_project':
        return (
          <Choice
            label="Project"
            empty="No project"
            options={projects}
            selected={[str(action.project_id) ?? NO_VALUE]}
            onChange={([value]) =>
              setAction(index, { project_id: value && value !== NO_VALUE ? value : null })
            }
          />
        );
      case 'set_due_date':
        return (
          <DaysInput
            label="days later"
            value={action.days}
            max={365}
            onChange={(days) => setAction(index, { days })}
          />
        );
      case 'create_subtask':
        return (
          <Choice
            label="Template"
            empty={templates.length ? 'Choose a template' : 'No task templates yet'}
            options={templates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
            selected={[str(action.template_id) ?? ''].filter(Boolean)}
            onChange={([value]) => setAction(index, { template_id: value })}
          />
        );
      case 'notify':
        return (
          <Choice
            label="People"
            empty="Choose people"
            multiple
            options={members}
            selected={strings(action.user_ids)}
            onChange={(values) => setAction(index, { user_ids: values })}
          />
        );
      case 'call_webhook':
        return (
          <Choice
            label="Webhook"
            empty={
              webhooks.length ? 'Choose a webhook' : 'No webhooks (admins add them in Settings)'
            }
            options={webhooks.map((hook) => ({ value: hook.id, label: hook.name }))}
            selected={[str(action.webhook_id) ?? ''].filter(Boolean)}
            onChange={([value]) => setAction(index, { webhook_id: value })}
          />
        );
      case 'unassign':
        return null;
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = automationInputSchema.safeParse(draft);
        if (!parsed.success) {
          setError(
            draft.name.trim()
              ? 'Complete every part of the sentence: each action needs its value.'
              : 'Give the automation a name.',
          );
          return;
        }
        const done = { onSuccess: onDone, onError: (e: Error) => setError(e.message) };
        if (initial) actions.update.mutate({ id: initial.id, patch: parsed.data }, done);
        else actions.create.mutate(parsed.data, done);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="automation-name">Name</Label>
        <Input
          id="automation-name"
          value={draft.name}
          maxLength={80}
          placeholder="Triage urgent bugs"
          autoFocus
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold">When</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Choice
            label="Trigger"
            empty="Choose a trigger"
            options={TRIGGER_KINDS.map((kind) => ({ value: kind, label: TRIGGER_LABEL[kind] }))}
            selected={[t.kind]}
            onChange={([kind]) => {
              const next = TRIGGER_KINDS.find((k) => k === kind);
              if (next)
                setDraft({
                  ...draft,
                  trigger: next === 'due_approaching' ? { kind: next, days: 1 } : { kind: next },
                });
            }}
          />
          {triggerParam()}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold">If</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Choice
            label="Priority"
            empty="Any priority"
            multiple
            options={priorityOptions()}
            selected={(draft.conditions.priorities ?? []).map(String)}
            onChange={(values) => setConditions({ priorities: list(values)?.map(Number) })}
          />
          <Choice
            label="Status"
            empty="Any status"
            multiple
            options={categoryOptions}
            selected={draft.conditions.categories ?? []}
            onChange={(values) =>
              setConditions({
                categories: list(
                  values.filter((v) => STATUS_CATEGORIES.some((c) => c === v)),
                )?.flatMap((v) => STATUS_CATEGORIES.filter((c) => c === v)),
              })
            }
          />
          <Choice
            label="Labels"
            empty="Any labels"
            multiple
            options={labelOptions(data.labels)}
            selected={draft.conditions.label_ids ?? []}
            onChange={(values) => setConditions({ label_ids: list(values) })}
          />
          <Choice
            label="Project"
            empty="Any project"
            multiple
            options={projects}
            selected={(draft.conditions.project_ids ?? []).map((id) =>
              id === 'none' ? NO_VALUE : id,
            )}
            onChange={(values) =>
              setConditions({ project_ids: list(values.map((v) => (v === NO_VALUE ? 'none' : v))) })
            }
          />
          <Choice
            label="Assignment"
            empty="Assigned or not"
            options={[
              { value: 'any', label: 'Assigned' },
              { value: 'none', label: 'Unassigned' },
            ]}
            selected={draft.conditions.assignee ? [draft.conditions.assignee] : []}
            onChange={([value]) =>
              setConditions({ assignee: value === 'any' || value === 'none' ? value : undefined })
            }
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold">Then</legend>
        <ol className="flex flex-col gap-2">
          {draft.actions.map((action, index) => (
            // Actions have no identity of their own; their position is it.
            // oxlint-disable-next-line react/no-array-index-key
            <li key={index} className="flex flex-wrap items-center gap-2">
              <Choice
                label={`Action ${index + 1}`}
                empty="Choose an action"
                options={ACTION_KINDS.map((kind) => ({ value: kind, label: ACTION_LABEL[kind] }))}
                selected={[action.kind]}
                onChange={([kind]) => {
                  const next = ACTION_KINDS.find((k) => k === kind);
                  if (next)
                    setDraft({
                      ...draft,
                      actions: draft.actions.map((a, i) =>
                        i === index ? { ...emptyAction(next), kind: next } : a,
                      ),
                    });
                }}
              />
              {actionParam(action, index)}
              {draft.actions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove action ${index + 1}`}
                  onClick={() =>
                    setDraft({ ...draft, actions: draft.actions.filter((_, i) => i !== index) })
                  }
                >
                  <XIcon />
                </Button>
              )}
            </li>
          ))}
        </ol>
        {draft.actions.length < 3 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() =>
              setDraft({
                ...draft,
                actions: [...draft.actions, { kind: 'set_priority', priority: 2 }],
              })
            }
          >
            <PlusIcon /> Add action
          </Button>
        )}
      </fieldset>

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
          {initial ? 'Save automation' : 'Create automation'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TeamAutomations() {
  const { teamKey } = Route.useParams();
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const team = data.teamsByKey.get(teamKey);
  const automations = useAutomations(team?.id);
  const actions = useAutomationActions(workspace.id, team?.id ?? '');
  const [editing, setEditing] = useState<Automation | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Automation | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  if (!team) {
    return (
      <NotFoundPanel title="Team not found" message={`There is no team with the key ${teamKey}.`} />
    );
  }
  // RLS allows admins and the team's own (non-guest) members.
  const canManage =
    can(workspace.role, 'workspace.update') ||
    (workspace.role !== 'guest' && team.memberIds.includes(userId));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title="Automations" icon={<WorkflowIcon className="size-4 text-fg-muted" />}>
        {canManage && (
          <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
            <PlusIcon /> New automation
          </Button>
        )}
      </ViewHeader>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-6">
          <p className="text-[13px] text-fg-muted">
            Automations change {team.name}’s tasks for you: when something happens, if the task
            matches, then up to three actions run within seconds. They never notify anyone unless
            told to.
          </p>
          {automations.data?.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-[13px] text-fg-subtle">
              No automations yet.
              {canManage && ' Create one to assign, label or reschedule tasks as they change.'}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {automations.data?.map((automation) => (
              <li
                key={automation.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-4"
                aria-label={automation.name}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-checked={automation.enabled}
                    aria-label={`Run ${automation.name}`}
                    checked={automation.enabled}
                    disabled={!canManage}
                    onChange={(event) =>
                      actions.update.mutate({
                        id: automation.id,
                        patch: { enabled: event.target.checked },
                      })
                    }
                    className="mt-1 accent-(--accent)"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-[13px] font-medium',
                        !automation.enabled && 'text-fg-muted',
                      )}
                    >
                      {automation.name}
                    </p>
                    <p className="text-xs text-fg-muted">{describe(automation, team, data)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={open === automation.id}
                    onClick={() => setOpen(open === automation.id ? null : automation.id)}
                  >
                    Runs
                  </Button>
                  {canManage && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(automation)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${automation.name}`}
                        onClick={() => setDeleting(automation)}
                      >
                        <Trash2Icon />
                      </Button>
                    </>
                  )}
                </div>
                {open === automation.id && (
                  <section aria-label={`Runs of ${automation.name}`} className="pl-7">
                    <RunLog automation={automation} team={team} />
                  </section>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{editing === 'new' ? 'New automation' : 'Edit automation'}</DialogTitle>
          {editing !== null && (
            <Builder
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
          <DialogDescription>Its run log is deleted too. Changes it made stay.</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) actions.remove.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Delete automation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
