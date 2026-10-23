import {
  formatDueDate,
  formatEstimate,
  isClosedCategory,
  isPriority,
  nestSubtasks,
  sortKeyForMove,
  type Task,
  type TaskGroup,
} from '@daiq/domain';
import { Avatar, Button, cn, Shortcut, Tooltip } from '@daiq/ui';
import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PaperclipIcon,
  PlusIcon,
  RepeatIcon,
} from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useToday } from '../../lib/use-today';
import { memberOptions, priorityOptions, statusOptions } from '../pickers/options';
import { PickerPopover } from '../pickers/picker-popover';
import { SHORTCUTS } from '../shortcuts/registry';
import { useShortcuts } from '../shortcuts/use-shortcuts';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import type { ComposerDefaults } from './composer';
import { PriorityIcon, StatusIcon } from './icons';
import { LABEL_COLOR } from './label-colors';
import { useTaskActions } from './task-actions';
import { TaskContextMenu } from './task-context-menu';
import { TaskId } from './task-id';
import { useIdentifier } from './use-identifier';

type Row =
  | { kind: 'header'; group: TaskGroup; collapsed: boolean; key: string; level: 1 | 2 }
  | { kind: 'task'; task: Task; depth: number; groupKey: string };

/** Collapse state and keyboard reordering address a sub-group through its parent. */
const rowKey = (group: TaskGroup) =>
  group.parentKey ? `${group.parentKey}/${group.key}` : group.key;

const ROW_HEIGHT = 36;

export interface TaskListProps {
  groups: TaskGroup[];
  showGroupHeaders: boolean;
  canReorder: boolean;
  peekId: string | undefined;
  onOpen: (task: Task, mode: 'peek' | 'page') => void;
  composerDefaults: (group: TaskGroup) => ComposerDefaults;
  onCreate: (defaults: ComposerDefaults) => void;
  label: string;
}

export function TaskList({
  groups,
  showGroupHeaders,
  canReorder,
  peekId,
  onOpen,
  composerDefaults,
  onCreate,
  label,
}: TaskListProps) {
  const { workspace } = useWorkspace();
  const actions = useTaskActions();
  const identifier = useIdentifier();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const today = useToday();

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    const add = (group: TaskGroup, level: 1 | 2) => {
      const key = rowKey(group);
      const isCollapsed = collapsed.has(key);
      if (showGroupHeaders)
        result.push({ kind: 'header', group, collapsed: isCollapsed, key, level });
      if (isCollapsed) return;
      if (group.subgroups) {
        for (const sub of group.subgroups) add(sub, 2);
        return;
      }
      for (const { task, depth } of nestSubtasks(group.tasks)) {
        result.push({ kind: 'task', task, depth, groupKey: key });
      }
    };
    for (const group of groups) add(group, 1);
    return result;
  }, [groups, collapsed, showGroupHeaders]);
  const groupsByKey = useMemo(
    () =>
      new Map(
        groups.flatMap((group) => [
          [rowKey(group), group] as const,
          ...(group.subgroups ?? []).map((sub) => [rowKey(sub), sub] as const),
        ]),
      ),
    [groups],
  );

  const taskRows = useMemo(() => rows.flatMap((row) => (row.kind === 'task' ? [row] : [])), [rows]);
  const tasksById = useMemo(
    () => new Map(taskRows.map((row) => [row.task.id, row.task])),
    [taskRows],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  // Drop selection/focus for tasks that left the view (filtered, deleted, moved).
  useEffect(() => {
    setSelected((current) => {
      const next = new Set([...current].filter((id) => tasksById.has(id)));
      return next.size === current.size ? current : next;
    });
    if (focusedId && !tasksById.has(focusedId)) setFocusedId(null);
  }, [tasksById, focusedId]);

  const focusTask = useCallback(
    (id: string) => {
      setFocusedId(id);
      const index = rows.findIndex((row) => row.kind === 'task' && row.task.id === id);
      if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' });
      requestAnimationFrame(() => {
        scrollRef.current
          ?.querySelector<HTMLElement>(`[data-task-id="${id}"]`)
          ?.focus({ preventScroll: true });
      });
    },
    [rows, virtualizer],
  );

  const move = (delta: 1 | -1, extend = false) => {
    if (taskRows.length === 0) return;
    const index = taskRows.findIndex((row) => row.task.id === focusedId);
    const nextIndex =
      index < 0
        ? delta === 1
          ? 0
          : taskRows.length - 1
        : Math.max(0, Math.min(taskRows.length - 1, index + delta));
    const next = taskRows[nextIndex]?.task;
    if (!next) return;
    if (extend) {
      setSelected((current) => new Set([...current, ...(focusedId ? [focusedId] : []), next.id]));
    }
    focusTask(next.id);
  };

  const targets = (): Task[] => {
    if (selected.size > 0) return [...selected].flatMap((id) => tasksById.get(id) ?? []);
    const id = focusedId ?? peekId;
    const task = id ? tasksById.get(id) : undefined;
    return task ? [task] : [];
  };

  const reorder = (delta: 1 | -1) => {
    const row = taskRows.find((r) => r.task.id === focusedId);
    if (!canReorder || !row) return;
    const group = groupsByKey.get(row.groupKey);
    const siblings = group?.tasks.filter((t) => t.parentId === row.task.parentId) ?? [];
    const from = siblings.findIndex((t) => t.id === row.task.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= siblings.length) return;
    actions.update(
      [row.task],
      { sortKey: sortKeyForMove(siblings, from, delta === 1 ? to + 1 : to) },
      'Reorder',
    );
    setAnnouncement(`${row.task.title} moved to position ${to + 1} of ${siblings.length}`);
  };

  useShortcuts({
    next: () => move(1),
    previous: () => move(-1),
    open: () => {
      const task = focusedId ? tasksById.get(focusedId) : undefined;
      if (task) onOpen(task, 'page');
    },
    peek: () => {
      const task = focusedId ? tasksById.get(focusedId) : undefined;
      if (task) onOpen(task, 'peek');
    },
    select: () => {
      if (!focusedId) return;
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(focusedId)) next.delete(focusedId);
        else next.add(focusedId);
        return next;
      });
      setAnchorId(focusedId);
    },
    selectAll: () => setSelected(new Set(taskRows.map((row) => row.task.id))),
    status: () => actions.openPicker('status', targets()),
    priority: () => actions.openPicker('priority', targets()),
    assignee: () => actions.openPicker('assignee', targets()),
    labels: () => actions.openPicker('labels', targets()),
    dueDate: () => actions.openPicker('dueDate', targets()),
    project: () => actions.openPicker('project', targets()),
    estimate: () => actions.openPicker('estimate', targets()),
    cycle: () => actions.openPicker('cycle', targets()),
    assignMe: () => actions.toggleAssignMe(targets()),
    remove: () => actions.remove(targets()),
    copyId: () => {
      const [task] = targets();
      if (task) actions.copyId(task);
    },
    copyLink: () => {
      const [task] = targets();
      if (task) actions.copyLink(task);
    },
    moveUp: () => reorder(-1),
    moveDown: () => reorder(1),
  });

  const onRowClick = (event: MouseEvent, task: Task) => {
    // Clicks on the row's own controls (pickers) must not open the preview.
    if (event.target instanceof Element && event.target.closest('button, a, input')) return;
    if (event.metaKey || event.ctrlKey) {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(task.id)) next.delete(task.id);
        else next.add(task.id);
        return next;
      });
      setAnchorId(task.id);
      setFocusedId(task.id);
      return;
    }
    if (event.shiftKey && anchorId) {
      const ids = taskRows.map((row) => row.task.id);
      const [a, b] = [ids.indexOf(anchorId), ids.indexOf(task.id)].sort((x, y) => x - y);
      setSelected(new Set(ids.slice(a, (b ?? 0) + 1)));
      setFocusedId(task.id);
      return;
    }
    setSelected(new Set());
    setAnchorId(task.id);
    setFocusedId(task.id);
    onOpen(task, 'peek');
  };

  const toggleGroup = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onAction={(kind) => actions.openPicker(kind, targets())}
          onDelete={() => actions.remove(targets())}
        />
      )}
      <TaskContextMenu
        onOpen={onOpen}
        tasksFor={(id) =>
          selected.has(id)
            ? [...selected].flatMap((s) => tasksById.get(s) ?? [])
            : [tasksById.get(id)].filter((task) => task !== undefined)
        }
      >
        <div
          ref={scrollRef}
          role="treegrid"
          aria-label={label}
          aria-multiselectable="true"
          aria-rowcount={rows.length}
          tabIndex={focusedId ? -1 : 0}
          onFocus={(event) => {
            // Tabbing into the grid lands on the first (or last focused) row.
            if (event.target === event.currentTarget) {
              const first = focusedId ?? taskRows[0]?.task.id;
              if (first) focusTask(first);
            }
          }}
          className="@container/list min-h-0 flex-1 overflow-y-auto pb-24 outline-none scrollbar-thin"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && selected.size > 0) {
              event.stopPropagation();
              setSelected(new Set());
            }
            if (event.key === 'ArrowDown' && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              move(1, event.shiftKey);
            }
            if (event.key === 'ArrowUp' && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              move(-1, event.shiftKey);
            }
            // Treegrid pattern: Home/End jump to the first/last row (not while typing).
            const typing =
              event.target instanceof HTMLElement &&
              event.target.closest('input, textarea, [contenteditable="true"]');
            if ((event.key === 'Home' || event.key === 'End') && !typing) {
              const target = event.key === 'Home' ? taskRows[0] : taskRows.at(-1);
              if (target) {
                event.preventDefault();
                focusTask(target.task.id);
              }
            }
          }}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              if (!row) return null;
              return (
                <div
                  key={row.kind === 'task' ? row.task.id : `h-${row.key}`}
                  data-index={item.index}
                  className="absolute inset-x-0"
                  style={{ transform: `translateY(${item.start}px)`, height: item.size }}
                >
                  {row.kind === 'header' ? (
                    <GroupHeader
                      group={row.group}
                      level={row.level}
                      collapsed={row.collapsed}
                      rowIndex={item.index + 1}
                      onToggle={() => toggleGroup(row.key)}
                      onCreate={() => onCreate(composerDefaults(row.group))}
                    />
                  ) : (
                    <TaskRow
                      task={row.task}
                      depth={row.depth}
                      rowIndex={item.index + 1}
                      identifier={identifier(row.task)}
                      focused={focusedId === row.task.id}
                      selected={selected.has(row.task.id)}
                      peeked={peekId === row.task.id}
                      today={today}
                      onClick={onRowClick}
                      onOpen={onOpen}
                      onFocus={setFocusedId}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {taskRows.length === 0 && (
            <div className="flex flex-col items-start gap-2 px-6 py-16 text-[13px] text-fg-muted">
              <p className="font-medium text-fg">No tasks here</p>
              <p className="flex items-center gap-1.5">
                Press <Shortcut keys={SHORTCUTS.create.keys} /> to create one, or adjust the
                filters.
              </p>
              <Link
                to="/$workspace/settings/import"
                params={{ workspace: workspace.slug }}
                className="text-accent-text underline-offset-4 hover:underline"
              >
                Import tasks from Linear, Asana, ClickUp or a CSV file
              </Link>
            </div>
          )}
        </div>
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </TaskContextMenu>
    </div>
  );
}

function GroupHeader({
  group,
  level,
  collapsed,
  rowIndex,
  onToggle,
  onCreate,
}: {
  group: TaskGroup;
  level: 1 | 2;
  collapsed: boolean;
  rowIndex: number;
  onToggle: () => void;
  onCreate: () => void;
}) {
  const groupPriority = group.kind === 'priority' ? Number(group.key) : Number.NaN;
  return (
    <div
      role="row"
      aria-rowindex={rowIndex}
      aria-level={level}
      aria-expanded={!collapsed}
      className={cn(
        'group/header flex h-9 items-center gap-2 border-b border-border px-3 md:px-4',
        level === 1 ? 'bg-surface-subtle/70' : 'pl-8 md:pl-9',
      )}
    >
      <div role="gridcell" className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.label}`}
          className="flex size-5 items-center justify-center rounded-[4px] text-fg-subtle hover:bg-surface-muted hover:text-fg"
        >
          {collapsed ? (
            <ChevronRightIcon className="size-3.5" />
          ) : (
            <ChevronDownIcon className="size-3.5" />
          )}
        </button>
        {group.category && <StatusIcon category={group.category} />}
        {isPriority(groupPriority) && <PriorityIcon priority={groupPriority} />}
        <span className="truncate text-[13px] font-medium">{group.label}</span>
        <span className="text-xs text-fg-subtle tabular">{group.tasks.length}</span>
      </div>
      <div role="gridcell">
        <Tooltip label={`Create in ${group.label}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover/header:opacity-100 focus-visible:opacity-100"
            aria-label={`Create task in ${group.label}`}
            onClick={onCreate}
          >
            <PlusIcon />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

const TaskRow = memo(function TaskRow({
  task,
  depth,
  rowIndex,
  identifier,
  focused,
  selected,
  peeked,
  today,
  onClick,
  onOpen,
  onFocus,
}: {
  task: Task;
  depth: number;
  rowIndex: number;
  identifier: string;
  focused: boolean;
  selected: boolean;
  peeked: boolean;
  today: string;
  onClick: (event: MouseEvent, task: Task) => void;
  onOpen: (task: Task, mode: 'peek' | 'page') => void;
  onFocus: (id: string) => void;
}) {
  const { userId } = useWorkspace();
  const data = useWorkspaceData();
  const actions = useTaskActions();
  const status = data.statuses.get(task.statusId);
  const team = data.teamsById.get(task.teamId);
  const project = task.projectId ? data.projectsById.get(task.projectId) : undefined;
  const closed = status ? isClosedCategory(status.category) : false;
  const overdue = !closed && task.dueDate !== null && task.dueDate < today;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(task, event.key === 'Enter' ? 'page' : 'peek');
    }
  };

  return (
    <div
      role="row"
      aria-rowindex={rowIndex}
      aria-level={depth + 1}
      aria-selected={selected}
      tabIndex={focused ? 0 : -1}
      data-task-id={task.id}
      onClick={(event) => onClick(event, task)}
      onKeyDown={onKeyDown}
      onFocus={(event) => event.target === event.currentTarget && onFocus(task.id)}
      className={cn(
        'group/row flex h-9 cursor-default items-center gap-2 border-b border-border/60 px-3 text-[13px] outline-none select-none md:px-4',
        'hover:bg-surface-subtle focus-visible:bg-surface-muted focus-visible:shadow-[inset_2px_0_0_var(--focus)]',
        selected && 'bg-accent-subtle/70 hover:bg-accent-subtle',
        peeked && 'bg-surface-muted',
        task.number === null && 'animate-in duration-300 fade-in-0',
      )}
    >
      <div role="gridcell" className="flex items-center">
        <PickerPopover
          trigger={
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded-[5px] hover:bg-surface-emphasis"
              aria-label={`Priority`}
              tabIndex={-1}
            >
              <PriorityIcon priority={task.priority} />
            </button>
          }
          options={priorityOptions()}
          selected={[String(task.priority)]}
          placeholder="Set priority to…"
          onSelect={([value]) => {
            const priority = Number(value);
            if (isPriority(priority)) actions.update([task], { priority }, 'Priority');
          }}
        />
      </div>
      <div role="gridcell" className="hidden w-16 shrink-0 @md/list:block">
        <TaskId identifier={identifier} />
      </div>
      <div role="gridcell" className="flex items-center" style={{ marginLeft: depth * 20 }}>
        <PickerPopover
          trigger={
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded-[5px] hover:bg-surface-emphasis"
              aria-label={`Status: ${status?.name ?? ''}`}
              tabIndex={-1}
            >
              {status && <StatusIcon category={status.category} />}
            </button>
          }
          options={statusOptions(team?.statuses ?? [])}
          selected={[task.statusId]}
          placeholder="Change status to…"
          onSelect={([id]) => id && actions.setStatus([task], id)}
        />
      </div>
      <div role="gridcell" className="flex min-w-0 flex-1 items-center gap-2">
        <span className={cn('min-w-0 truncate', closed && 'text-fg-muted')}>{task.title}</span>
        {task.recurring && (
          <RepeatIcon role="img" aria-label="Repeats" className="size-3 shrink-0 text-fg-subtle" />
        )}
        <span className="hidden shrink-0 items-center gap-1 @3xl/list:flex">
          {task.labelIds.slice(0, 3).map((id) => {
            const labelData = data.labelsById.get(id);
            return labelData ? (
              <span
                key={id}
                className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-border px-1.5 text-[11px] text-fg-muted"
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: LABEL_COLOR[labelData.color] }}
                />
                {labelData.name}
              </span>
            ) : null;
          })}
        </span>
      </div>
      {project && (
        <div
          role="gridcell"
          className="hidden max-w-40 shrink-0 truncate text-xs text-fg-subtle @4xl/list:block"
        >
          {project.name}
        </div>
      )}
      {task.attachmentCount > 0 && (
        <div
          role="gridcell"
          className="hidden shrink-0 items-center gap-0.5 text-xs text-fg-subtle tabular @2xl/list:flex"
          aria-label={`${task.attachmentCount} ${task.attachmentCount === 1 ? 'attachment' : 'attachments'}`}
        >
          <PaperclipIcon aria-hidden className="size-3" />
          {task.attachmentCount}
        </div>
      )}
      {team?.estimatesEnabled && task.estimate !== null && (
        <div
          role="gridcell"
          className="hidden shrink-0 rounded-sm border border-border px-1 text-[11px] text-fg-muted tabular @2xl/list:block"
          title={formatEstimate(task.estimate, team.estimateScale)}
        >
          {team.estimateScale === 'hours' ? `${task.estimate}h` : task.estimate}
        </div>
      )}
      {task.dueDate && (
        <div
          role="gridcell"
          className={cn(
            'shrink-0 text-xs tabular',
            overdue ? 'font-medium text-danger' : 'text-fg-subtle',
          )}
          title={overdue ? 'Overdue' : 'Due date'}
        >
          {formatDueDate(task.dueDate, today)}
        </div>
      )}
      <div role="gridcell" className="flex w-14 shrink-0 justify-end">
        <PickerPopover
          trigger={
            <button
              type="button"
              tabIndex={-1}
              className="flex h-6 items-center rounded-full px-0.5 hover:bg-surface-emphasis"
              aria-label="Assignees"
            >
              {task.assigneeIds.length === 0 ? (
                <span className="size-5 rounded-full border border-dashed border-border-strong" />
              ) : (
                <span className="flex -space-x-1.5">
                  {task.assigneeIds.slice(0, 3).map((id) => (
                    <Avatar
                      key={id}
                      name={data.membersById.get(id)?.displayName ?? '?'}
                      src={data.membersById.get(id)?.avatarUrl}
                      size="sm"
                      className="ring-2 ring-surface"
                    />
                  ))}
                </span>
              )}
            </button>
          }
          multiple
          options={memberOptions(data.members, userId)}
          selected={task.assigneeIds}
          placeholder="Assign to…"
          onSelect={(ids) => actions.setAssignees([task], ids)}
        />
      </div>
    </div>
  );
});

function SelectionBar({
  count,
  onClear,
  onAction,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onAction: (kind: 'status' | 'priority' | 'assignee' | 'labels' | 'dueDate' | 'project') => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label={`${count} selected`}
      className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 animate-in items-center gap-1 rounded-xl border border-border bg-overlay p-1 pl-3 text-[13px] shadow-popover duration-150 fade-in-0 slide-in-from-bottom-2"
    >
      <span className="mr-1 font-medium tabular">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={() => onAction('status')}>
        Status <Shortcut keys="S" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onAction('priority')}>
        Priority <Shortcut keys="P" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onAction('assignee')}>
        Assign <Shortcut keys="A" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="hidden sm:inline-flex"
        onClick={() => onAction('labels')}
      >
        Labels <Shortcut keys="L" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-danger hover:text-danger"
        onClick={onDelete}
      >
        Delete
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear selection">
        Esc
      </Button>
    </div>
  );
}
