import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSearchResultKind, type Notification, type SearchResult } from '@daiq/domain';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';
import { toNotification } from './mappers';

export function useNotifications(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.notifications(workspaceId),
    queryFn: async (): Promise<Notification[]> =>
      unwrap(
        await client
          .from('notifications')
          .select('*, tasks(title, number, team_id), projects(id, name)')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(300),
      ).flatMap((row) => toNotification(row) ?? []),
  });
}

type NotificationPatch = Partial<Pick<Notification, 'readAt' | 'snoozedUntil' | 'archivedAt'>>;

export function useUpdateNotifications(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.notifications(workspaceId);
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: NotificationPatch }) =>
      ensureOk(
        await client
          .from('notifications')
          .update({
            ...(patch.readAt !== undefined && { read_at: patch.readAt }),
            ...(patch.snoozedUntil !== undefined && { snoozed_until: patch.snoozedUntil }),
            ...(patch.archivedAt !== undefined && { archived_at: patch.archivedAt }),
          })
          .in('id', ids),
      ),
    onMutate: async ({ ids, patch }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Notification[]>(key);
      const selected = new Set(ids);
      queryClient.setQueryData<Notification[]>(key, (items = []) =>
        items.map((n) => (selected.has(n.id) ? { ...n, ...patch } : n)),
      );
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(key, context?.previous),
  });
}

export function useSearch(workspaceId: string, query: string) {
  const client = useDaiqClient();
  const trimmed = query.trim();
  return useQuery({
    queryKey: keys.search(workspaceId, trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<SearchResult[]> =>
      unwrap(
        await client
          .rpc('search', { workspace_id: workspaceId, query: trimmed, max_results: 20 })
          .abortSignal(signal),
      ).flatMap((row) =>
        isSearchResultKind(row.kind)
          ? [
              {
                kind: row.kind,
                id: row.id,
                title: row.title,
                subtitle: row.subtitle,
                rank: row.rank,
              },
            ]
          : [],
      ),
  });
}
