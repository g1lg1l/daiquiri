import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Task, TaskDetail } from '@daiq/domain';
import { keys } from './keys';

/*
 * Cache patchers: the single place where a changed task is written into every
 * cached query that contains it. Used by optimistic mutations and realtime.
 */

/** Whether a task belongs in the list identified by `key` (see keys.tasks). */
export function taskBelongsTo(key: QueryKey, task: Task): boolean {
  const [, kind, id, workspaceId] = key;
  if (typeof id !== 'string') return false;
  switch (kind) {
    case 'team':
      return task.teamId === id;
    case 'project':
      return task.projectId === id;
    case 'parent':
      return task.parentId === id;
    case 'cycle':
      return task.cycleId === id;
    case 'assignee':
      return task.workspaceId === workspaceId && task.assigneeIds.includes(id);
    case 'creator':
      return task.workspaceId === workspaceId && task.creatorId === id;
    default:
      return false;
  }
}

/**
 * Puts fresh copies of tasks into every cached list they belong to (and out of
 * the ones they left), with one cache write per list however many tasks change.
 */
export function upsertTasks(queryClient: QueryClient, tasks: readonly Task[]): void {
  if (tasks.length === 0) return;
  for (const [key, list] of queryClient.getQueriesData<Task[]>({ queryKey: keys.allTasks() })) {
    if (!list) continue;
    const incoming = new Map(tasks.map((task) => [task.id, task]));
    let changed = false;
    const next = list.flatMap((current) => {
      const task = incoming.get(current.id);
      if (!task) return [current];
      incoming.delete(current.id);
      changed = true;
      return taskBelongsTo(key, task) ? [{ ...current, ...task }] : [];
    });
    for (const task of incoming.values()) {
      if (taskBelongsTo(key, task)) {
        next.push(task);
        changed = true;
      }
    }
    if (changed) queryClient.setQueryData(key, next);
  }
  const byId = new Map(tasks.map((task) => [task.id, task]));
  queryClient.setQueriesData<TaskDetail>({ queryKey: keys.allTaskDetails() }, (detail) => {
    const task = detail ? byId.get(detail.id) : undefined;
    return detail && task ? { ...detail, ...task } : detail;
  });
}

export function upsertTask(queryClient: QueryClient, task: Task): void {
  upsertTasks(queryClient, [task]);
}

export function patchTask(queryClient: QueryClient, id: string, patch: Partial<TaskDetail>): void {
  const current = findTask(queryClient, id);
  if (current) upsertTask(queryClient, { ...current, ...patch });
  queryClient.setQueriesData<TaskDetail>({ queryKey: keys.allTaskDetails() }, (detail) =>
    detail?.id === id ? { ...detail, ...patch } : detail,
  );
}

export function removeTasks(queryClient: QueryClient, ids: ReadonlySet<string>): void {
  for (const [key, list] of queryClient.getQueriesData<Task[]>({ queryKey: keys.allTasks() })) {
    if (list?.some((t) => ids.has(t.id))) {
      queryClient.setQueryData(
        key,
        list.filter((t) => !ids.has(t.id)),
      );
    }
  }
}

export function findTask(queryClient: QueryClient, id: string): Task | undefined {
  for (const [, list] of queryClient.getQueriesData<Task[]>({ queryKey: keys.allTasks() })) {
    const found = list?.find((t) => t.id === id);
    if (found) return found;
  }
  for (const [, detail] of queryClient.getQueriesData<TaskDetail>({
    queryKey: keys.allTaskDetails(),
  })) {
    if (detail?.id === id) return detail;
  }
  return undefined;
}

/** Snapshot of every task-related query, restored when an optimistic mutation fails. */
export function snapshotTasks(queryClient: QueryClient) {
  const entries = [
    ...queryClient.getQueriesData({ queryKey: keys.allTasks() }),
    ...queryClient.getQueriesData({ queryKey: keys.allTaskDetails() }),
  ];
  return () => {
    for (const [key, data] of entries) queryClient.setQueryData(key, data);
  };
}

/**
 * Every task write shares one mutation queue: optimistic updates still apply
 * at once, but requests reach the server in the order they were made, so a
 * quick second edit (or an edit right after creating) never lands first.
 */
export const TASK_WRITES = { id: 'task-writes' };

/*
 * Ids with an in-flight local mutation. Realtime events for these ids are
 * skipped: the mutation's own reconciliation is authoritative.
 */
const pending = new Map<string, number>();

export const pendingWrites = {
  begin(ids: Iterable<string>) {
    for (const id of ids) pending.set(id, (pending.get(id) ?? 0) + 1);
  },
  end(ids: Iterable<string>) {
    for (const id of ids) {
      const count = (pending.get(id) ?? 1) - 1;
      if (count <= 0) pending.delete(id);
      else pending.set(id, count);
    }
  },
  has(id: string) {
    return pending.has(id);
  },
  /** More than one write to this task is in flight or queued. */
  isContended(id: string) {
    return (pending.get(id) ?? 0) > 1;
  },
};
