import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JsonValue } from '@daiq/domain';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';

export interface SavedView {
  id: string;
  workspaceId: string;
  teamId: string | null;
  ownerId: string | null;
  name: string;
  isShared: boolean;
  /** Validated with viewConfigSchema (@daiq/domain) by the caller. */
  config: JsonValue;
}

export function useSavedViews(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.views(workspaceId),
    queryFn: async (): Promise<SavedView[]> =>
      unwrap(
        await client.from('views').select('*').eq('workspace_id', workspaceId).order('name'),
      ).map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        teamId: row.team_id,
        ownerId: row.owner_id,
        name: row.name,
        isShared: row.is_shared,
        config: row.config,
      })),
  });
}

export function useSavedViewActions(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.views(workspaceId) });
  const save = useMutation({
    mutationFn: async (view: Omit<SavedView, 'ownerId' | 'workspaceId'>) =>
      ensureOk(
        await client.from('views').upsert({
          id: view.id,
          workspace_id: workspaceId,
          team_id: view.teamId,
          name: view.name,
          is_shared: view.isShared,
          config: view.config ?? {},
        }),
      ),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => ensureOk(await client.from('views').delete().eq('id', id)),
    onSettled: refresh,
  });
  return { save, remove };
}

const FAVORITE_KINDS = ['project', 'view', 'task', 'team'] as const;
type FavoriteKind = (typeof FAVORITE_KINDS)[number];
const isFavoriteKind = (value: string): value is FavoriteKind =>
  (FAVORITE_KINDS as readonly string[]).includes(value);

export interface Favorite {
  entityKind: FavoriteKind;
  entityId: string;
  sortKey: string;
}

export function useFavorites(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.favorites(workspaceId),
    queryFn: async (): Promise<Favorite[]> =>
      unwrap(
        await client
          .from('favorites')
          .select('entity_kind, entity_id, sort_key')
          .eq('workspace_id', workspaceId)
          .order('sort_key'),
      ).flatMap((row) =>
        isFavoriteKind(row.entity_kind)
          ? [{ entityKind: row.entity_kind, entityId: row.entity_id, sortKey: row.sort_key }]
          : [],
      ),
  });
}

export function useToggleFavorite(workspaceId: string, userId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.favorites(workspaceId);
  return useMutation({
    mutationFn: async ({ favorite, active }: { favorite: Favorite; active: boolean }) =>
      active
        ? ensureOk(
            await client
              .from('favorites')
              .delete()
              .match({ entity_kind: favorite.entityKind, entity_id: favorite.entityId }),
          )
        : ensureOk(
            await client.from('favorites').insert({
              user_id: userId,
              workspace_id: workspaceId,
              entity_kind: favorite.entityKind,
              entity_id: favorite.entityId,
              sort_key: favorite.sortKey,
            }),
          ),
    onMutate: ({ favorite, active }) => {
      const previous = queryClient.getQueryData<Favorite[]>(key);
      queryClient.setQueryData<Favorite[]>(key, (items = []) =>
        active ? items.filter((f) => f.entityId !== favorite.entityId) : [...items, favorite],
      );
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(key, context?.previous),
  });
}
