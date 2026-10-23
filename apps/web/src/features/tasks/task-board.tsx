import { useSetFieldValue } from '@daiq/data';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { announce } from '@atlaskit/pragmatic-drag-and-drop-live-region';
import {
  fieldKeys,
  formatDueDate,
  isClosedCategory,
  isPriority,
  NONE,
  sortKeyBetween,
  type CustomField,
  type FieldValue,
  type GroupBy,
  type Task,
  type TaskGroup,
  type TaskPatch,
} from '@daiq/domain';
import { Avatar, Button, cn, Tooltip } from '@daiq/ui';
import { PaperclipIcon, PlusIcon, RepeatIcon } from 'lucide-react';
import {
  memo,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useToday } from '../../lib/use-today';
import { useShortcuts } from '../shortcuts/use-shortcuts';
import { useWorkspaceData } from '../workspace/workspace-context';
import type { ComposerDefaults } from './composer';
import { PriorityIcon, StatusIcon } from './icons';
import { LABEL_COLOR } from './label-colors';
import { useTaskActions } from './task-actions';
import { useIdentifier } from './use-identifier';

// ponytail: columns render every card; virtualise columns past ~300 cards if profiling shows jank.

interface CardData {
  [key: string | symbol]: unknown;
  type: 'card';
  taskId: string;
  groupKey: string;
  /** The swimlane the card is in ('' without swimlanes). */
  laneKey: string;
}

function isCardData(data: Record<string | symbol, unknown>): data is CardData {
  return (
    data.type === 'card' &&
    typeof data.taskId === 'string' &&
    typeof data.groupKey === 'string' &&
    typeof data.laneKey === 'string'
  );
}

/** A swimlane: the board's columns again, for the tasks with one value of a second property. */
export interface BoardLane {
  key: string;
  label: string;
  taskIds: ReadonlySet<string>;
}

type Patch = NonNullable<ReturnType<typeof patchForMove>>;

/** Moves between columns write the column's property (ADR-0011). */
function patchForMove(
  groupBy: GroupBy,
  task: Task,
  from: string,
  to: string,
  field: CustomField | undefined,
):
  | TaskPatch
  | { assigneeIds: string[] }
  | { labelIds: string[] }
  | { fieldValue: FieldValue | null }
  | null {
  if (from === to) return {};
  switch (groupBy) {
    case 'status':
      return { statusId: to };
    case 'priority': {
      const priority = Number(to);
      return isPriority(priority) ? { priority } : null;
    }
    case 'project':
      return { projectId: to === NONE ? null : to };
    case 'assignee':
      return {
        assigneeIds: [
          ...task.assigneeIds.filter((id) => id !== from),
          ...(to === NONE ? [] : [to]),
        ],
      };
    case 'label':
      return {
        labelIds: [...task.labelIds.filter((id) => id !== from), ...(to === NONE ? [] : [to])],
      };
    case 'milestone':
      return { milestoneId: to === NONE ? null : to };
    case 'field': {
      if (!field) return null;
      if (to === NONE) return { fieldValue: null };
      if (field.kind === 'checkbox') return { fieldValue: to === 'true' };
      if (field.kind === 'multi_select') {
        const current = fieldKeys(task.fields[field.id]).filter((id) => id !== from);
        return { fieldValue: [...current, to] };
      }
      return { fieldValue: to };
    }
    case 'due':
    case 'none':
      return null; // due buckets and "none" have no single value to write
    default:
      return groupBy satisfies never;
  }
}

export interface TaskBoardProps {
  groups: TaskGroup[];
  /** The custom field columns stand for, when grouped by field. */
  groupField?: CustomField;
  groupBy: GroupBy;
  canReorder: boolean;
  peekId: string | undefined;
  onOpen: (task: Task, mode: 'peek' | 'page') => void;
  composerDefaults: (group: TaskGroup, lane?: BoardLane) => ComposerDefaults;
  onCreate: (defaults: ComposerDefaults) => void;
  /** Swimlanes, and the property (and custom field) they stand for. */
  lanes?: BoardLane[];
  laneBy?: GroupBy;
  laneField?: CustomField;
}

export function TaskBoard({
  groups,
  groupField,
  groupBy,
  canReorder,
  peekId,
  onOpen,
  composerDefaults,
  onCreate,
  lanes,
  laneBy,
  laneField,
}: TaskBoardProps) {
  const actions = useTaskActions();
  const setField = useSetFieldValue();
  const identifier = useIdentifier();
  const data = useWorkspaceData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<{ lane: number; column: number; row: number } | null>(
    null,
  );
  const tasksById = useMemo(
    () => new Map(groups.flatMap((g) => g.tasks.map((t) => [t.id, t]))),
    [groups],
  );
  const today = useToday();
  const rows: (BoardLane | undefined)[] = lanes ?? [undefined];
  /** The cards of one column in one lane. */
  const cell = (lane: BoardLane | undefined, group: TaskGroup | undefined) =>
    (group?.tasks ?? []).filter((t) => !lane || lane.taskIds.has(t.id));

  /** Applies one property change; plain fields are collected into `plain`. */
  const applyPatch = (
    task: Task,
    patch: Patch,
    field: CustomField | undefined,
    plain: TaskPatch,
  ) => {
    if ('fieldValue' in patch) {
      if (field) setField.mutate({ task, fieldId: field.id, value: patch.fieldValue });
    } else if ('assigneeIds' in patch) actions.setAssignees([task], patch.assigneeIds);
    else if ('labelIds' in patch) actions.setLabels([task], patch.labelIds);
    else if ('statusId' in patch && patch.statusId) actions.setStatus([task], patch.statusId);
    else Object.assign(plain, patch);
  };

  const applyMove = (
    task: Task,
    fromKey: string,
    toKey: string,
    index: number,
    fromLane = '',
    toLane = '',
  ) => {
    const target = groups.find((g) => g.key === toKey);
    const lane = lanes?.find((l) => l.key === toLane);
    if (!target) return;
    const patch = patchForMove(groupBy, task, fromKey, toKey, groupField);
    const lanePatch =
      lanes && laneBy && fromLane !== toLane
        ? patchForMove(laneBy, task, fromLane, toLane, laneField)
        : {};
    if (patch === null || lanePatch === null) {
      announce('Tasks cannot be moved there.');
      return;
    }
    const others = cell(lane, target).filter((t) => t.id !== task.id);
    const clamped = Math.max(0, Math.min(index, others.length));
    const plain: TaskPatch = canReorder
      ? {
          sortKey: sortKeyBetween(
            others[clamped - 1]?.sortKey ?? null,
            others[clamped]?.sortKey ?? null,
          ),
        }
      : {};
    applyPatch(task, patch, groupField, plain);
    applyPatch(task, lanePatch, laneField, plain);
    const moved = fromKey !== toKey || fromLane !== toLane;
    if (Object.keys(plain).length > 0)
      actions.update([task], plain, moved ? `Move to ${target.label}` : 'Reorder');
    announce(
      moved
        ? `${identifier(task)} moved to ${target.label}${lane ? ` in ${lane.label}` : ''}`
        : `${identifier(task)} moved to position ${clamped + 1}`,
    );
  };

  const onDrop = useEffectEvent(
    (
      source: Record<string | symbol, unknown>,
      targetData: Record<string | symbol, unknown> | undefined,
    ) => {
      if (!targetData || !isCardData(source)) return;
      const task = tasksById.get(source.taskId);
      if (!task) return;
      if (isCardData(targetData)) {
        const lane = lanes?.find((l) => l.key === targetData.laneKey);
        const others = cell(
          lane,
          groups.find((g) => g.key === targetData.groupKey),
        ).filter((t) => t.id !== task.id);
        const overIndex = others.findIndex((t) => t.id === targetData.taskId);
        const edge = extractClosestEdge(targetData);
        applyMove(
          task,
          source.groupKey,
          targetData.groupKey,
          overIndex + (edge === 'bottom' ? 1 : 0),
          source.laneKey,
          targetData.laneKey,
        );
      } else if (typeof targetData.columnKey === 'string') {
        const laneKey = typeof targetData.laneKey === 'string' ? targetData.laneKey : '';
        const lane = lanes?.find((l) => l.key === laneKey);
        const column = groups.find((g) => g.key === targetData.columnKey);
        applyMove(
          task,
          source.groupKey,
          targetData.columnKey,
          cell(lane, column).length,
          source.laneKey,
          laneKey,
        );
      }
    },
  );

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    return combine(
      autoScrollForElements({ element }),
      monitorForElements({
        canMonitor: ({ source }) => isCardData(source.data),
        onDrop: ({ source, location }) =>
          onDrop(source.data, location.current.dropTargets[0]?.data),
      }),
    );
  }, []);

  const cardsAt = (lane: number, column: number) => cell(rows[lane], groups[column]);
  const focusCard = (lane: number, column: number, row: number) => {
    const cards = cardsAt(lane, column);
    const task = cards[Math.max(0, Math.min(row, cards.length - 1))];
    if (!task) return;
    setFocused({ lane, column, row: cards.indexOf(task) });
    scrollRef.current
      ?.querySelector<HTMLElement>(
        `[data-card-id="${task.id}"][data-lane="${rows[lane]?.key ?? ''}"]`,
      )
      ?.focus();
  };
  const focusedTask = focused ? cardsAt(focused.lane, focused.column)[focused.row] : undefined;
  const target = () =>
    focusedTask ? [focusedTask] : peekId && tasksById.get(peekId) ? [tasksById.get(peekId)!] : [];
  const nonEmpty = (lane: number, from: number, step: 1 | -1) => {
    for (let i = from + step; i >= 0 && i < groups.length; i += step)
      if (cardsAt(lane, i).length) return i;
    return null;
  };
  /** Down from the last card of a cell goes on to the next lane with cards in that column. */
  const vertical = (step: 1 | -1) => {
    if (!focused) return;
    const row = focused.row + step;
    if (row >= 0 && row < cardsAt(focused.lane, focused.column).length) {
      focusCard(focused.lane, focused.column, row);
      return;
    }
    for (let lane = focused.lane + step; lane >= 0 && lane < rows.length; lane += step) {
      const count = cardsAt(lane, focused.column).length;
      if (count) {
        focusCard(lane, focused.column, step === 1 ? 0 : count - 1);
        return;
      }
    }
  };
  const onArrow = (key: string) => {
    if (!focused) return;
    if (key === 'ArrowRight') {
      const next = nonEmpty(focused.lane, focused.column, 1);
      if (next !== null) focusCard(focused.lane, next, focused.row);
    }
    if (key === 'ArrowLeft') {
      const previous = nonEmpty(focused.lane, focused.column, -1);
      if (previous !== null) focusCard(focused.lane, previous, focused.row);
    }
    if (key === 'ArrowDown') vertical(1);
    if (key === 'ArrowUp') vertical(-1);
  };
  const reorder = (step: 1 | -1) => {
    if (!focusedTask || !focused || !canReorder) return;
    const key = groups[focused.column]?.key ?? '';
    const laneKey = rows[focused.lane]?.key ?? '';
    applyMove(focusedTask, key, key, focused.row + step, laneKey, laneKey);
  };

  useShortcuts({
    next: () => (focused ? vertical(1) : focusCard(0, nonEmpty(0, -1, 1) ?? 0, 0)),
    previous: () => vertical(-1),
    open: () => focusedTask && onOpen(focusedTask, 'page'),
    peek: () => focusedTask && onOpen(focusedTask, 'peek'),
    status: () => actions.openPicker('status', target()),
    priority: () => actions.openPicker('priority', target()),
    assignee: () => actions.openPicker('assignee', target()),
    labels: () => actions.openPicker('labels', target()),
    dueDate: () => actions.openPicker('dueDate', target()),
    estimate: () => actions.openPicker('estimate', target()),
    cycle: () => actions.openPicker('cycle', target()),
    assignMe: () => actions.toggleAssignMe(target()),
    remove: () => actions.remove(target()),
    moveUp: () => reorder(-1),
    moveDown: () => reorder(1),
  });

  const columns = (lane: BoardLane | undefined, laneIndex: number) =>
    groups.map((group, columnIndex) => {
      const cards = cell(lane, group);
      return (
        <Column
          key={group.key}
          group={group}
          lane={lane}
          count={cards.length}
          onCreate={() => onCreate(composerDefaults(group, lane))}
        >
          {cards.map((task, rowIndex) => (
            <Card
              key={task.id}
              task={task}
              groupKey={group.key}
              laneKey={lane?.key ?? ''}
              identifier={identifier(task)}
              peeked={peekId === task.id}
              onOpen={onOpen}
              onFocus={() => setFocused({ lane: laneIndex, column: columnIndex, row: rowIndex })}
              onArrow={onArrow}
              today={today}
              data={data}
            />
          ))}
        </Column>
      );
    });

  if (lanes) {
    return (
      <section
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-3 scrollbar-thin md:p-4"
        aria-label="Board"
      >
        {lanes.map((lane, laneIndex) => (
          <section
            key={lane.key}
            aria-label={`${lane.label}, ${lane.taskIds.size} tasks`}
            className="flex w-max flex-col gap-2"
          >
            <h2 className="sticky left-0 flex w-fit items-center gap-2 px-1 text-[13px] font-semibold">
              {lane.label}
              <span className="text-xs font-normal text-fg-subtle tabular">
                {lane.taskIds.size}
              </span>
            </h2>
            <div className="flex gap-3">{columns(lane, laneIndex)}</div>
          </section>
        ))}
      </section>
    );
  }

  return (
    <section
      ref={scrollRef}
      className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-3 scrollbar-thin md:p-4"
      aria-label="Board"
    >
      {columns(undefined, 0)}
    </section>
  );
}

function Column({
  group,
  lane,
  count,
  onCreate,
  children,
}: {
  group: TaskGroup;
  lane: BoardLane | undefined;
  count: number;
  onCreate: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const groupPriority = group.kind === 'priority' ? Number(group.key) : Number.NaN;
  const laneKey = lane?.key ?? '';
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      getData: () => ({ columnKey: group.key, laneKey }),
      canDrop: ({ source }) => isCardData(source.data),
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: () => setOver(false),
    });
  }, [group.key, laneKey]);

  return (
    <section
      aria-label={`${group.label}${lane ? ` in ${lane.label}` : ''}, ${count} tasks`}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl bg-surface-subtle',
        lane && 'max-h-[70vh]',
      )}
    >
      <header className="group/col flex h-10 items-center gap-2 px-3">
        {group.category && <StatusIcon category={group.category} />}
        {isPriority(groupPriority) && <PriorityIcon priority={groupPriority} />}
        <h2 className="truncate text-[13px] font-medium">{group.label}</h2>
        <span className="text-xs text-fg-subtle tabular">{count}</span>
        <Tooltip label={`Create in ${group.label}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto opacity-0 group-hover/col:opacity-100 focus-visible:opacity-100"
            aria-label={`Create task in ${group.label}`}
            onClick={onCreate}
          >
            <PlusIcon />
          </Button>
        </Tooltip>
      </header>
      <div
        ref={ref}
        className={cn(
          'flex min-h-16 flex-1 flex-col gap-1.5 overflow-y-auto rounded-b-xl px-2 pb-2 transition-colors scrollbar-thin',
          over && 'bg-accent-subtle/40',
        )}
      >
        {children}
      </div>
    </section>
  );
}

const Card = memo(function Card({
  task,
  groupKey,
  laneKey,
  identifier,
  peeked,
  onOpen,
  onFocus,
  onArrow,
  today,
  data,
}: {
  task: Task;
  groupKey: string;
  laneKey: string;
  identifier: string;
  peeked: boolean;
  onOpen: (task: Task, mode: 'peek' | 'page') => void;
  onFocus: () => void;
  onArrow: (key: string) => void;
  today: string;
  data: ReturnType<typeof useWorkspaceData>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [edge, setEdge] = useState<Edge | null>(null);
  const status = data.statuses.get(task.statusId);
  const closed = status ? isClosedCategory(status.category) : false;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(task, event.key === 'Enter' ? 'page' : 'peek');
    } else if (event.key.startsWith('Arrow') && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      onArrow(event.key);
    }
  };

  useEffect(() => {
    const element = ref.current;
    if (!element || task.number === null) return;
    const cardData: CardData = { type: 'card', taskId: task.id, groupKey, laneKey };
    return combine(
      draggable({
        element,
        getInitialData: () => cardData,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element,
        getData: ({ input }) =>
          attachClosestEdge(cardData, { element, input, allowedEdges: ['top', 'bottom'] }),
        canDrop: ({ source }) => isCardData(source.data) && source.data.taskId !== task.id,
        onDrag: ({ self }) => setEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setEdge(null),
        onDrop: () => setEdge(null),
      }),
    );
  }, [task.id, task.number, groupKey, laneKey]);

  return (
    // A div, not a <button>: Firefox cannot start native drags from buttons.
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-card-id={task.id}
      data-lane={laneKey}
      aria-label={`${identifier} ${task.title}`}
      onClick={() => onOpen(task, 'peek')}
      onFocus={onFocus}
      className={cn(
        'relative flex cursor-grab flex-col gap-1.5 rounded-lg border border-border bg-surface p-2.5 text-[13px] shadow-xs transition-[opacity,box-shadow] duration-150 outline-none active:cursor-grabbing',
        'hover:border-border-strong focus-visible:ring-2 focus-visible:ring-focus',
        dragging && 'opacity-40',
        peeked && 'border-focus',
        task.number === null && 'animate-in duration-200 fade-in-0 zoom-in-95',
      )}
    >
      {edge && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-x-1 h-0.5 rounded-full bg-focus',
            edge === 'top' ? '-top-1' : '-bottom-1',
          )}
        />
      )}
      <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
        {status && <StatusIcon category={status.category} className="size-3" />}
        <span className="tabular">{identifier}</span>
        {task.recurring && <RepeatIcon role="img" aria-label="Repeats" className="size-3" />}
      </div>
      <p className={cn('line-clamp-2 leading-snug', closed && 'text-fg-muted')}>{task.title}</p>
      <div className="flex items-center gap-1.5">
        <PriorityIcon priority={task.priority} />
        {task.labelIds.slice(0, 3).map((id) => {
          const label = data.labelsById.get(id);
          return label ? (
            <span
              key={id}
              className="inline-flex h-5 items-center gap-1 rounded-full border border-border px-1.5 text-[11px] text-fg-muted"
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: LABEL_COLOR[label.color] }}
              />
              {label.name}
            </span>
          ) : null;
        })}
        {task.attachmentCount > 0 && (
          <span
            className="flex items-center gap-0.5 text-[11px] text-fg-subtle tabular"
            aria-label={`${task.attachmentCount} ${task.attachmentCount === 1 ? 'attachment' : 'attachments'}`}
          >
            <PaperclipIcon aria-hidden className="size-3" />
            {task.attachmentCount}
          </span>
        )}
        {data.teamsById.get(task.teamId)?.estimatesEnabled && task.estimate !== null && (
          <span className="rounded-sm border border-border px-1 text-[11px] text-fg-muted tabular">
            {data.teamsById.get(task.teamId)?.estimateScale === 'hours'
              ? `${task.estimate}h`
              : task.estimate}
          </span>
        )}
        {task.dueDate && (
          <span
            className={cn(
              'text-[11px] tabular',
              !closed && task.dueDate < today ? 'font-medium text-danger' : 'text-fg-subtle',
            )}
          >
            {formatDueDate(task.dueDate, today)}
          </span>
        )}
        <span className="ml-auto flex -space-x-1.5">
          {task.assigneeIds.slice(0, 3).map((id) => (
            <Avatar
              key={id}
              name={data.membersById.get(id)?.displayName ?? '?'}
              size="sm"
              className="ring-2 ring-surface"
            />
          ))}
        </span>
      </div>
    </div>
  );
});
