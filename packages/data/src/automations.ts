import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  automationActionSchema,
  automationConditionsSchema,
  automationTriggerSchema,
  isAutomationTriggerKind,
  type Automation,
  type AutomationInput,
  type AutomationRun,
} from '@daiq/domain';
import { z } from 'zod';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';

const stored = z.object({
  trigger: automationTriggerSchema,
  conditions: automationConditionsSchema,
  actions: z.array(automationActionSchema),
});

export function useAutomations(teamId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.automations(teamId ?? ''),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<Automation[]> =>
      unwrap(
        await client
          .from('automations')
          .select(
            'id, workspace_id, team_id, name, trigger, conditions, actions, enabled, created_at',
          )
          .eq('team_id', teamId ?? '')
          .order('created_at'),
      ).flatMap((row) => {
        // Rows written by an older client may not parse; they are skipped, not fatal.
        const parsed = stored.safeParse(row);
        return parsed.success
          ? [
              {
                id: row.id,
                workspaceId: row.workspace_id,
                teamId: row.team_id,
                name: row.name,
                enabled: row.enabled,
                createdAt: row.created_at,
                ...parsed.data,
              },
            ]
          : [];
      }),
  });
}

export function useAutomationRuns(automationId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.automationRuns(automationId ?? ''),
    enabled: Boolean(automationId),
    queryFn: async (): Promise<AutomationRun[]> =>
      unwrap(
        await client
          .from('automation_runs')
          .select('id, automation_id, task_id, event, status, error, created_at')
          .eq('automation_id', automationId ?? '')
          .order('id', { ascending: false })
          .limit(100),
      ).flatMap((row) => {
        const event = row.event;
        return isAutomationTriggerKind(event) &&
          (row.status === 'succeeded' || row.status === 'failed')
          ? [
              {
                id: row.id,
                automationId: row.automation_id,
                taskId: row.task_id,
                event,
                status: row.status,
                error: row.error,
                createdAt: row.created_at,
              },
            ]
          : [];
      }),
  });
}

export function useAutomationActions(workspaceId: string, teamId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.automations(teamId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const patchCache = (id: string, patch: Partial<Automation>) =>
    queryClient.setQueryData<Automation[]>(key, (list = []) =>
      list.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );

  const create = useMutation({
    mutationFn: async (input: AutomationInput) =>
      ensureOk(
        await client.from('automations').insert({
          workspace_id: workspaceId,
          team_id: teamId,
          name: input.name,
          trigger: input.trigger,
          conditions: input.conditions,
          actions: input.actions,
        }),
      ),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<AutomationInput & { enabled: boolean }>;
    }) => ensureOk(await client.from('automations').update(patch).eq('id', id)),
    onMutate: ({ id, patch }) => patchCache(id, patch),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await client.from('automations').delete().eq('id', id)),
    onMutate: (id) =>
      queryClient.setQueryData<Automation[]>(key, (list = []) => list.filter((a) => a.id !== id)),
    onSettled: refresh,
  });
  return { create, update, remove };
}
