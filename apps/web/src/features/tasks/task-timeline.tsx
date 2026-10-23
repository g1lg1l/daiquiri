import { useDependencies } from '@daiq/data';
import {
  addDays,
  daysBetween,
  isClosedCategory,
  moveTaskDates,
  parseIsoDate,
  taskSpan,
  timelineRange,
  type Span,
  type SpanEdge,
  type Task,
  type TaskGroup,
} from '@daiq/domain';
import { Button, cn } from '@daiq/ui';
import { announce } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useToday } from '../../lib/use-today';
import { useShell } from '../shell/shell-context';
import { useShortcuts } from '../shortcuts/use-shortcuts';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { StatusIcon } from './icons';
import { useTaskActions } from './task-actions';
import { useIdentifier } from './use-identifier';

// ponytail: every dated row renders; virtualise rows past ~500 if profiling shows jank.

const DAY = 32;
const ROW = 34;
const HEADER = 52;

type Row =
  | { kind: 'group'; key: string; label: string }
  | { kind: 'task'; key: string; task: Task; span: Span };

const short = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export interface TaskTimelineProps {
  groups: TaskGroup[];
  showGroupHeaders: boolean;
  peekId: string | undefined;
  onOpen: (task: Task, mode: 'peek' | 'page') => void;
}

/**
 * Tasks as bars from start to due date (feature spec §6). Drag a bar to move
 * it, or an edge to change its start or due date; with the keyboard, Mod+←/→
 * moves the focused bar a day and Mod+Shift+←/→ moves its due date. Arrows
 * show "blocks" relations, red when a task starts before its blocker ends.
 */
export function TaskTimeline({ groups, showGroupHeaders, peekId, onOpen }: TaskTimelineProps) {
  const today = useToday();
  const { workspace } = useWorkspace();
  const { isMobile } = useShell();
  const actions = useTaskActions();
  const identifier = useIdentifier();
  const dependencies = useDependencies(workspace.id);
  const scroller = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const left = isMobile ? 150 : 280;

  const { rows, undated } = useMemo(() => {
    const result: Row[] = [];
    // A task appears once even if grouping (labels) lists it in two groups.
    const seen = new Set<string>();
    const withoutDates = new Set<string>();
    for (const group of groups) {
      const dated: Row[] = [];
      for (const task of group.tasks) {
        const span = taskSpan(task);
        if (!span) withoutDates.add(task.id);
        else if (!seen.has(task.id)) {
          seen.add(task.id);
          dated.push({ kind: 'task', key: task.id, task, span });
        }
      }
      if (dated.length === 0) continue;
      if (showGroupHeaders)
        result.push({ kind: 'group', key: `g-${group.key}`, label: group.label });
      result.push(...dated);
    }
    return { rows: result, undated: withoutDates.size };
  }, [groups, showGroupHeaders]);

  const taskRows = useMemo(() => rows.flatMap((row) => (row.kind === 'task' ? [row] : [])), [rows]);
  const range = useMemo(
    () =>
      timelineRange(
        taskRows.map((row) => row.span),
        today,
      ),
    [taskRows, today],
  );
  const x = (day: string) => left + daysBetween(range.start, day) * DAY;
  const days = Array.from({ length: range.days }, (_, i) => addDays(range.start, i));
  const rowIndex = new Map(rows.map((row, index) => [row.key, index]));

  // Open on today, with a little context before it.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = (daysBetween(range.start, today) - 3) * DAY;
  }, [range.start, today]);

  const commit = (task: Task, delta: number, edge: SpanEdge) => {
    const dates = moveTaskDates(task, delta, edge);
    if (dates.startDate === task.startDate && dates.dueDate === task.dueDate) return;
    actions.update([task], dates, edge === 'both' ? 'Move dates' : 'Change dates');
    const span = taskSpan(dates);
    if (span) {
      announce(
        `${identifier(task)} now runs ${short.format(parseIsoDate(span.start))} to ${short.format(parseIsoDate(span.end))}`,
      );
    }
  };

  const focusBar = (index: number) => {
    const row = taskRows[Math.max(0, Math.min(taskRows.length - 1, index))];
    if (!row) return;
    setFocusedId(row.task.id);
    scroller.current?.querySelector<HTMLElement>(`[data-bar-id="${row.task.id}"]`)?.focus();
  };
  const focusedIndex = taskRows.findIndex((row) => row.task.id === focusedId);
  const focusedTask = taskRows[focusedIndex]?.task;
  const target = () => (focusedTask ? [focusedTask] : []);

  useShortcuts({
    next: () => focusBar(focusedIndex + 1),
    previous: () => focusBar(focusedIndex - 1),
    open: () => focusedTask && onOpen(focusedTask, 'page'),
    peek: () => focusedTask && onOpen(focusedTask, 'peek'),
    status: () => actions.openPicker('status', target()),
    priority: () => actions.openPicker('priority', target()),
    assignee: () => actions.openPicker('assignee', target()),
    dueDate: () => actions.openPicker('dueDate', target()),
    remove: () => actions.remove(target()),
    copyId: () => focusedTask && actions.copyId(focusedTask),
    copyLink: () => focusedTask && actions.copyLink(focusedTask),
  });

  const onBarKeyDown = (event: KeyboardEvent, task: Task) => {
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(task, event.key === 'Enter' ? 'page' : 'peek');
    } else if (mod && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      commit(task, event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey ? 'end' : 'both');
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusBar(focusedIndex + (event.key === 'ArrowDown' ? 1 : -1));
    }
  };

  const width = left + range.days * DAY;
  const height = HEADER + rows.length * ROW;
  const todayX = x(today);
  const visible = new Map(taskRows.map((row) => [row.task.id, row]));
  const arrows = (dependencies.data ?? []).flatMap((relation) => {
    const blocker = visible.get(relation.taskId);
    const blocked = visible.get(relation.relatedTaskId);
    if (!blocker || !blocked) return [];
    const x1 = x(blocker.span.end) + DAY - 3;
    const x2 = x(blocked.span.start) + 3;
    const y1 = HEADER + (rowIndex.get(blocker.key) ?? 0) * ROW + ROW / 2;
    const y2 = HEADER + (rowIndex.get(blocked.key) ?? 0) * ROW + ROW / 2;
    const conflict = blocked.span.start <= blocker.span.end;
    return [{ id: relation.id, d: `M ${x1} ${y1} h 8 V ${y2} H ${x2}`, conflict }];
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3 text-xs text-fg-muted md:px-4">
        <span className="mr-auto">
          {taskRows.length} {taskRows.length === 1 ? 'task' : 'tasks'} with dates
          {undated > 0 && ` · ${undated} without dates not shown`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (scroller.current) scroller.current.scrollLeft = todayX - left - 3 * DAY;
          }}
        >
          Today
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-[13px] text-fg-muted">
          No task here has a start or due date. Give one a date to place it on the timeline.
        </p>
      ) : (
        <section
          ref={scroller}
          aria-label="Timeline"
          // Focusable so keyboard users can scroll it.
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="relative min-h-0 flex-1 overflow-auto outline-none scrollbar-thin focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
        >
          <div className="relative" style={{ width, height }}>
            {/* Weekend shading and today. */}
            {days.map((day) =>
              [0, 6].includes(parseIsoDate(day).getDay()) ? (
                <div
                  key={day}
                  aria-hidden
                  className="absolute bg-surface-subtle"
                  style={{ left: x(day), width: DAY, top: HEADER, bottom: 0 }}
                />
              ) : null,
            )}
            <div
              aria-hidden
              className="absolute z-[3] w-px bg-accent"
              style={{ left: todayX + DAY / 2, top: HEADER - 6, bottom: 0 }}
            />

            <TimelineHeader days={days} left={left} />

            {rows.map((row, index) =>
              row.kind === 'group' ? (
                <div
                  key={row.key}
                  className="absolute inset-x-0 flex items-center border-b border-border bg-surface-subtle/80"
                  style={{ top: HEADER + index * ROW, height: ROW }}
                >
                  <h3
                    className="sticky left-0 truncate px-3 text-xs font-medium text-fg-muted"
                    style={{ width: left }}
                  >
                    {row.label}
                  </h3>
                </div>
              ) : (
                <div
                  key={row.key}
                  className="absolute inset-x-0 border-b border-border/60"
                  style={{ top: HEADER + index * ROW, height: ROW }}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(row.task, 'peek')}
                    className={cn(
                      'sticky left-0 z-[4] flex h-full items-center gap-2 border-r border-border bg-surface px-3 text-left text-[13px] hover:bg-surface-subtle',
                      peekId === row.task.id && 'bg-surface-muted',
                    )}
                    style={{ width: left }}
                  >
                    <span className="shrink-0 text-xs text-fg-subtle tabular max-md:hidden">
                      {identifier(row.task)}
                    </span>
                    <span className="truncate">{row.task.title}</span>
                  </button>
                  <Bar
                    task={row.task}
                    span={row.span}
                    identifier={identifier(row.task)}
                    left={x(row.span.start)}
                    peeked={peekId === row.task.id}
                    onCommit={commit}
                    onOpen={onOpen}
                    onFocus={() => setFocusedId(row.task.id)}
                    onKeyDown={onBarKeyDown}
                  />
                </div>
              ),
            )}

            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[2] overflow-visible"
              width={width}
              height={height}
            >
              <defs>
                <marker
                  id="timeline-arrow"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
                </marker>
              </defs>
              {arrows.map((arrow) => (
                <path
                  key={arrow.id}
                  d={arrow.d}
                  fill="none"
                  strokeWidth="1.5"
                  className={arrow.conflict ? 'stroke-danger' : 'stroke-fg-subtle'}
                  markerEnd="url(#timeline-arrow)"
                />
              ))}
            </svg>
          </div>
        </section>
      )}
    </div>
  );
}

function TimelineHeader({ days, left }: { days: string[]; left: number }) {
  const months = days.reduce<{ key: string; label: string; start: number; count: number }[]>(
    (list, day, index) => {
      const key = day.slice(0, 7);
      const last = list.at(-1);
      if (last?.key === key) last.count += 1;
      else list.push({ key, label: monthName.format(parseIsoDate(day)), start: index, count: 1 });
      return list;
    },
    [],
  );
  return (
    <div
      aria-hidden
      className="sticky top-0 z-[5] border-b border-border bg-surface"
      style={{ height: HEADER }}
    >
      <div
        className="sticky left-0 z-[6] h-full border-r border-border bg-surface"
        style={{ width: left }}
      />
      {months.map((month) => (
        <div
          key={month.key}
          className="absolute top-0 h-6 truncate border-l border-border px-2 text-[11px] leading-6 font-medium text-fg-muted"
          style={{ left: left + month.start * DAY, width: month.count * DAY }}
        >
          {month.label}
        </div>
      ))}
      {days.map((day, index) => (
        <div
          key={day}
          className="absolute top-6 h-[26px] text-center text-[11px] leading-[26px] text-fg-subtle tabular"
          style={{ left: left + index * DAY, width: DAY }}
        >
          {parseIsoDate(day).getDate()}
        </div>
      ))}
    </div>
  );
}

function Bar({
  task,
  span,
  identifier,
  left,
  peeked,
  onCommit,
  onOpen,
  onFocus,
  onKeyDown,
}: {
  task: Task;
  span: Span;
  identifier: string;
  left: number;
  peeked: boolean;
  onCommit: (task: Task, delta: number, edge: SpanEdge) => void;
  onOpen: (task: Task, mode: 'peek' | 'page') => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent, task: Task) => void;
}) {
  const data = useWorkspaceData();
  const [drag, setDrag] = useState<{ edge: SpanEdge; from: number; delta: number } | null>(null);
  const status = data.statuses.get(task.statusId);
  const closed = status ? isClosedCategory(status.category) : false;
  const started = status?.category === 'started';

  const length = daysBetween(span.start, span.end) + 1;
  const delta = drag?.delta ?? 0;
  const startShift = drag?.edge === 'end' ? 0 : delta;
  const endShift = drag?.edge === 'start' ? 0 : delta;
  const barLeft = left + Math.min(startShift, (length - 1) * DAY + endShift) * DAY;
  const barWidth = Math.max(1, length + endShift - startShift) * DAY - 6;
  // Short bars carry their title beside them instead of inside.
  const narrow = barWidth < 96;

  const begin = (edge: SpanEdge) => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || task.number === null) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ edge, from: event.clientX, delta: 0 });
  };
  const track = (event: PointerEvent<HTMLElement>) => {
    if (!drag) return;
    const next = Math.round((event.clientX - drag.from) / DAY);
    if (next !== drag.delta) setDrag({ ...drag, delta: next });
  };
  const end = () => {
    if (!drag) return;
    if (drag.delta === 0 && drag.edge === 'both') onOpen(task, 'peek');
    else if (drag.delta !== 0) onCommit(task, drag.delta, drag.edge);
    setDrag(null);
  };

  return (
    <>
      <button
        type="button"
        data-bar-id={task.id}
        aria-label={`${identifier} ${task.title}, ${short.format(parseIsoDate(span.start))} to ${short.format(parseIsoDate(span.end))}`}
        onPointerDown={begin('both')}
        onPointerMove={track}
        onPointerUp={end}
        onPointerCancel={() => setDrag(null)}
        onFocus={onFocus}
        onKeyDown={(event) => onKeyDown(event, task)}
        className={cn(
          'group/bar absolute top-1.5 z-[3] flex h-[22px] cursor-grab touch-none items-center gap-1.5 rounded-md border px-2 text-xs outline-none select-none active:cursor-grabbing',
          'focus-visible:ring-2 focus-visible:ring-focus',
          started
            ? 'border-accent bg-accent text-accent-fg'
            : closed
              ? 'border-border bg-surface-muted text-fg-muted line-through'
              : 'border-border-strong bg-surface-emphasis text-fg',
          peeked && 'ring-2 ring-focus',
          drag && 'shadow-md',
        )}
        style={{ left: barLeft + 3, width: barWidth }}
      >
        {(['start', 'end'] as const).map((edge) => (
          <span
            key={edge}
            aria-hidden
            onPointerDown={begin(edge)}
            onPointerMove={track}
            onPointerUp={end}
            className={cn(
              'absolute inset-y-0 w-2 cursor-ew-resize rounded-sm opacity-0 group-hover/bar:opacity-100',
              edge === 'start' ? 'left-0' : 'right-0',
              started ? 'bg-accent-fg/30' : 'bg-fg/15',
            )}
          />
        ))}
        {status && <StatusIcon category={status.category} className="size-3 shrink-0" />}
        {!narrow && <span className="truncate">{task.title}</span>}
      </button>
      {narrow && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 z-[3] max-w-64 truncate text-xs leading-[34px] text-fg-muted"
          style={{ left: barLeft + barWidth + 10 }}
        >
          {task.title}
        </span>
      )}
    </>
  );
}
