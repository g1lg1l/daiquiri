import { addDays, daysBetween, startOfWeek, toIsoDate } from './dates';
import { formatFieldValue } from './fields';
import type { CustomField, Status, Task } from './model';
import { PRIORITY_LABEL } from './priority';
import { isClosedCategory } from './status';

/** Local calendar day of a timestamp. */
const dayOf = (timestamp: string) => toIsoDate(new Date(timestamp));

export interface InsightWeek {
  /** First day (Monday) of the week. */
  week: string;
  created: number;
  completed: number;
  /** Running totals at the end of the week: open plus completed work, and completed work. */
  scope: number;
  done: number;
}

/**
 * Created and completed tasks per week, oldest first and ending with this
 * week, plus the running totals a burn-up chart draws. Canceled tasks leave
 * the scope on the day they were canceled.
 */
export function weeklyThroughput(tasks: readonly Task[], today: string, weeks = 12): InsightWeek[] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  const created = Array.from({ length: weeks }, () => 0);
  const completed = Array.from({ length: weeks }, () => 0);
  const canceled = Array.from({ length: weeks }, () => 0);
  // Before the window everything collapses into week -1.
  let scopeBefore = 0;
  let doneBefore = 0;
  const bucket = (timestamp: string) => Math.floor(daysBetween(first, dayOf(timestamp)) / 7);
  const count = (counts: number[], timestamp: string | null, sign: number) => {
    if (!timestamp) return;
    const week = bucket(timestamp);
    if (week < 0) {
      if (counts === completed) doneBefore += 1;
      else scopeBefore += sign;
    } else if (week < weeks) counts[week] = (counts[week] ?? 0) + 1;
  };
  for (const task of tasks) {
    count(created, task.createdAt, 1);
    count(completed, task.completedAt, 1);
    count(canceled, task.canceledAt, -1);
  }
  let scope = scopeBefore;
  let done = doneBefore;
  return created.map((made, i) => {
    scope += made - (canceled[i] ?? 0);
    done += completed[i] ?? 0;
    return {
      week: addDays(first, 7 * i),
      created: made,
      completed: completed[i] ?? 0,
      scope,
      done,
    };
  });
}

export interface InsightSummary {
  open: number;
  overdue: number;
  /** Completed in the last 7 days. */
  completedThisWeek: number;
  /** Median days from creation to completion, over tasks completed in the last 12 weeks. */
  leadTimeDays: number | null;
  byStatus: { status: Status; tasks: number }[];
  /** Open tasks per assignee (null: unassigned), most loaded first. */
  byAssignee: { assigneeId: string | null; tasks: number; estimate: number }[];
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function summarize(
  tasks: readonly Task[],
  statuses: ReadonlyMap<string, Status>,
  today: string,
): InsightSummary {
  const weekAgo = addDays(today, -7);
  const windowStart = addDays(today, -84);
  const byStatus = new Map<string, { status: Status; tasks: number }>();
  const byAssignee = new Map<
    string | null,
    { assigneeId: string | null; tasks: number; estimate: number }
  >();
  const leadTimes: number[] = [];
  let open = 0;
  let overdue = 0;
  let completedThisWeek = 0;

  for (const task of tasks) {
    const status = statuses.get(task.statusId);
    if (status) {
      const entry = byStatus.get(status.id) ?? { status, tasks: 0 };
      entry.tasks += 1;
      byStatus.set(status.id, entry);
    }
    if (task.completedAt) {
      const completedOn = dayOf(task.completedAt);
      if (completedOn > weekAgo) completedThisWeek += 1;
      if (completedOn > windowStart)
        leadTimes.push(daysBetween(dayOf(task.createdAt), completedOn));
    }
    if (status && isClosedCategory(status.category)) continue;
    open += 1;
    if (task.dueDate && task.dueDate < today) overdue += 1;
    for (const assigneeId of task.assigneeIds.length ? task.assigneeIds : [null]) {
      const entry = byAssignee.get(assigneeId) ?? { assigneeId, tasks: 0, estimate: 0 };
      entry.tasks += 1;
      entry.estimate += task.estimate ?? 0;
      byAssignee.set(assigneeId, entry);
    }
  }

  return {
    open,
    overdue,
    completedThisWeek,
    leadTimeDays: median(leadTimes),
    byStatus: [...byStatus.values()].toSorted(
      (a, b) =>
        a.status.teamId.localeCompare(b.status.teamId) || a.status.position - b.status.position,
    ),
    byAssignee: [...byAssignee.values()].toSorted((a, b) => b.tasks - a.tasks),
  };
}

/** "5 h", "3.5 d": hours below two days, days above. */
export function formatHours(hours: number): string {
  if (hours < 48) return `${Math.round(hours)} h`;
  const days = hours / 24;
  return `${days < 10 ? Math.round(days * 10) / 10 : Math.round(days)} d`;
}

// Export ---------------------------------------------------------------------

export type ExportRow = Record<string, string | number | null>;

export interface ExportContext {
  identifier: (task: Task) => string;
  statuses: ReadonlyMap<string, Status>;
  members: ReadonlyMap<string, { displayName: string }>;
  labels: ReadonlyMap<string, { name: string }>;
  projects: ReadonlyMap<string, { name: string }>;
  /** Custom fields to add as columns, in order. */
  fields: readonly CustomField[];
}

const names = (ids: readonly string[], map: ReadonlyMap<string, { name: string }>) =>
  ids.flatMap((id) => map.get(id)?.name ?? []).join(', ');

/** Tasks as flat, human-readable records: the rows of a CSV or JSON export. */
export function exportRows(tasks: readonly Task[], context: ExportContext): ExportRow[] {
  return tasks.map((task) => {
    const row: ExportRow = {
      ID: context.identifier(task),
      Title: task.title,
      Status: context.statuses.get(task.statusId)?.name ?? null,
      Priority: PRIORITY_LABEL[task.priority],
      Assignees: task.assigneeIds
        .flatMap((id) => context.members.get(id)?.displayName ?? [])
        .join(', '),
      Labels: names(task.labelIds, context.labels),
      Project: task.projectId ? (context.projects.get(task.projectId)?.name ?? null) : null,
      Estimate: task.estimate,
      'Start date': task.startDate,
      'Due date': task.dueDate,
      Created: task.createdAt,
      Completed: task.completedAt,
      Canceled: task.canceledAt,
    };
    for (const field of context.fields) {
      // A field named like a built-in column must not overwrite it.
      const column = field.name in row ? `${field.name} (field)` : field.name;
      row[column] = formatFieldValue(field, task.fields[field.id], context.members) || null;
    }
    return row;
  });
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * RFC 4180 CSV. Cells that a spreadsheet would run as a formula (=, +, -, @,
 * tab, carriage return) get a leading apostrophe (OWASP CSV injection).
 */
export function toCsv(rows: readonly ExportRow[]): string {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((line) => line.map(csvCell).join(','))
    .join('\r\n');
}
