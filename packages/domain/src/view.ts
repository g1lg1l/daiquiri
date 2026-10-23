import { z } from 'zod';
import { addDays, DUE_BUCKET_LABEL, dueBucket, startOfWeek, type DueBucket } from './dates';
import { fieldKeys, matchesFieldFilters, parseFieldFilter } from './fields';
import type { CustomField, Label, Milestone, Project, Status, Task } from './model';
import { PRIORITY_LABEL, prioritySortKey, type Priority } from './priority';
import { compareSortKeys } from './ordering';
import { isClosedCategory, STATUS_CATEGORIES, type StatusCategory } from './status';
import { words } from './text';

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
  'milestone',
  'label',
  'field',
  'due',
  'none',
] as const;

/** Groupings that make sense for every list; 'milestone' only applies inside one project. */
export const TEAM_GROUP_BY = GROUP_BY.filter((group) => group !== 'milestone');
export const ORDER_BY = ['manual', 'priority', 'due', 'created', 'updated', 'title'] as const;
export const COMPLETED_VISIBILITY = ['all', 'week', 'none'] as const;
export const LAYOUTS = ['list', 'board', 'calendar', 'timeline', 'insights'] as const;
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
  /** Custom field filters, "fieldId:value" (see fields.ts). */
  cf: idList.catch(undefined),
  /** The custom field to group by when `group` is "field". */
  groupField: z.uuid().optional().catch(undefined),
  /** Second level of grouping in the list. */
  subgroup: z.enum(GROUP_BY).optional().catch(undefined),
  /** Whether a task must match every filter (default) or any of them. */
  match: z.enum(['all', 'any']).optional().catch(undefined),
  peek: z.string().max(20).optional().catch(undefined),
  /** Saved view this URL started from; the rest of the params may have drifted from it. */
  view: z.uuid().optional().catch(undefined),
  /** Calendar month on screen ("YYYY-MM"); defaults to the current month. */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
});

export type ViewSearch = z.infer<typeof viewSearchSchema>;

/** What a saved view stores: the view params without per-visit state. */
export const viewConfigSchema = viewSearchSchema
  .omit({ peek: true, view: true, month: true })
  .catch({});
export type ViewConfig = z.infer<typeof viewConfigSchema>;

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

const DEFAULTS = new Map<string, string>([...Object.entries(DEFAULT_VIEW), ['match', 'all']]);

function isEmpty(key: string, value: unknown): boolean {
  if (value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return DEFAULTS.get(key) === value;
}

/**
 * Canonical form of a view config: drops per-visit params, empty filters and
 * values equal to the defaults, and sorts keys and id lists, so two URLs that
 * show the same view produce the same config.
 */
export function toViewConfig(search: ViewSearch | ViewConfig): ViewConfig {
  const entries = Object.entries(viewConfigSchema.parse(search))
    .filter(([key, value]) => !isEmpty(key, value))
    .map(([key, value]): [string, unknown] => [
      key,
      Array.isArray(value) ? value.toSorted((a, b) => String(a).localeCompare(String(b))) : value,
    ])
    .toSorted(([a], [b]) => a.localeCompare(b));
  return viewConfigSchema.parse(Object.fromEntries(entries));
}

export function sameViewConfig(a: ViewSearch | ViewConfig, b: ViewSearch | ViewConfig): boolean {
  return JSON.stringify(toViewConfig(a)) === JSON.stringify(toViewConfig(b));
}

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
  'cf',
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

/**
 * Tasks a view shows. Property filters must all match, or with `match: any`
 * at least one of them; the text search and completed-task visibility always
 * apply.
 */
export function filterTasks(
  tasks: readonly Task[],
  search: ViewSearch,
  context: ViewContext,
): Task[] {
  const text = search.q?.trim().toLowerCase();
  const weekAgo = addDays(context.today, -7);
  const completed = search.completed ?? DEFAULT_VIEW.completed;
  const any = search.match === 'any';

  const fieldFilters = search.cf?.length ? [...parseFieldFilter(search.cf)] : [];
  return tasks.filter((task) => {
    const category = context.statuses.get(task.statusId)?.category;
    if (category && isClosedCategory(category)) {
      if (completed === 'none') return false;
      const closedAt = task.completedAt ?? task.canceledAt;
      if (completed === 'week' && closedAt && closedAt.slice(0, 10) < weekAgo) return false;
    }
    if (text && !task.title.toLowerCase().includes(text)) return false;

    // One result per active filter.
    const checks: boolean[] = [];
    if (search.status?.length) checks.push(search.status.includes(task.statusId));
    if (search.category?.length)
      checks.push(Boolean(category && search.category.includes(category)));
    if (search.priority?.length) checks.push(search.priority.includes(task.priority));
    if (search.assignee?.length)
      checks.push(matchesIds(search.assignee, task.assigneeIds, context.userId));
    if (search.label?.length) checks.push(matchesIds(search.label, task.labelIds, context.userId));
    if (search.project?.length)
      checks.push(
        matchesIds(search.project, task.projectId ? [task.projectId] : [], context.userId),
      );
    if (search.due) checks.push(matchesDue(search.due, task.dueDate, context.today));
    for (const entry of fieldFilters) {
      checks.push(matchesFieldFilters(task, new Map([entry]), context.userId));
    }
    if (checks.length === 0) return true;
    return any ? checks.some(Boolean) : checks.every(Boolean);
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
  /** Second-level groups (list sub-grouping), never empty. */
  subgroups?: TaskGroup[];
  /** Set on sub-groups: the key of the group they belong to. */
  parentKey?: string;
}

export interface GroupContext extends ViewContext {
  /** Statuses of the team(s) being shown, in workflow order. Empty groups are kept for status. */
  orderedStatuses: readonly Status[];
  members: ReadonlyMap<string, { displayName: string }>;
  projects: ReadonlyMap<string, Project>;
  labels: ReadonlyMap<string, Label>;
  /** The project's milestones, for grouping by milestone on a project page. */
  milestones?: readonly Milestone[];
  /** The custom field to group by when grouping by "field". */
  field?: CustomField;
}

const PRIORITY_ORDER: Priority[] = [1, 2, 3, 4, 0];

const DUE_GROUP_ORDER: DueBucket[] = [
  'overdue',
  'today',
  'this_week',
  'next_week',
  'later',
  'none',
];

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
      return [{ key: 'all', kind: 'none', label: words.allTasks, tasks: [...tasks] }];
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
        PRIORITY_ORDER.map((value) => [String(value), PRIORITY_LABEL[value]]),
        (task) => [String(task.priority)],
      ).filter((group) => group.tasks.length > 0);
    case 'due':
      return bucket(
        DUE_GROUP_ORDER.map((key) => [
          key,
          key === 'none' ? words.noDueDate : DUE_BUCKET_LABEL[key],
        ]),
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
            context.members.get(id)?.displayName ?? words.formerMember,
          ]),
          [NONE, words.noAssignee],
        ],
        (task) => (task.assigneeIds.length ? task.assigneeIds : [NONE]),
      ).filter((group) => group.tasks.length > 0);
    }
    case 'project': {
      const ids = [...new Set(tasks.flatMap((task) => (task.projectId ? [task.projectId] : [])))];
      return bucket(
        [
          ...ids.map((id): [string, string] => [
            id,
            context.projects.get(id)?.name ?? words.project,
          ]),
          [NONE, words.noProject],
        ],
        (task) => [task.projectId ?? NONE],
      ).filter((group) => group.tasks.length > 0);
    }
    case 'milestone': {
      // Every milestone shows, even empty, in its order; "No milestone" only when used.
      const milestones = (context.milestones ?? []).toSorted((a, b) =>
        compareSortKeys(a.sortKey, b.sortKey),
      );
      return bucket(
        [...milestones.map((m): [string, string] => [m.id, m.name]), [NONE, words.noMilestone]],
        (task) => [task.milestoneId ?? NONE],
      ).filter((group) => group.key !== NONE || group.tasks.length > 0);
    }
    case 'field': {
      const field = context.field;
      if (!field) return [{ key: 'all', kind: 'none', label: words.allTasks, tasks: [...tasks] }];
      const entries: [string, string][] =
        field.kind === 'checkbox'
          ? [
              ['true', words.yes],
              ['false', words.no],
            ]
          : field.kind === 'person'
            ? [...new Set(tasks.flatMap((task) => fieldKeys(task.fields[field.id])))].map(
                (id): [string, string] => [
                  id,
                  context.members.get(id)?.displayName ?? words.formerMember,
                ],
              )
            : field.options.map((option): [string, string] => [option.id, option.name]);
      return bucket([...entries, [NONE, words.noValue(field.name)]], (task) => {
        const keys = fieldKeys(task.fields[field.id]);
        return keys.length ? keys : [NONE];
      }).filter((group) => group.tasks.length > 0 || field.kind === 'select');
    }
    case 'label': {
      const ids = [...new Set(tasks.flatMap((task) => task.labelIds))].sort((a, b) =>
        (context.labels.get(a)?.name ?? '').localeCompare(context.labels.get(b)?.name ?? ''),
      );
      return bucket(
        [
          ...ids.map((id): [string, string] => [id, context.labels.get(id)?.name ?? words.label]),
          [NONE, words.noLabel],
        ],
        (task) => (task.labelIds.length ? task.labelIds : [NONE]),
      ).filter((group) => group.tasks.length > 0);
    }
    default:
      return groupBy satisfies never;
  }
}

/** Children listed right after their parent when both are in the same list (consistent at any depth). */
/** Splits each group by a second property, keeping only sub-groups that have tasks. */
export function subgroupTasks(
  groups: readonly TaskGroup[],
  by: GroupBy,
  context: GroupContext,
): TaskGroup[] {
  return groups.map((group) => ({
    ...group,
    subgroups: groupTasks(group.tasks, by, context)
      .filter((sub) => sub.tasks.length > 0)
      .map((sub) => ({ ...sub, parentKey: group.key })),
  }));
}

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
