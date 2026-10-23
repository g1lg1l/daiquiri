import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { announce } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import {
  addDays,
  addMonths,
  isClosedCategory,
  monthGrid,
  monthOf,
  parseIsoDate,
  reschedule,
  tasksByDueDate,
  type Task,
} from '@daiq/domain';
import { Button, cn, Tooltip } from '@daiq/ui';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { locale, m } from '../../i18n';
import { useToday } from '../../lib/use-today';
import { useShell } from '../shell/shell-context';
import { useShortcuts } from '../shortcuts/use-shortcuts';
import type { SetSearch } from '../views/view-controls';
import { useWorkspaceData } from '../workspace/workspace-context';
import type { ComposerDefaults } from './composer';
import { StatusIcon } from './icons';
import { useTaskActions } from './task-actions';
import { useIdentifier } from './use-identifier';

interface ChipData {
  [key: string | symbol]: unknown;
  type: 'calendar-task';
  taskId: string;
}

const isChipData = (data: Record<string | symbol, unknown>): data is ChipData =>
  data.type === 'calendar-task' && typeof data.taskId === 'string';

/** Drop target data: a day, or `null` for the "No due date" tray. */
const dayOf = (data: Record<string | symbol, unknown>): string | null | undefined =>
  'day' in data && (typeof data.day === 'string' || data.day === null) ? data.day : undefined;

export interface TaskCalendarProps {
  tasks: Task[];
  month: string | undefined;
  setSearch: SetSearch;
  peekId: string | undefined;
  onOpen: (task: Task, mode: 'peek' | 'page') => void;
  onCreate: (defaults: ComposerDefaults) => void;
  composerDefaults: ComposerDefaults;
}

/**
 * Month calendar of tasks by due date (feature spec §6). Drag a task to another
 * day (or onto "No due date") to reschedule it; with the keyboard, Mod+←/→
 * moves it a day and Mod+↑/↓ a week. On phones the month becomes an agenda.
 */
export function TaskCalendar({
  tasks,
  month,
  setSearch,
  peekId,
  onOpen,
  onCreate,
  composerDefaults,
}: TaskCalendarProps) {
  const today = useToday();
  const { isMobile } = useShell();
  const actions = useTaskActions();
  const identifier = useIdentifier();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const { dayLabel, monthLabel, weekdayLabel } = useMemo(
    () => ({
      dayLabel: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
      monthLabel: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
      weekdayLabel: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    }),
    [],
  );

  const current = month ?? monthOf(today);
  const weeks = useMemo(() => monthGrid(current), [current]);
  const byDay = useMemo(() => tasksByDueDate(tasks), [tasks]);
  const undated = useMemo(() => tasks.filter((task) => !task.dueDate), [tasks]);
  const days = weeks.flat();
  // Keyboard order: day by day through the grid, then the undated tray.
  const ordered = useMemo(
    () => [...weeks.flat().flatMap((day) => byDay.get(day.date) ?? []), ...undated],
    [weeks, byDay, undated],
  );
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const focusedTask = focusedId ? tasksById.get(focusedId) : undefined;

  const move = (task: Task, day: string | null) => {
    if (task.dueDate === day) return;
    const patch = day ? reschedule(task, day) : { dueDate: null };
    actions.update([task], patch, day ? m.tasks.undo.reschedule : m.tasks.undo.clearDueDate);
    announce(
      day
        ? m.tasks.calendar.movedTo(identifier(task), dayLabel.format(parseIsoDate(day)))
        : m.tasks.calendar.noDueDate(identifier(task)),
    );
    // Follow the task when it leaves the month on screen.
    if (day && monthOf(day) !== current) setSearch({ month: monthOf(day) });
  };

  const onDrop = useEffectEvent(
    (source: Record<string | symbol, unknown>, target: Record<string | symbol, unknown>) => {
      const task = isChipData(source) ? tasksById.get(source.taskId) : undefined;
      const day = dayOf(target);
      if (task && day !== undefined) move(task, day);
    },
  );

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isChipData(source.data),
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0]?.data;
          if (target) onDrop(source.data, target);
        },
      }),
    [],
  );

  // Focus follows a chip after it re-renders (it moves to another day when rescheduled).
  const refocus = useRef<{ id: string; day: string } | null>(null);
  useLayoutEffect(() => {
    const target = refocus.current;
    const element =
      target &&
      rootRef.current?.querySelector<HTMLElement>(
        `[data-chip-id="${target.id}"][data-day="${target.day}"]`,
      );
    if (element) {
      element.focus();
      refocus.current = null;
    }
  });
  const focusChip = (task: Task | undefined, day = task?.dueDate) => {
    if (!task) return;
    refocus.current = { id: task.id, day: day ?? 'none' };
    setFocusedId(task.id);
  };
  const step = (delta: 1 | -1) => {
    const index = ordered.findIndex((task) => task.id === focusedId);
    focusChip(ordered[index < 0 ? 0 : Math.max(0, Math.min(ordered.length - 1, index + delta))]);
  };

  const onChipKeyDown = (event: KeyboardEvent, task: Task) => {
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(task, event.key === 'Enter' ? 'page' : 'peek');
    } else if (mod && event.key.startsWith('Arrow')) {
      event.preventDefault();
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key] ?? 0;
      if (delta) {
        const day = addDays(task.dueDate ?? today, task.dueDate ? delta : 0);
        move(task, day);
        focusChip(task, day);
      }
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(-1);
    }
  };

  const target = () => (focusedTask ? [focusedTask] : []);
  useShortcuts({
    next: () => step(1),
    previous: () => step(-1),
    open: () => focusedTask && onOpen(focusedTask, 'page'),
    peek: () => focusedTask && onOpen(focusedTask, 'peek'),
    status: () => actions.openPicker('status', target()),
    priority: () => actions.openPicker('priority', target()),
    assignee: () => actions.openPicker('assignee', target()),
    labels: () => actions.openPicker('labels', target()),
    dueDate: () => actions.openPicker('dueDate', target()),
    assignMe: () => actions.toggleAssignMe(target()),
    remove: () => actions.remove(target()),
    copyId: () => focusedTask && actions.copyId(focusedTask),
    copyLink: () => focusedTask && actions.copyLink(focusedTask),
  });

  const chip = (task: Task) => (
    <Chip
      key={task.id}
      task={task}
      day={task.dueDate ?? 'none'}
      identifier={identifier(task)}
      peeked={peekId === task.id}
      overdue={Boolean(task.dueDate && task.dueDate < today)}
      onOpen={onOpen}
      onFocus={() => setFocusedId(task.id)}
      onKeyDown={onChipKeyDown}
    />
  );

  const toolbar = (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-3 md:px-4">
      <h2 className="mr-auto text-[13px] font-semibold font-display" aria-live="polite">
        {monthLabel.format(parseIsoDate(`${current}-01`))}
      </h2>
      <Tooltip label={m.tasks.calendar.previousMonth}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={m.tasks.calendar.previousMonth}
          onClick={() => setSearch({ month: addMonths(current, -1) })}
        >
          <ChevronLeftIcon />
        </Button>
      </Tooltip>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSearch({ month: undefined })}
        disabled={current === monthOf(today)}
      >
        {m.common.today}
      </Button>
      <Tooltip label={m.tasks.calendar.nextMonth}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={m.tasks.calendar.nextMonth}
          onClick={() => setSearch({ month: addMonths(current, 1) })}
        >
          <ChevronRightIcon />
        </Button>
      </Tooltip>
    </div>
  );

  const tray = <Tray count={undated.length}>{undated.map(chip)}</Tray>;

  if (isMobile) {
    const agenda = days.filter((day) => day.inMonth && byDay.has(day.date));
    return (
      <div ref={rootRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {toolbar}
        <div className="flex flex-col gap-4 p-3">
          {agenda.length === 0 && (
            <p className="px-1 text-[13px] text-fg-muted">{m.tasks.calendar.nothingDue}</p>
          )}
          {agenda.map((day) => (
            <section key={day.date} aria-label={dayLabel.format(parseIsoDate(day.date))}>
              <h3
                className={cn(
                  'mb-1 px-1 text-xs font-medium text-fg-muted',
                  day.date === today && 'text-accent-text',
                )}
              >
                {dayLabel.format(parseIsoDate(day.date))}
              </h3>
              <div className="flex flex-col gap-1">{byDay.get(day.date)?.map(chip)}</div>
            </section>
          ))}
          <div className="rounded-lg bg-surface-subtle">{tray}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1">
      <section
        aria-label={m.tasks.calendar.label(monthLabel.format(parseIsoDate(`${current}-01`)))}
        className="flex min-w-0 flex-1 flex-col"
      >
        {toolbar}
        <div aria-hidden className="grid grid-cols-7 border-b border-border">
          {weeks[0]?.map((day) => (
            <div key={day.date} className="px-2 py-1.5 text-[11px] font-medium text-fg-subtle">
              {weekdayLabel.format(parseIsoDate(day.date))}
            </div>
          ))}
        </div>
        <ol
          aria-label={m.tasks.calendar.days}
          className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto scrollbar-thin"
          style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(7.5rem, 1fr))` }}
        >
          {days.map((day) => {
            const dayTasks = byDay.get(day.date) ?? [];
            const label = dayLabel.format(parseIsoDate(day.date));
            return (
              <DayCell
                key={day.date}
                day={day.date}
                label={m.tasks.calendar.day(label, dayTasks.length)}
                className={cn(
                  'group/day flex min-h-0 flex-col gap-1 border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0',
                  !day.inMonth && 'bg-surface-subtle/60',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs tabular',
                      day.inMonth ? 'text-fg-muted' : 'text-fg-subtle',
                      day.date === today && 'bg-accent font-semibold text-accent-fg',
                    )}
                  >
                    {parseIsoDate(day.date).getDate()}
                  </span>
                  <Tooltip label={m.tasks.calendar.createDue(label)}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover/day:opacity-100 focus-visible:opacity-100"
                      aria-label={m.tasks.calendar.createDue(label)}
                      onClick={() => onCreate({ ...composerDefaults, dueDate: day.date })}
                    >
                      <PlusIcon />
                    </Button>
                  </Tooltip>
                </div>
                <div className="flex min-h-0 flex-col gap-1 overflow-y-auto scrollbar-thin">
                  {dayTasks.map(chip)}
                </div>
              </DayCell>
            );
          })}
        </ol>
      </section>
      <aside className="w-60 shrink-0 overflow-y-auto border-l border-border bg-surface-subtle scrollbar-thin">
        {tray}
      </aside>
    </div>
  );
}

/** Makes an element a drop target for task chips: a day, or `null` for the undated tray. */
function useDropTarget(day: string | null) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!element) return;
    return dropTargetForElements({
      element,
      getData: () => ({ day }),
      canDrop: ({ source }) => isChipData(source.data),
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: () => setOver(false),
    });
  }, [element, day]);
  return { ref: setElement, over };
}

function DayCell({
  day,
  label,
  className,
  children,
}: {
  day: string;
  label: string;
  className: string;
  children: ReactNode;
}) {
  const { ref, over } = useDropTarget(day);
  return (
    <li ref={ref} className={cn(className, 'transition-colors', over && 'bg-accent-subtle/50')}>
      <span className="sr-only">{label}</span>
      {children}
    </li>
  );
}

function Tray({ count, children }: { count: number; children: ReactNode }) {
  const { ref, over } = useDropTarget(null);
  return (
    <section
      ref={ref}
      aria-label={m.tasks.calendar.tray(count)}
      className={cn(
        'flex min-h-24 flex-col gap-1 p-2 transition-colors',
        over && 'bg-accent-subtle/50',
      )}
    >
      <h3 aria-hidden className="px-1 pb-1 text-[11px] font-medium text-fg-subtle">
        {m.tasks.calendar.trayTitle} <span className="tabular">{count}</span>
      </h3>
      {children}
    </section>
  );
}

function Chip({
  task,
  day,
  identifier,
  peeked,
  overdue,
  onOpen,
  onFocus,
  onKeyDown,
}: {
  task: Task;
  day: string;
  identifier: string;
  peeked: boolean;
  overdue: boolean;
  onOpen: (task: Task, mode: 'peek' | 'page') => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent, task: Task) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const data = useWorkspaceData();
  const status = data.statuses.get(task.statusId);
  const closed = status ? isClosedCategory(status.category) : false;

  useEffect(() => {
    const element = ref.current;
    if (!element || task.number === null) return;
    const chipData: ChipData = { type: 'calendar-task', taskId: task.id };
    return draggable({
      element,
      getInitialData: () => chipData,
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [task.id, task.number]);

  return (
    // A div, not a <button>: Firefox cannot start native drags from buttons.
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      data-chip-id={task.id}
      data-day={day}
      aria-label={
        overdue && !closed
          ? m.tasks.calendar.overdue(`${identifier} ${task.title}`)
          : `${identifier} ${task.title}`
      }
      title={`${identifier} ${task.title}`}
      onClick={() => onOpen(task, 'peek')}
      onFocus={onFocus}
      onKeyDown={(event) => onKeyDown(event, task)}
      className={cn(
        'flex h-6 shrink-0 cursor-grab items-center gap-1.5 rounded-md border border-border bg-surface px-1.5 text-xs shadow-xs outline-none active:cursor-grabbing',
        'hover:border-border-strong focus-visible:ring-2 focus-visible:ring-focus',
        overdue && !closed && 'border-l-2 border-l-danger',
        peeked && 'border-focus',
        dragging && 'opacity-40',
      )}
    >
      {status && <StatusIcon category={status.category} className="size-3 shrink-0" />}
      <span className={cn('truncate', closed && 'text-fg-muted line-through')}>{task.title}</span>
    </div>
  );
}
