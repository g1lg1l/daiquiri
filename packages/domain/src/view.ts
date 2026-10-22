import { z } from 'zod';
import { addDays, dueBucket, startOfWeek, type DueBucket } from './dates';
import type { Label, Project, Status, Task } from './model';
import { prioritySortKey } from './priority';
import { compareSortKeys } from './ordering';
import { isClosedCategory, STATUS_CATEGORIES, type StatusCategory } from './status';

/*
 * View engine: filtering, grouping and ordering are pure functions over the
 * task model, shared by list, board and personal views (product principle 5).
 * View state is URL search params validated by `viewSearchSchema`.
 */

export const GROUP_BY = [
  'status',
  'priority',
  'assignee',
  'project',
  'label',
  'due',
  'none',
] as const;
export const ORDER_BY = ['manual', 'priority', 'due', 'created', 'updated', 'title'] as const;
export const COMPLETED_VISIBILITY = ['all', 'week', 'none'] as const;
export const LAYOUTS = ['list', 'board'] as const;
export const DUE_FILTERS = ['overdue', 'today', 'week', 'none', 'any'] as const;

export type GroupBy = (typeof GROUP_BY)[number];
export type OrderBy = (typeof ORDER_BY)[number];
export type CompletedVisibility = (typeof COMPLETED_VISIBILITY)[number];
export type Layout = (typeof LAYOUTS)[number];
export type DueFilter = (typeof DUE_FILTERS)[number];

/** Special assignee filter values besides user ids. */
export const ME = 'me';
export const NONE = 'none';

const idList = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => (Array.isArray(value) ? value : value.split(',')).filter(Boolean))
  .optional();

/** URL search params of any task view. Unknown or invalid values fall back to defaults. */
export const viewSearchSchema = z.object({
  layout: z.enum(LAYOUTS).optional().catch(undefined),
  group: z.enum(GROUP_BY).optional().catch(undefined),
  order: z.enum(ORDER_BY).optional().catch(undefined),
  completed: z.enum(COMPLETED_VISIBILITY).optional().catch(undefined),
  status: idList.catch(undefined),
  category: z.array(z.enum(STATUS_CATEGORIES)).optional().catch(undefined),
  priority: z.array(z.coerce.number().int().min(0).max(4)).optional().catch(undefined),
  assignee: idList.catch(undefined),
  label: idList.catch(undefined),
  project: idList.catch(undefined),
  due: z.enum(DUE_FILTERS).optional().catch(undefined),
  q: z.string().max(200).optional().catch(undefined),
  peek: z.string().max(20).optional().catch(undefined),
});

export type ViewSearch = z.infer<typeof viewSearchSchema>;

export interface ViewDefaults {
  layout: Layout;
  group: GroupBy;
  order: OrderBy;
  completed: CompletedVisibility;
}

export const DEFAULT_VIEW: ViewDefaults = {
  layout: 'list',
  group: 'status',
  order: 'manual',
  completed: 'week',
};

export interface ViewContext {
  userId: string;
  today: string;
  statuses: ReadonlyMap<string, Status>;
}

const FILTER_KEYS = [
  'status',
  'category',
  'priority',
  'assignee',
  'label',
  'project',
  'due',
  'q',
] as const;

export function hasActiveFilters(search: ViewSearch): boolean {
  return FILTER_KEYS.some((key) => {
    const value = search[key];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '';
  });
}

function matchesIds(
  selected: readonly string[] | undefined,
  values: readonly string[],
  userId: string,
): boolean {
  if (!selected?.length) return true;
  const wanted = new Set(selected.map((id) => (id === ME ? userId : id)));
  if (wanted.has(NONE) && values.length === 0) return true;
  return values.some((value) => wanted.has(value));
}

function matchesDue(filter: DueFilter | undefined, due: string | null, today: string): boolean {
  if (!filter) return true;
  if (filter === 'none') return due === null;
  if (filter === 'any') return due !== null;
  if (!due) return false;
  if (filter === 'overdue') return due < today;
  if (filter === 'today') return due <= today;
  return due < addDays(startOfWeek(today), 7);
}

export function filterTasks(
  tasks: readonly Task[],
  search: ViewSearch,
  context: ViewContext,
): Task[] {
  const text = search.q?.trim().toLowerCase();
  const weekAgo = addDays(context.today, -7);
  const completed = search.completed ?? DEFAULT_VIEW.completed;

  return tasks.filter((task) => {
    const category = context.statuses.get(task.statusId)?.category;
    if (category && isClosedCategory(category)) {
      if (completed === 'none') return false;
      const closedAt = task.completedAt ?? task.canceledAt;
      if (completed === 'week' && closedAt && closedAt.slice(0, 10) < weekAgo) return false;
    }
    if (search.status?.length && !search.status.includes(task.statusId)) return false;
    if (search.category?.length && (!category || !search.category.includes(category))) return false;
    if (search.priority?.length && !search.priority.includes(task.priority)) return false;
    if (!matchesIds(search.assignee, task.assigneeIds, context.userId)) return false;
    if (!matchesIds(search.label, task.labelIds, context.userId)) return false;
    if (!matchesIds(search.project, task.projectId ? [task.projectId] : [], context.userId))
      return false;
    if (!matchesDue(search.due, task.dueDate, context.today)) return false;
    if (text && !task.title.toLowerCase().includes(text)) return false;
    return true;
  });
}

function compareNullableDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

function byManual(a: Task, b: Task): number {
  return compareSortKeys(a.sortKey, b.sortKey) || a.id.localeCompare(b.id);
}

export function sortTasks(tasks: readonly Task[], order: OrderBy): Task[] {
  const comparators: Record<OrderBy, (a: Task, b: Task) => number> = {
    manual: byManual,
    priority: (a, b) => prioritySortKey(a.priority) - prioritySortKey(b.priority) || byManual(a, b),
    due: (a, b) => compareNullableDates(a.dueDate, b.dueDate) || byManual(a, b),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  };
  return [...tasks].sort(comparators[order]);
}

export interface TaskGroup {
  /** Stable key; also the value written to the task when an item is dropped in the group. */
  key: string;
  kind: GroupBy;
  label: string;
  tasks: Task[];
  category?: StatusCategory;
}

export interface GroupContext extends ViewContext {
  /** Statuses of the team(s) being shown, in workflow order. Empty groups are kept for status. */
  orderedStatuses: readonly Status[];
  members: ReadonlyMap<string, { displayName: string }>;
  projects: ReadonlyMap<string, Project>;
  labels: ReadonlyMap<string, Label>;
}

const PRIORITY_GROUPS: [number, string][] = [
  [1, 'Urgent'],
  [2, 'High'],
  [3, 'Medium'],
  [4, 'Low'],
  [0, 'No priority'],
];

const DUE_GROUP_ORDER: DueBucket[] = [
  'overdue',
  'today',
  'this_week',
  'next_week',
  'later',
  'none',
];
const DUE_GROUP_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  this_week: 'This week',
  next_week: 'Next week',
  later: 'Later',
  none: 'No due date',
};

/** Groups already-sorted tasks. A task with several assignees/labels appears in each group. */
export function groupTasks(
  tasks: readonly Task[],
  groupBy: GroupBy,
  context: GroupContext,
): TaskGroup[] {
  const bucket = (entries: [string, string][], keysOf: (task: Task) => string[]): TaskGroup[] => {
    const groups = new Map(
      entries.map(([key, label]) => [key, { key, kind: groupBy, label, tasks: [] as Task[] }]),
    );
    for (const task of tasks) {
      for (const key of keysOf(task)) groups.get(key)?.tasks.push(task);
    }
    return [...groups.values()];
  };

  switch (groupBy) {
    case 'none':
      return [{ key: 'all', kind: 'none', label: 'All tasks', tasks: [...tasks] }];
    case 'status': {
      const groups = context.orderedStatuses.map((status) => ({
        key: status.id,
        kind: groupBy,
        label: status.name,
        category: status.category,
        tasks: tasks.filter((task) => task.statusId === status.id),
      }));
      return groups;
    }
    case 'priority':
      return bucket(
        PRIORITY_GROUPS.map(([value, label]) => [String(value), label]),
        (task) => [String(task.priority)],
      ).filter((group) => group.tasks.length > 0);
    case 'due':
      return bucket(
        DUE_GROUP_ORDER.map((key) => [key, DUE_GROUP_LABEL[key]]),
        (task) => [dueBucket(task.dueDate, context.today)],
      ).filter((group) => group.tasks.length > 0);
    case 'assignee': {
      const ids = [...new Set(tasks.flatMap((task) => task.assigneeIds))].sort((a, b) =>
        (context.members.get(a)?.displayName ?? '').localeCompare(
          context.members.get(b)?.displayName ?? '',
        ),
      );
      const me = ids.includes(context.userId) ? [context.userId] : [];
      return bucket(
        [
          ...[...me, ...ids.filter((id) => id !== context.userId)].map((id): [string, string] => [
            id,
            context.members.get(id)?.displayName ?? 'Former member',
          ]),
          [NONE, 'No assignee'],
        ],
        (task) => (task.assigneeIds.length ? task.assigneeIds : [NONE]),
      ).filter((group) => group.tasks.length > 0);
    }
    case 'project': {
      const ids = [...new Set(tasks.flatMap((task) => (task.projectId ? [task.projectId] : [])))];
      return bucket(
        [
          ...ids.map((id): [string, string] => [id, context.projects.get(id)?.name ?? 'Project']),
          [NONE, 'No project'],
        ],
        (task) => [task.projectId ?? NONE],
      ).filter((group) => group.tasks.length > 0);
    }
    case 'label': {
      const ids = [...new Set(tasks.flatMap((task) => task.labelIds))].sort((a, b) =>
        (context.labels.get(a)?.name ?? '').localeCompare(context.labels.get(b)?.name ?? ''),
      );
      return bucket(
        [
          ...ids.map((id): [string, string] => [id, context.labels.get(id)?.name ?? 'Label']),
          [NONE, 'No label'],
        ],
        (task) => (task.labelIds.length ? task.labelIds : [NONE]),
      ).filter((group) => group.tasks.length > 0);
    }
    default:
      return groupBy satisfies never;
  }
}

/** Children listed right after their parent when both are in the same list (consistent at any depth). */
export function nestSubtasks(tasks: readonly Task[]): { task: Task; depth: number }[] {
  const ids = new Set(tasks.map((task) => task.id));
  const children = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.parentId && ids.has(task.parentId)) {
      const siblings = children.get(task.parentId) ?? [];
      siblings.push(task);
      children.set(task.parentId, siblings);
    }
  }
  const result: { task: Task; depth: number }[] = [];
  const visit = (task: Task, depth: number) => {
    result.push({ task, depth });
    for (const child of children.get(task.id) ?? []) visit(child, depth + 1);
  };
  for (const task of tasks) {
    if (!task.parentId || !ids.has(task.parentId)) visit(task, 0);
  }
  return result;
}
