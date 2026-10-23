import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isRecurrenceUnit, type Recurrence, type RecurrenceRule, type Task } from '@daiq/domain';
import { patchTask } from './cache';
import { useDaiqClient } from './context';
import { ensureOk, unwrapMaybe } from './errors';
import { keys } from './keys';

export function useRecurrence(taskId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.recurrence(taskId ?? ''),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<Recurrence | null> => {
      const row = unwrapMaybe(
        await client
          .from('task_recurrences')
          .select('task_id, unit, every, weekdays, after_completion, anchor_on, next_on')
          .eq('task_id', taskId ?? '')
          .maybeSingle(),
      );
      return row && isRecurrenceUnit(row.unit)
        ? {
            taskId: row.task_id,
            unit: row.unit,
            every: row.every,
            weekdays: row.weekdays,
            afterCompletion: row.after_completion,
            anchorOn: row.anchor_on,
            nextOn: row.next_on,
          }
        : null;
    },
  });
}

/** Make a task repeat, change how, or stop it. The database schedules the next date. */
export function useRecurrenceActions(task: Pick<Task, 'id' | 'workspaceId'>) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.recurrence(task.id);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const set = useMutation({
    mutationFn: async (rule: RecurrenceRule) =>
      ensureOk(
        await client.from('task_recurrences').upsert({
          task_id: task.id,
          workspace_id: task.workspaceId,
          unit: rule.unit,
          every: rule.every,
          weekdays: rule.weekdays,
          after_completion: rule.afterCompletion,
        }),
      ),
    onMutate: () => patchTask(queryClient, task.id, { recurring: true }),
    onSettled: refresh,
  });
  const clear = useMutation({
    mutationFn: async () =>
      ensureOk(await client.from('task_recurrences').delete().eq('task_id', task.id)),
    onMutate: () => {
      patchTask(queryClient, task.id, { recurring: false });
      queryClient.setQueryData(key, null);
    },
    onSettled: refresh,
  });
  return { set, clear };
}
