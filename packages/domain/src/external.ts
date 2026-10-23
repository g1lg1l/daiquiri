import { z } from 'zod';
import type { Status } from './model';
import { isPriority, type Priority } from './priority';
import { statusCategorySchema, type StatusCategory } from './status';

/*
 * Importing from Linear, Asana and ClickUp. Each service's payloads are
 * parsed leniently into one shape; anything unexpected is dropped rather than
 * failing the whole import.
 */

export interface ExternalComment {
  author: string;
  at: string;
  text: string;
}

export interface ExternalTask {
  sourceId: string;
  parentId: string | null;
  title: string;
  description: string;
  descriptionFormat: 'markdown' | 'text';
  /** The status's name in the source, and its kind when the source has one. */
  status: string | null;
  category: StatusCategory | null;
  priority: Priority;
  assignees: { name: string; email: string | null }[];
  labels: string[];
  project: string | null;
  dueDate: string | null;
  startDate: string | null;
  estimatePoints: number | null;
  estimateHours: number | null;
  comments: ExternalComment[];
}

const category = (value: string | null | undefined): StatusCategory | null => {
  const parsed = statusCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
const priority = (value: number | null | undefined): Priority =>
  value !== null && value !== undefined && isPriority(value) ? value : 0;
const isoDay = (value: string | null | undefined) => (value ? value.slice(0, 10) : null);
/** Epoch milliseconds (as ClickUp sends them) → local calendar date. */
const dayFromMs = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Linear ------------------------------------------------------------------------

const linearIssue = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  priority: z.number().nullish(),
  estimate: z.number().nullish(),
  dueDate: z.string().nullish(),
  state: z.object({ name: z.string(), type: z.string() }).nullish(),
  assignee: z.object({ name: z.string(), email: z.string().nullish() }).nullish(),
  labels: z.object({ nodes: z.array(z.object({ name: z.string() })) }).nullish(),
  project: z.object({ name: z.string() }).nullish(),
  parent: z.object({ id: z.string() }).nullish(),
  comments: z
    .object({
      nodes: z.array(
        z.object({
          body: z.string(),
          createdAt: z.string(),
          user: z.object({ name: z.string() }).nullish(),
        }),
      ),
    })
    .nullish(),
});

/** A Linear issue. Its priorities (0–4) and state types match Daiquiri's. */
export function fromLinear(value: unknown): ExternalTask | null {
  const parsed = linearIssue.safeParse(value);
  if (!parsed.success) return null;
  const issue = parsed.data;
  return {
    sourceId: issue.id,
    parentId: issue.parent?.id ?? null,
    title: issue.title,
    description: issue.description ?? '',
    descriptionFormat: 'markdown',
    status: issue.state?.name ?? null,
    category: category(issue.state?.type),
    priority: priority(issue.priority),
    assignees: issue.assignee
      ? [{ name: issue.assignee.name, email: issue.assignee.email ?? null }]
      : [],
    labels: issue.labels?.nodes.map((l) => l.name) ?? [],
    project: issue.project?.name ?? null,
    dueDate: isoDay(issue.dueDate),
    startDate: null,
    estimatePoints: issue.estimate ?? null,
    estimateHours: null,
    comments: (issue.comments?.nodes ?? []).map((c) => ({
      author: c.user?.name ?? 'Someone',
      at: c.createdAt,
      text: c.body,
    })),
  };
}

// Asana ---------------------------------------------------------------------------

const asanaTask = z.object({
  gid: z.string(),
  name: z.string(),
  notes: z.string().nullish(),
  completed: z.boolean().nullish(),
  due_on: z.string().nullish(),
  start_on: z.string().nullish(),
  assignee: z.object({ name: z.string(), email: z.string().nullish() }).nullish(),
  tags: z.array(z.object({ name: z.string() })).nullish(),
  memberships: z
    .array(
      z.object({
        project: z.object({ gid: z.string() }).nullish(),
        section: z.object({ name: z.string() }).nullish(),
      }),
    )
    .nullish(),
  parent: z.object({ gid: z.string() }).nullish(),
});

const asanaStory = z.object({
  type: z.string().nullish(),
  text: z.string().nullish(),
  created_at: z.string(),
  created_by: z.object({ name: z.string() }).nullish(),
});

/** Comments from an Asana task's stories (other stories are changes, not comments). */
export const asanaComments = (stories: readonly unknown[]): ExternalComment[] =>
  stories.flatMap((value) => {
    const story = asanaStory.safeParse(value);
    return story.success && story.data.type === 'comment' && story.data.text
      ? [
          {
            author: story.data.created_by?.name ?? 'Someone',
            at: story.data.created_at,
            text: story.data.text,
          },
        ]
      : [];
  });

/** An Asana task in a project: its section stands in for a status. */
export function fromAsana(value: unknown, projectGid: string): ExternalTask | null {
  const parsed = asanaTask.safeParse(value);
  if (!parsed.success) return null;
  const task = parsed.data;
  const section =
    task.memberships?.find((m) => m.project?.gid === projectGid)?.section?.name ?? null;
  return {
    sourceId: task.gid,
    parentId: task.parent?.gid ?? null,
    title: task.name,
    description: task.notes ?? '',
    descriptionFormat: 'text',
    status: section,
    category: task.completed ? 'completed' : null,
    priority: 0,
    assignees: task.assignee
      ? [{ name: task.assignee.name, email: task.assignee.email ?? null }]
      : [],
    labels: task.tags?.map((t) => t.name) ?? [],
    project: null,
    dueDate: isoDay(task.due_on),
    startDate: isoDay(task.start_on),
    estimatePoints: null,
    estimateHours: null,
    comments: [],
  };
}

// ClickUp -----------------------------------------------------------------------------

const clickUpTask = z.object({
  id: z.string(),
  name: z.string(),
  text_content: z.string().nullish(),
  markdown_description: z.string().nullish(),
  status: z.object({ status: z.string(), type: z.string().nullish() }).nullish(),
  priority: z.object({ priority: z.string() }).nullish(),
  assignees: z
    .array(z.object({ username: z.string().nullish(), email: z.string().nullish() }))
    .nullish(),
  tags: z.array(z.object({ name: z.string() })).nullish(),
  due_date: z.union([z.string(), z.number()]).nullish(),
  start_date: z.union([z.string(), z.number()]).nullish(),
  time_estimate: z.number().nullish(),
  points: z.number().nullish(),
  parent: z.string().nullish(),
});

const CLICKUP_PRIORITY: Record<string, Priority> = { urgent: 1, high: 2, normal: 3, low: 4 };
// ClickUp status types: "open" (not started), "custom" (in progress), "done" and "closed".
const CLICKUP_CATEGORY: Record<string, StatusCategory> = {
  open: 'unstarted',
  custom: 'started',
  done: 'completed',
  closed: 'completed',
};

const clickUpComment = z.object({
  comment_text: z.string(),
  date: z.union([z.string(), z.number()]),
  user: z.object({ username: z.string().nullish() }).nullish(),
});

export const clickUpComments = (comments: readonly unknown[]): ExternalComment[] =>
  comments.flatMap((value) => {
    const comment = clickUpComment.safeParse(value);
    return comment.success && comment.data.comment_text.trim()
      ? [
          {
            author: comment.data.user?.username ?? 'Someone',
            at: new Date(Number(comment.data.date)).toISOString(),
            text: comment.data.comment_text,
          },
        ]
      : [];
  });

export function fromClickUp(value: unknown): ExternalTask | null {
  const parsed = clickUpTask.safeParse(value);
  if (!parsed.success) return null;
  const task = parsed.data;
  const markdown = task.markdown_description?.trim();
  return {
    sourceId: task.id,
    parentId: task.parent ?? null,
    title: task.name,
    description: markdown || task.text_content || '',
    descriptionFormat: markdown ? 'markdown' : 'text',
    status: task.status?.status ?? null,
    category: CLICKUP_CATEGORY[task.status?.type ?? ''] ?? null,
    priority: CLICKUP_PRIORITY[task.priority?.priority ?? ''] ?? 0,
    assignees: (task.assignees ?? []).map((a) => ({
      name: a.username ?? a.email ?? 'Someone',
      email: a.email ?? null,
    })),
    labels: task.tags?.map((t) => t.name) ?? [],
    project: null,
    dueDate: dayFromMs(task.due_date),
    startDate: dayFromMs(task.start_date),
    estimatePoints: task.points ?? null,
    estimateHours: task.time_estimate
      ? Math.round((task.time_estimate / 3_600_000) * 10) / 10
      : null,
    comments: [],
  };
}

// Planning ------------------------------------------------------------------------------

/**
 * Parents before their sub-tasks, in the source's order otherwise. A parent
 * outside the import is dropped, and nesting deeper than Daiquiri's three
 * levels is folded onto the deepest allowed ancestor.
 */
export function orderForImport(tasks: readonly ExternalTask[]): ExternalTask[] {
  const byId = new Map(tasks.map((t) => [t.sourceId, t]));
  const ancestors = (task: ExternalTask) => {
    const chain: ExternalTask[] = [];
    let parent = task.parentId ? byId.get(task.parentId) : undefined;
    while (parent && !chain.includes(parent) && parent !== task) {
      chain.push(parent);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return chain;
  };
  const fixed = tasks.map((task) => {
    const chain = ancestors(task);
    // chain[0] is the parent; keep at most two ancestors (three levels).
    const parent = chain.length > 2 ? chain[chain.length - 2] : chain[0];
    return { ...task, parentId: parent?.sourceId ?? null };
  });
  const children = new Map<string | null, ExternalTask[]>();
  for (const task of fixed)
    children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
  const ordered: ExternalTask[] = [];
  const seen = new Set<string>();
  const visit = (task: ExternalTask) => {
    if (seen.has(task.sourceId)) return;
    seen.add(task.sourceId);
    ordered.push(task);
    for (const child of children.get(task.sourceId) ?? []) visit(child);
  };
  for (const root of children.get(null) ?? []) visit(root);
  // Tasks in a parent cycle (malformed source data) come in at the top level.
  for (const task of fixed) if (!seen.has(task.sourceId)) visit({ ...task, parentId: null });
  return ordered;
}

/** The team status a source status maps to by default: same name, else same kind, else none. */
export function defaultStatusFor(
  source: { status: string | null; category: StatusCategory | null },
  statuses: readonly Status[],
): string | null {
  const byName = source.status
    ? statuses.find((s) => s.name.trim().toLowerCase() === source.status?.trim().toLowerCase())
    : undefined;
  if (byName) return byName.id;
  if (!source.category) return null;
  return (
    statuses
      .filter((s) => s.category === source.category)
      .toSorted((a, b) => a.position - b.position)[0]?.id ?? null
  );
}

/** "Ana Ruiz, 3 Oct 2026" above the comment's text: imported comments are posted by the importer. */
export const commentHeading = (comment: ExternalComment, source: string) =>
  `${comment.author}, ${new Date(comment.at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} (from ${source})`;
