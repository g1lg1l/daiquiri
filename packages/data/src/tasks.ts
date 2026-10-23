import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Priority, RichDocument, Task, TaskDetail, TaskPatch } from '@daiq/domain';
import {
  patchTask,
  pendingWrites,
  removeTasks,
  snapshotTasks,
  upsertTask,
  upsertTasks,
} from './cache';
import { useDaiqClient } from './context';
import { ensureOk, unwrap, unwrapMaybe } from './errors';
import { fetchAll } from './fetch-all';
import { keys, type TaskScope } from './keys';
import {
  documentToJson,
  TASK_COLUMNS,
  TASK_DETAIL_COLUMNS,
  toTask,
  toTaskDetail,
  toTaskUpdate,
} from './mappers';

export function useTasks(scope: TaskScope | null) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: scope ? keys.tasks(scope) : ['tasks', 'none'],
    enabled: scope !== null,
    queryFn: async (): Promise<Task[]> => {
      if (!scope) return [];
      const rows = await fetchAll((from, to) => {
        switch (scope.kind) {
          case 'assignee':
            // Alias the filtered join so `task_assignees` still lists every assignee.
            return client
              .from('tasks')
              .select(`${TASK_COLUMNS}, mine:task_assignees!inner(user_id)`)
              .eq('workspace_id', scope.workspaceId)
              .eq('mine.user_id', scope.id)
              .order('sort_key')
              .order('id')
              .range(from, to);
          case 'creator':
            return client
              .from('tasks')
              .select(TASK_COLUMNS)
              .eq('workspace_id', scope.workspaceId)
              .eq('creator_id', scope.id)
              .order('sort_key')
              .order('id')
              .range(from, to);
          case 'team':
            return client
              .from('tasks')
              .select(TASK_COLUMNS)
              .eq('team_id', scope.id)
              .order('sort_key')
              .order('id')
              .range(from, to);
          case 'project':
            return client
              .from('tasks')
              .select(TASK_COLUMNS)
              .eq('project_id', scope.id)
              .order('sort_key')
              .order('id')
              .range(from, to);
          case 'parent':
            return client
              .from('tasks')
              .select(TASK_COLUMNS)
              .eq('parent_id', scope.id)
              .order('sort_key')
              .order('id')
              .range(from, to);
          case 'cycle':
            return client
              .from('tasks')
              .select(TASK_COLUMNS)
              .eq('cycle_id', scope.id)
              .order('sort_key')
              .order('id')
              .range(from, to);
          default:
            throw new Error(`Unknown task scope: ${String(scope satisfies never)}`);
        }
      });
      return rows.map(toTask);
    },
  });
}

export function useTaskDetail(teamId: string | undefined, number: number | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.taskDetail(teamId ?? '', number ?? 0),
    enabled: Boolean(teamId && number),
    queryFn: async (): Promise<TaskDetail | null> => {
      const row = unwrapMaybe(
        await client
          .from('tasks')
          .select(TASK_DETAIL_COLUMNS)
          .eq('team_id', teamId ?? '')
          .eq('number', number ?? 0)
          .maybeSingle(),
      );
      return row ? toTaskDetail(row) : null;
    },
  });
}

/** Re-reads one task (RLS-checked) and patches every cache; used by realtime. */
/** Ids per request: keeps the `in.(…)` filter well under URL length limits. */
const REFRESH_CHUNK = 150;

/** Re-reads tasks from the server into every cached list; ids no longer visible are removed. */
export async function refreshTasks(
  client: ReturnType<typeof useDaiqClient>,
  queryClient: ReturnType<typeof useQueryClient>,
  ids: readonly string[],
) {
  const chunks = Array.from({ length: Math.ceil(ids.length / REFRESH_CHUNK) }, (_, i) =>
    ids.slice(i * REFRESH_CHUNK, (i + 1) * REFRESH_CHUNK),
  );
  const rows = (
    await Promise.all(
      chunks.map(async (chunk) =>
        unwrap(await client.from('tasks').select(TASK_COLUMNS).in('id', chunk)),
      ),
    )
  ).flat();
  const tasks = rows.map(toTask);
  upsertTasks(queryClient, tasks);
  const found = new Set(tasks.map((task) => task.id));
  const gone = new Set(ids.filter((id) => !found.has(id)));
  if (gone.size > 0) removeTasks(queryClient, gone);
}

export async function refreshTask(
  client: ReturnType<typeof useDaiqClient>,
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  await refreshTasks(client, queryClient, [id]);
}

export interface NewTask {
  id: string;
  workspaceId: string;
  teamId: string;
  title: string;
  description?: RichDocument | null;
  statusId: string;
  sortKey: string;
  priority?: Priority;
  projectId?: string | null;
  parentId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
  cycleId?: string | null;
  estimate?: number | null;
  creatorId: string;
}

export function useCreateTask() {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewTask): Promise<Task> => {
      const row = unwrap(
        await client.rpc('create_task', {
          id: input.id,
          team_id: input.teamId,
          title: input.title,
          status_id: input.statusId,
          priority: input.priority ?? 0,
          ...(input.projectId && { project_id: input.projectId }),
          ...(input.parentId && { parent_id: input.parentId }),
          ...(input.startDate && { start_date: input.startDate }),
          ...(input.dueDate && { due_date: input.dueDate }),
          ...(input.description && { description: documentToJson(input.description) }),
          sort_key: input.sortKey,
          assignee_ids: input.assigneeIds ?? [],
          label_ids: input.labelIds ?? [],
          ...(input.cycleId && { cycle_id: input.cycleId }),
          ...(input.estimate != null && { estimate: input.estimate }),
        }),
      );
      return toTask({
        ...row,
        task_assignees: (input.assigneeIds ?? []).map((user_id) => ({ user_id })),
        task_labels: (input.labelIds ?? []).map((label_id) => ({ label_id })),
      });
    },
    onMutate: (input) => {
      pendingWrites.begin([input.id]);
      const now = new Date().toISOString();
      upsertTask(queryClient, {
        id: input.id,
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        number: null,
        title: input.title,
        statusId: input.statusId,
        priority: input.priority ?? 0,
        projectId: input.projectId ?? null,
        parentId: input.parentId ?? null,
        creatorId: input.creatorId,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        estimate: input.estimate ?? null,
        cycleId: input.cycleId ?? null,
        milestoneId: null,
        attachmentCount: 0,
        fields: {},
        sortKey: input.sortKey,
        completedAt: null,
        canceledAt: null,
        createdAt: now,
        updatedAt: now,
        assigneeIds: input.assigneeIds ?? [],
        labelIds: input.labelIds ?? [],
      });
    },
    onError: (_error, input) => removeTasks(queryClient, new Set([input.id])),
    onSuccess: (task) => upsertTask(queryClient, task),
    onSettled: (_data, _error, input) => pendingWrites.end([input.id]),
  });
}

export function useUpdateTasks() {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: TaskPatch }): Promise<Task[]> =>
      unwrap(
        await client
          .from('tasks')
          .update(toTaskUpdate(patch))
          .in('id', ids)
          .select(TASK_DETAIL_COLUMNS),
      ).map(toTaskDetail),
    onMutate: async ({ ids, patch }) => {
      pendingWrites.begin(ids);
      await queryClient.cancelQueries({ queryKey: keys.allTasks() });
      const restore = snapshotTasks(queryClient);
      for (const id of ids) patchTask(queryClient, id, patch);
      return { restore };
    },
    onError: (_error, _input, context) => context?.restore(),
    onSuccess: (tasks) => upsertTasks(queryClient, tasks),
    onSettled: (_data, _error, { ids }) => pendingWrites.end(ids),
  });
}

function useReplaceSet(
  rpc: 'set_task_assignees' | 'set_task_labels',
  field: 'assigneeIds' | 'labelIds',
) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, ids }: { taskId: string; ids: string[] }) => {
      const result =
        rpc === 'set_task_assignees'
          ? await client.rpc(rpc, { task_id: taskId, user_ids: ids })
          : await client.rpc(rpc, { task_id: taskId, label_ids: ids });
      ensureOk(result);
    },
    onMutate: ({ taskId, ids }) => {
      pendingWrites.begin([taskId]);
      const restore = snapshotTasks(queryClient);
      patchTask(queryClient, taskId, { [field]: ids });
      return { restore };
    },
    onError: (_error, _input, context) => context?.restore(),
    onSettled: (_data, _error, { taskId }) => pendingWrites.end([taskId]),
  });
}

export const useSetAssignees = () => useReplaceSet('set_task_assignees', 'assigneeIds');
export const useSetLabels = () => useReplaceSet('set_task_labels', 'labelIds');

export function useDeleteTasks() {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      unwrap(await client.rpc('delete_tasks', { task_ids: ids })),
    onMutate: async (ids) => {
      pendingWrites.begin(ids);
      await queryClient.cancelQueries({ queryKey: keys.allTasks() });
      const restore = snapshotTasks(queryClient);
      removeTasks(queryClient, new Set(ids));
      return { restore };
    },
    onError: (_error, _ids, context) => context?.restore(),
    onSettled: (_data, _error, ids) => {
      pendingWrites.end(ids);
      // Sub-tasks were deleted server-side too.
      return queryClient.invalidateQueries({ queryKey: keys.allTasks() });
    },
  });
}

export function useRestoreTasks() {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      unwrap(await client.rpc('restore_tasks', { task_ids: ids })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.allTasks() }),
  });
}
