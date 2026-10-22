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
    case 'assignee':
      return task.workspaceId === workspaceId && task.assigneeIds.includes(id);
    case 'creator':
      return task.workspaceId === workspaceId && task.creatorId === id;
    default:
      return false;
  }
}

export function upsertTask(queryClient: QueryClient, task: Task): void {
  for (const [key, list] of queryClient.getQueriesData<Task[]>({ queryKey: keys.allTasks() })) {
    if (!list) continue;
    const index = list.findIndex((t) => t.id === task.id);
    const member = taskBelongsTo(key, task);
    if (index >= 0 && member) {
      const merged = { ...list[index], ...task };
      queryClient.setQueryData(key, list.with(index, merged));
    } else if (index >= 0) {
      queryClient.setQueryData(key, list.toSpliced(index, 1));
    } else if (member) {
      queryClient.setQueryData(key, [...list, task]);
    }
  }
  queryClient.setQueriesData<TaskDetail>({ queryKey: keys.allTaskDetails() }, (detail) =>
    detail?.id === task.id ? { ...detail, ...task } : detail,
  );
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
};
