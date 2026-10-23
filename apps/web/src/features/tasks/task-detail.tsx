import {
  useCycles,
  useMilestones,
  useTaskDetail,
  useTasks,
  useTaskSubscription,
  useUpdateTasks,
  useRelations,
  useRelationActions,
} from '@daiq/data';
import {
  cycleLabel,
  firstStatusOf,
  formatEstimate,
  isPriority,
  parseIdentifier,
  PRIORITY_LABEL,
  type RichDocument,
  type TaskDetail as TaskDetailModel,
} from '@daiq/domain';
import {
  Avatar,
  Button,
  cn,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Skeleton,
  Tooltip,
} from '@daiq/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  BellIcon,
  BellOffIcon,
  CircleDashedIcon,
  DiamondIcon,
  ExpandIcon,
  FolderIcon,
  GaugeIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCcwIcon,
  TagIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { rememberRecent } from '../command-palette/recent';
import { usePaletteActions, type PaletteAction } from '../command-palette/palette';
import {
  cycleOptions,
  estimatePickerOptions,
  labelOptions,
  memberOptions,
  NO_VALUE,
  priorityOptions,
  projectOptions,
  statusOptions,
} from '../pickers/options';
import { PickerPopover } from '../pickers/picker-popover';
import { SHORTCUTS } from '../shortcuts/registry';
import { useShortcuts } from '../shortcuts/use-shortcuts';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { ActivityFeed } from './activity-feed';
import { Attachments } from './attachments';
import { FieldEditor } from './field-editors';
import { useComposer } from './composer';
import { PriorityIcon, StatusIcon } from './icons';
import { LABEL_COLOR } from './label-colors';
import { RecurrenceEditor } from './recurrence-editor';
import { DateField, useTaskActions } from './task-actions';
import { useIdentifier } from './use-identifier';
import { useToday } from '../../lib/use-today';

const RichTextEditor = lazy(() =>
  import('@daiq/editor/editor').then((m) => ({ default: m.RichTextEditor })),
);

/** Resolves "ENG-12" to its detail query. */
export function useTaskByIdentifier(identifier: string) {
  const data = useWorkspaceData();
  const parsed = parseIdentifier(identifier);
  const team = parsed ? data.teamsByKey.get(parsed.teamKey) : undefined;
  return useTaskDetail(team?.id, parsed?.number);
}

export function TaskDetail({
  identifier,
  mode,
  onClose,
}: {
  identifier: string;
  mode: 'page' | 'peek';
  onClose?: () => void;
}) {
  const query = useTaskByIdentifier(identifier);
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3 p-6" aria-busy="true">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="flex flex-col items-start gap-2 p-8">
        <h2 className="text-lg font-semibold font-display">Task not found</h2>
        <p className="text-fg-muted">
          {identifier} doesn’t exist, was deleted, or is in a team you can’t access.
        </p>
        {onClose && <Button onClick={onClose}>Close</Button>}
      </div>
    );
  }
  return <TaskDetailBody task={query.data} mode={mode} {...(onClose && { onClose })} />;
}

function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-[13px]">
      <span className="text-xs text-fg-subtle">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const ghostTrigger = 'h-7 max-w-full justify-start px-1.5 font-normal';

function TaskDetailBody({
  task,
  mode,
  onClose,
}: {
  task: TaskDetailModel;
  mode: 'page' | 'peek';
  onClose?: () => void;
}) {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const actions = useTaskActions();
  const updateTasks = useUpdateTasks();
  const identifier = useIdentifier();
  const navigate = useNavigate();
  const composer = useComposer();
  const subscription = useTaskSubscription(task.id, workspace.id, userId);
  const team = data.teamsById.get(task.teamId);
  const status = data.statuses.get(task.statusId);
  const project = task.projectId ? data.projectsById.get(task.projectId) : undefined;
  const cycles = useCycles(team?.cyclesEnabled ? team.id : undefined);
  const milestones = useMilestones(task.projectId);
  const milestone = task.milestoneId
    ? milestones.data?.find((m) => m.id === task.milestoneId)
    : undefined;
  const cycle = task.cycleId ? cycles.data?.find((c) => c.id === task.cycleId) : undefined;
  const today = useToday();
  const ident = identifier(task);
  const [title, setTitle] = useState(task.title);
  const [syncedTitle, setSyncedTitle] = useState(task.title);
  // Adopt remote renames (realtime, undo) without an effect.
  if (task.title !== syncedTitle) {
    setSyncedTitle(task.title);
    setTitle(task.title);
  }
  useEffect(() => {
    rememberRecent(workspace.id, { kind: 'task', id: task.id, title: task.title, subtitle: ident });
  }, [workspace.id, task.id, task.title, ident]);

  const saveTitle = () => {
    const next = title.trim();
    if (next && next !== task.title) actions.update([task], { title: next }, 'Rename');
    else setTitle(task.title);
  };

  const saveDescription = (description: RichDocument) => {
    if (JSON.stringify(description) !== JSON.stringify(task.description)) {
      updateTasks.mutate({ ids: [task.id], patch: { description } });
    }
  };

  // Shortcuts act on the open task (lists register their own, innermost wins).
  useShortcuts(
    {
      status: () => actions.openPicker('status', [task]),
      priority: () => actions.openPicker('priority', [task]),
      assignee: () => actions.openPicker('assignee', [task]),
      assignMe: () => actions.toggleAssignMe([task]),
      labels: () => actions.openPicker('labels', [task]),
      dueDate: () => actions.openPicker('dueDate', [task]),
      project: () => actions.openPicker('project', [task]),
      estimate: () => actions.openPicker('estimate', [task]),
      cycle: () => actions.openPicker('cycle', [task]),
      copyLink: () => actions.copyLink(task),
      subscribe: () => subscription.toggle.mutate(!subscription.subscribed),
      subtask: () =>
        composer({ teamId: task.teamId, parentId: task.id, projectId: task.projectId }),
      comment: () =>
        document.querySelector<HTMLElement>('#comment-composer [contenteditable]')?.focus(),
      rename: () => document.getElementById(`title-${task.id}`)?.focus(),
      remove: () => {
        actions.remove([task]);
        onClose?.();
      },
    },
    mode === 'page',
  );

  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      {
        id: 'task-status',
        group: ident,
        label: 'Change status…',
        shortcut: SHORTCUTS.status.keys,
        run: () => actions.openPicker('status', [task]),
      },
      {
        id: 'task-priority',
        group: ident,
        label: 'Set priority…',
        shortcut: SHORTCUTS.priority.keys,
        run: () => actions.openPicker('priority', [task]),
      },
      {
        id: 'task-assignee',
        group: ident,
        label: 'Assign to…',
        shortcut: SHORTCUTS.assignee.keys,
        run: () => actions.openPicker('assignee', [task]),
      },
      {
        id: 'task-me',
        group: ident,
        label: 'Assign to me',
        shortcut: SHORTCUTS.assignMe.keys,
        run: () => actions.toggleAssignMe([task]),
      },
      {
        id: 'task-labels',
        group: ident,
        label: 'Change labels…',
        shortcut: SHORTCUTS.labels.keys,
        run: () => actions.openPicker('labels', [task]),
      },
      {
        id: 'task-due',
        group: ident,
        label: 'Set due date…',
        shortcut: SHORTCUTS.dueDate.keys,
        run: () => actions.openPicker('dueDate', [task]),
      },
      {
        id: 'task-sub',
        group: ident,
        label: 'Add sub-task',
        shortcut: SHORTCUTS.subtask.keys,
        run: () => composer({ teamId: task.teamId, parentId: task.id }),
      },
      {
        id: 'task-link',
        group: ident,
        label: 'Copy link',
        shortcut: SHORTCUTS.copyLink.keys,
        run: () => actions.copyLink(task),
      },
      {
        id: 'task-delete',
        group: ident,
        label: 'Delete task',
        shortcut: SHORTCUTS.remove.keys,
        run: () => actions.remove([task]),
      },
    ],
    [actions, task, ident, composer],
  );
  usePaletteActions(paletteActions);

  const properties = (
    <div className="flex flex-col gap-1.5">
      <PropertyRow label="Status">
        <PickerPopover
          trigger={
            <Button variant="ghost" size="sm" className={ghostTrigger}>
              {status && <StatusIcon category={status.category} />}
              {status?.name}
            </Button>
          }
          options={statusOptions(team?.statuses ?? [])}
          selected={[task.statusId]}
          placeholder="Change status to…"
          onSelect={([id]) => id && actions.setStatus([task], id)}
        />
      </PropertyRow>
      <PropertyRow label="Priority">
        <PickerPopover
          trigger={
            <Button variant="ghost" size="sm" className={ghostTrigger}>
              <PriorityIcon priority={task.priority} />
              {PRIORITY_LABEL[task.priority]}
            </Button>
          }
          options={priorityOptions()}
          selected={[String(task.priority)]}
          placeholder="Set priority to…"
          onSelect={([value]) => {
            const priority = Number(value);
            if (isPriority(priority)) actions.update([task], { priority }, 'Priority');
          }}
        />
      </PropertyRow>
      <PropertyRow label="Assignees">
        <PickerPopover
          trigger={
            <Button variant="ghost" size="sm" className={ghostTrigger}>
              {task.assigneeIds.length === 0 ? (
                <span className="flex items-center gap-1.5 text-fg-subtle">
                  <UserIcon /> Unassigned
                </span>
              ) : (
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="flex -space-x-1">
                    {task.assigneeIds.slice(0, 4).map((id) => (
                      <Avatar
                        key={id}
                        name={data.membersById.get(id)?.displayName ?? '?'}
                        size="xs"
                        className="ring-2 ring-surface"
                      />
                    ))}
                  </span>
                  <span className="truncate">
                    {task.assigneeIds
                      .map((id) => data.membersById.get(id)?.displayName ?? 'Former member')
                      .join(', ')}
                  </span>
                </span>
              )}
            </Button>
          }
          multiple
          options={memberOptions(data.members, userId)}
          selected={task.assigneeIds}
          placeholder="Assign to…"
          onSelect={(ids) => actions.setAssignees([task], ids)}
        />
      </PropertyRow>
      <PropertyRow label="Labels">
        <PickerPopover
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className={cn(ghostTrigger, 'h-auto min-h-7 flex-wrap py-1')}
            >
              {task.labelIds.length === 0 ? (
                <span className="flex items-center gap-1.5 text-fg-subtle">
                  <TagIcon /> No labels
                </span>
              ) : (
                task.labelIds.map((id) => {
                  const label = data.labelsById.get(id);
                  return label ? (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 text-xs"
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: LABEL_COLOR[label.color] }}
                      />
                      {label.name}
                    </span>
                  ) : null;
                })
              )}
            </Button>
          }
          multiple
          options={labelOptions(data.labels)}
          selected={task.labelIds}
          placeholder="Labels…"
          onSelect={(ids) => actions.setLabels([task], ids)}
        />
      </PropertyRow>
      <PropertyRow label="Project">
        <PickerPopover
          trigger={
            <Button variant="ghost" size="sm" className={ghostTrigger}>
              {project ? <FolderIcon /> : <CircleDashedIcon className="text-fg-subtle" />}
              <span className={cn('truncate', !project && 'text-fg-subtle')}>
                {project?.name ?? 'No project'}
              </span>
            </Button>
          }
          options={projectOptions(data.projects.filter((p) => p.teamId === task.teamId))}
          selected={[task.projectId ?? NO_VALUE]}
          placeholder="Move to project…"
          onSelect={([id]) =>
            actions.update([task], { projectId: id && id !== NO_VALUE ? id : null }, 'Project')
          }
        />
      </PropertyRow>
      {project && (milestones.data?.length ?? 0) > 0 && (
        <PropertyRow label="Milestone">
          <PickerPopover
            trigger={
              <Button variant="ghost" size="sm" className={ghostTrigger}>
                <DiamondIcon className={cn(!milestone && 'text-fg-subtle')} />
                <span className={cn('truncate', !milestone && 'text-fg-subtle')}>
                  {milestone?.name ?? 'No milestone'}
                </span>
              </Button>
            }
            options={[
              { value: NO_VALUE, label: 'No milestone', icon: <CircleDashedIcon /> },
              ...(milestones.data ?? []).map((m) => ({
                value: m.id,
                label: m.name,
                icon: <DiamondIcon />,
              })),
            ]}
            selected={[task.milestoneId ?? NO_VALUE]}
            placeholder="Move to milestone…"
            onSelect={([id]) =>
              actions.update(
                [task],
                { milestoneId: id && id !== NO_VALUE ? id : null },
                'Milestone',
              )
            }
          />
        </PropertyRow>
      )}
      {team?.estimatesEnabled && (
        <PropertyRow label="Estimate">
          <PickerPopover
            trigger={
              <Button variant="ghost" size="sm" className={ghostTrigger}>
                <GaugeIcon className={cn(task.estimate === null && 'text-fg-subtle')} />
                <span className={cn(task.estimate === null && 'text-fg-subtle')}>
                  {task.estimate === null
                    ? 'No estimate'
                    : formatEstimate(task.estimate, team.estimateScale)}
                </span>
              </Button>
            }
            options={estimatePickerOptions(team.estimateScale)}
            selected={[String(task.estimate ?? NO_VALUE)]}
            placeholder="Set estimate to…"
            onSelect={([value]) =>
              actions.update(
                [task],
                { estimate: value && value !== NO_VALUE ? Number(value) : null },
                'Estimate',
              )
            }
          />
        </PropertyRow>
      )}
      {team?.cyclesEnabled && (
        <PropertyRow label="Cycle">
          <PickerPopover
            trigger={
              <Button variant="ghost" size="sm" className={ghostTrigger}>
                <RefreshCcwIcon className={cn(!cycle && 'text-fg-subtle')} />
                <span className={cn('truncate', !cycle && 'text-fg-subtle')}>
                  {cycle ? cycleLabel(cycle) : 'No cycle'}
                </span>
              </Button>
            }
            options={cycleOptions(cycles.data ?? [], today)}
            selected={[task.cycleId ?? NO_VALUE]}
            placeholder="Move to cycle…"
            onSelect={([id]) =>
              actions.update([task], { cycleId: id && id !== NO_VALUE ? id : null }, 'Cycle')
            }
          />
        </PropertyRow>
      )}
      {team?.fieldIds.map((id) => {
        const field = data.fieldsById.get(id);
        return field ? (
          <PropertyRow key={id} label={field.name}>
            <FieldEditor field={field} task={task} />
          </PropertyRow>
        ) : null;
      })}
      <PropertyRow label="Due date">
        <DateField
          label="Due date"
          value={task.dueDate}
          onChange={(dueDate) => actions.update([task], { dueDate }, 'Due date')}
        />
      </PropertyRow>
      <PropertyRow label="Start date">
        <DateField
          label="Start date"
          value={task.startDate}
          onChange={(startDate) => actions.update([task], { startDate }, 'Start date')}
        />
      </PropertyRow>
      <PropertyRow label="Repeat">
        <RecurrenceEditor task={task} triggerClassName={ghostTrigger} />
      </PropertyRow>
    </div>
  );

  return (
    <article
      className={cn('flex min-h-0 flex-1 flex-col', mode === 'peek' && 'h-full')}
      aria-labelledby={`title-${task.id}`}
    >
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-3">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted"
        >
          {team && (
            <Link
              to="/$workspace/team/$teamKey/tasks"
              params={{ workspace: workspace.slug, teamKey: team.key }}
              className="hover:text-fg"
            >
              {team.name}
            </Link>
          )}
          {project && (
            <>
              <span aria-hidden>›</span>
              <Link
                to="/$workspace/project/$projectId"
                params={{ workspace: workspace.slug, projectId: project.id }}
                className="truncate hover:text-fg"
              >
                {project.name}
              </Link>
            </>
          )}
          <span aria-hidden>›</span>
          <span className="text-fg tabular">{ident}</span>
        </nav>
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip
            label={subscription.subscribed ? 'Unsubscribe' : 'Subscribe'}
            shortcut={SHORTCUTS.subscribe.keys}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={subscription.subscribed}
              aria-label={subscription.subscribed ? 'Unsubscribe' : 'Subscribe'}
              onClick={() => subscription.toggle.mutate(!subscription.subscribed)}
            >
              {subscription.subscribed ? <BellIcon /> : <BellOffIcon />}
            </Button>
          </Tooltip>
          <Tooltip label="Copy link" shortcut={SHORTCUTS.copyLink.keys}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy link"
              onClick={() => actions.copyLink(task)}
            >
              <LinkIcon />
            </Button>
          </Tooltip>
          <Menu>
            <MenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
            >
              <MoreHorizontalIcon />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem
                shortcut={SHORTCUTS.subtask.keys}
                onClick={() =>
                  composer({ teamId: task.teamId, parentId: task.id, projectId: task.projectId })
                }
              >
                <PlusIcon /> Add sub-task
              </MenuItem>
              <MenuItem
                destructive
                shortcut={SHORTCUTS.remove.keys}
                onClick={() => {
                  actions.remove([task]);
                  onClose?.();
                }}
              >
                <Trash2Icon /> Delete task
              </MenuItem>
            </MenuContent>
          </Menu>
          {mode === 'peek' && (
            <>
              <Tooltip label="Open full page" shortcut={SHORTCUTS.open.keys}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open full page"
                  onClick={() =>
                    void navigate({
                      to: '/$workspace/task/$identifier',
                      params: { workspace: workspace.slug, identifier: ident },
                    })
                  }
                >
                  <ExpandIcon />
                </Button>
              </Tooltip>
              <Tooltip label="Close" shortcut="Escape">
                <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
                  <XIcon />
                </Button>
              </Tooltip>
            </>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div
          className={cn(
            'mx-auto flex gap-10 px-6 py-6',
            mode === 'page' ? 'max-w-5xl' : 'flex-col gap-6',
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <label htmlFor={`title-${task.id}`} className="sr-only">
              Title
            </label>
            <textarea
              id={`title-${task.id}`}
              value={title}
              rows={1}
              onChange={(event) => setTitle(event.target.value.replace(/\n/g, ''))}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  setTitle(task.title);
                  event.currentTarget.blur();
                }
              }}
              className="field-sizing-content w-full resize-none bg-transparent text-xl leading-snug font-semibold font-display outline-none focus-visible:outline-none"
            />
            {mode === 'peek' && properties}
            <Suspense fallback={<Skeleton className="h-24" />}>
              <RichTextEditor
                key={task.id}
                value={task.description}
                onChange={saveDescription}
                placeholder="Add a description… Press / for blocks, @ to mention"
                ariaLabel="Description"
                mentionables={data.members.map((m) => ({
                  id: m.id,
                  name: m.displayName,
                  avatarUrl: m.avatarUrl,
                }))}
                className="min-h-24"
              />
            </Suspense>
            <Attachments task={task} />
            <SubTasks task={task} />
            <Relations task={task} />
            <ActivityFeed task={task} />
          </div>
          {mode === 'page' && <aside className="hidden w-64 shrink-0 md:block">{properties}</aside>}
        </div>
      </div>
    </article>
  );
}

function SubTasks({ task }: { task: TaskDetailModel }) {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const children = useTasks({ kind: 'parent', id: task.id });
  const identifier = useIdentifier();
  const composer = useComposer();
  const team = data.teamsById.get(task.teamId);
  const sorted = [...(children.data ?? [])].sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
  const done = sorted.filter((t) => t.completedAt || t.canceledAt).length;
  if (sorted.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="self-start text-fg-muted"
        onClick={() =>
          composer({ teamId: task.teamId, parentId: task.id, projectId: task.projectId })
        }
      >
        <PlusIcon /> Add sub-task
      </Button>
    );
  }
  return (
    <section aria-labelledby={`subtasks-${task.id}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h2 id={`subtasks-${task.id}`} className="text-[13px] font-semibold">
          Sub-tasks
        </h2>
        <span className="text-xs text-fg-subtle tabular">
          {done}/{sorted.length}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Add sub-task"
          onClick={() =>
            composer({
              teamId: task.teamId,
              parentId: task.id,
              projectId: task.projectId,
              statusId: firstStatusOf(team?.statuses ?? [], 'unstarted')?.id ?? task.statusId,
            })
          }
        >
          <PlusIcon />
        </Button>
      </div>
      <ul className="flex flex-col">
        {sorted.map((child) => {
          const childStatus = data.statuses.get(child.statusId);
          return (
            <li key={child.id}>
              <Link
                to="/$workspace/task/$identifier"
                params={{ workspace: workspace.slug, identifier: identifier(child) }}
                className="flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] hover:bg-surface-muted"
              >
                {childStatus && <StatusIcon category={childStatus.category} />}
                <span className="w-14 text-xs text-fg-subtle tabular">{identifier(child)}</span>
                <span
                  className={cn(
                    'truncate',
                    childStatus &&
                      (childStatus.category === 'completed' ||
                        childStatus.category === 'canceled') &&
                      'text-fg-muted line-through decoration-fg-subtle',
                  )}
                >
                  {child.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const RELATION_LABEL = {
  blocks: 'Blocks',
  blockedBy: 'Blocked by',
  related: 'Related',
  duplicate: 'Duplicate of',
  duplicatedBy: 'Duplicated by',
} as const;

function Relations({ task }: { task: TaskDetailModel }) {
  const { workspace } = useWorkspace();
  const relations = useRelations(task.id);
  const relationActions = useRelationActions(task.id, workspace.id);
  const teamTasks = useTasks({ kind: 'team', id: task.teamId });
  const identifier = useIdentifier();
  const byId = new Map((teamTasks.data ?? []).map((t) => [t.id, t]));
  const rows = (relations.data ?? []).map((relation) => {
    const outgoing = relation.taskId === task.id;
    const otherId = outgoing ? relation.relatedTaskId : relation.taskId;
    const kind: keyof typeof RELATION_LABEL =
      relation.kind === 'blocks'
        ? outgoing
          ? 'blocks'
          : 'blockedBy'
        : relation.kind === 'duplicate'
          ? outgoing
            ? 'duplicate'
            : 'duplicatedBy'
          : 'related';
    return { relation, kind, other: byId.get(otherId) };
  });
  const candidates = (teamTasks.data ?? []).filter((t) => t.id !== task.id && t.number !== null);
  const options = candidates.map((t) => ({ value: t.id, label: t.title, hint: identifier(t) }));

  return (
    <section aria-labelledby={`relations-${task.id}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h2 id={`relations-${task.id}`} className="text-[13px] font-semibold">
          Relations
        </h2>
        <PickerPopover
          trigger={
            <Button variant="ghost" size="sm" className="ml-auto text-fg-muted">
              <PlusIcon /> Blocked by
            </Button>
          }
          options={options}
          selected={[]}
          placeholder="Blocked by task…"
          onSelect={([id]) =>
            id && relationActions.add.mutate({ relatedTaskId: id, kind: 'blocks', inverse: true })
          }
        />
        <PickerPopover
          trigger={
            <Button variant="ghost" size="sm" className="text-fg-muted">
              <PlusIcon /> Related
            </Button>
          }
          options={options}
          selected={[]}
          placeholder="Related task…"
          onSelect={([id]) =>
            id && relationActions.add.mutate({ relatedTaskId: id, kind: 'related' })
          }
        />
      </div>
      {rows.length > 0 && (
        <ul className="flex flex-col">
          {rows.map(({ relation, kind, other }) => (
            <li
              key={relation.id}
              className="group/rel flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] hover:bg-surface-muted"
            >
              <span
                className={cn(
                  'w-24 text-xs',
                  kind === 'blockedBy' ? 'font-medium text-danger' : 'text-fg-subtle',
                )}
              >
                {RELATION_LABEL[kind]}
              </span>
              {other ? (
                <Link
                  to="/$workspace/task/$identifier"
                  params={{ workspace: workspace.slug, identifier: identifier(other) }}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span className="text-xs text-fg-subtle tabular">{identifier(other)}</span>
                  <span className="truncate">{other.title}</span>
                </Link>
              ) : (
                <span className="flex-1 text-fg-subtle">A task in another team</span>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover/rel:opacity-100 focus-visible:opacity-100"
                aria-label="Remove relation"
                onClick={() => relationActions.remove.mutate(relation.id)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
