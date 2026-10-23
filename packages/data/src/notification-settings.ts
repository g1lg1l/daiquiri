import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isNotificationLevel, type NotificationLevel } from '@daiq/domain';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';

export interface TeamNotificationLevel {
  teamId: string;
  level: NotificationLevel;
}

/** The signed-in user's notification level per team; teams without a row get everything. */
export function useNotificationSettings(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.notificationSettings(workspaceId),
    queryFn: async (): Promise<TeamNotificationLevel[]> =>
      unwrap(
        await client
          .from('notification_settings')
          .select('team_id, level')
          .eq('workspace_id', workspaceId),
      ).flatMap((row) =>
        isNotificationLevel(row.level) ? [{ teamId: row.team_id, level: row.level }] : [],
      ),
  });
}

export function useSetNotificationLevel(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.notificationSettings(workspaceId);
  return useMutation({
    mutationFn: async ({ teamId, level }: TeamNotificationLevel) =>
      level === 'all'
        ? ensureOk(await client.from('notification_settings').delete().eq('team_id', teamId))
        : ensureOk(
            await client
              .from('notification_settings')
              .upsert({ workspace_id: workspaceId, team_id: teamId, level }),
          ),
    onMutate: ({ teamId, level }) => {
      const previous = queryClient.getQueryData<TeamNotificationLevel[]>(key);
      queryClient.setQueryData<TeamNotificationLevel[]>(key, (list = []) => [
        ...list.filter((s) => s.teamId !== teamId),
        ...(level === 'all' ? [] : [{ teamId, level }]),
      ]);
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
