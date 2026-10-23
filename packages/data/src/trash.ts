import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDaiqClient } from './context';
import { unwrap } from './errors';
import { keys } from './keys';

export interface TrashedTask {
  id: string;
  teamId: string;
  number: number;
  title: string;
  deletedAt: string;
  /** Sub-tasks deleted together with it (restored with it). */
  subtasks: number;
}

export function useTrash(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.trash(workspaceId),
    queryFn: async (): Promise<TrashedTask[]> =>
      unwrap(await client.rpc('trashed_tasks', { workspace_id: workspaceId })).map((row) => ({
        id: row.id,
        teamId: row.team_id,
        number: row.number,
        title: row.title,
        deletedAt: row.deleted_at,
        subtasks: row.subtasks,
      })),
  });
}

export function useTrashActions(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.trash(workspaceId);
  const leave = (ids: readonly string[]) => {
    const previous = queryClient.getQueryData<TrashedTask[]>(key);
    queryClient.setQueryData<TrashedTask[]>(key, (list = []) =>
      list.filter((task) => !ids.includes(task.id)),
    );
    return { previous };
  };
  const options = {
    onMutate: leave,
    onError: (_error: Error, _ids: string[], context?: { previous?: TrashedTask[] }) =>
      queryClient.setQueryData(key, context?.previous),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: keys.allTasks() }),
      ]),
  };
  const restore = useMutation({
    mutationFn: async (ids: string[]) =>
      unwrap(await client.rpc('restore_tasks', { task_ids: ids })),
    ...options,
  });
  const purge = useMutation({
    mutationFn: async (ids: string[]) => unwrap(await client.rpc('purge_tasks', { task_ids: ids })),
    ...options,
  });
  return { restore, purge };
}
