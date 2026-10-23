import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task, TimeEntry } from '@daiq/domain';
import { useDaiqClient } from './context';
import { ensureOk, unwrap, unwrapMaybe } from './errors';
import { keys } from './keys';

const COLUMNS = 'id, task_id, user_id, started_at, ended_at, note';

function toEntry(row: {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  note: string | null;
}): TimeEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    note: row.note,
  };
}

export function useTimeEntries(taskId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.timeEntries(taskId ?? ''),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<TimeEntry[]> =>
      unwrap(
        await client
          .from('time_entries')
          .select(COLUMNS)
          .eq('task_id', taskId ?? '')
          .order('started_at', { ascending: false }),
      ).map(toEntry),
  });
}

export interface RunningTimer extends TimeEntry {
  task: { teamId: string; number: number | null; title: string };
}

/** The signed-in person's running timer, wherever it is. */
export function useRunningTimer(userId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.runningTimer(userId),
    queryFn: async (): Promise<RunningTimer | null> => {
      const row = unwrapMaybe(
        await client
          .from('time_entries')
          .select(`${COLUMNS}, tasks(team_id, number, title)`)
          .eq('user_id', userId)
          .is('ended_at', null)
          .maybeSingle(),
      );
      return row?.tasks
        ? {
            ...toEntry(row),
            task: { teamId: row.tasks.team_id, number: row.tasks.number, title: row.tasks.title },
          }
        : null;
    },
  });
}

export function useTimerActions(userId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const running = keys.runningTimer(userId);
  const refresh = (taskIds: (string | undefined)[]) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: running }),
      ...taskIds.flatMap((id) =>
        id ? [queryClient.invalidateQueries({ queryKey: keys.timeEntries(id) })] : [],
      ),
    ]);

  const start = useMutation({
    mutationFn: async (task: Pick<Task, 'id' | 'teamId' | 'number' | 'title'>) =>
      ensureOk(await client.rpc('start_timer', { task_id: task.id })),
    onMutate: (task) => {
      const previous = queryClient.getQueryData<RunningTimer | null>(running);
      queryClient.setQueryData<RunningTimer>(running, {
        id: 'pending',
        taskId: task.id,
        userId,
        startedAt: new Date().toISOString(),
        endedAt: null,
        note: null,
        task: { teamId: task.teamId, number: task.number, title: task.title },
      });
      return { previous };
    },
    onError: (_error, _task, context) => queryClient.setQueryData(running, context?.previous),
    onSettled: (_data, _error, task, context) => refresh([task.id, context?.previous?.taskId]),
  });
  const stop = useMutation({
    mutationFn: async () => ensureOk(await client.rpc('stop_timer')),
    onMutate: () => {
      const previous = queryClient.getQueryData<RunningTimer | null>(running);
      queryClient.setQueryData(running, null);
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(running, context?.previous),
    onSettled: (_data, _error, _input, context) => refresh([context?.previous?.taskId]),
  });
  return { start, stop };
}

export function useTimeEntryActions(task: Pick<Task, 'id' | 'workspaceId'>) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.timeEntries(task.id);
  const add = useMutation({
    mutationFn: async (entry: { startedAt: string; endedAt: string; note: string | null }) =>
      ensureOk(
        await client.from('time_entries').insert({
          workspace_id: task.workspaceId,
          task_id: task.id,
          started_at: entry.startedAt,
          ended_at: entry.endedAt,
          note: entry.note,
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await client.from('time_entries').delete().eq('id', id)),
    onMutate: (id) =>
      queryClient.setQueryData<TimeEntry[]>(key, (list = []) => list.filter((e) => e.id !== id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return { add, remove };
}
