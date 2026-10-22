import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { viewConfigSchema, type ViewConfig } from '@daiq/domain';
import { useDaiqClient } from './context';
import type { TablesUpdate } from './database.types';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';

export interface SavedView {
  id: string;
  workspaceId: string;
  teamId: string | null;
  ownerId: string | null;
  name: string;
  isShared: boolean;
  config: ViewConfig;
}

export type NewSavedView = Pick<SavedView, 'id' | 'teamId' | 'name' | 'isShared' | 'config'>;
export type SavedViewPatch = Partial<Pick<SavedView, 'name' | 'isShared' | 'config'>>;

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
        config: viewConfigSchema.parse(row.config),
      })),
  });
}

/** Create, update and delete saved views, optimistically. */
export function useSavedViewActions(workspaceId: string, userId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.views(workspaceId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const optimistic = (change: (views: SavedView[]) => SavedView[]) => {
    const previous = queryClient.getQueryData<SavedView[]>(key);
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<SavedView[]>(key, (views = []) =>
      change(views).toSorted((a, b) => a.name.localeCompare(b.name)),
    );
    return { previous };
  };
  const rollback = (_error: unknown, _input: unknown, context?: { previous?: SavedView[] }) =>
    queryClient.setQueryData(key, context?.previous);

  const create = useMutation({
    mutationFn: async (view: NewSavedView) =>
      ensureOk(
        await client.from('views').insert({
          id: view.id,
          workspace_id: workspaceId,
          team_id: view.teamId,
          name: view.name,
          is_shared: view.isShared,
          config: view.config,
        }),
      ),
    onMutate: (view) =>
      optimistic((views) => [...views, { ...view, workspaceId, ownerId: userId }]),
    onError: rollback,
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SavedViewPatch }) => {
      const columns: TablesUpdate<'views'> = {};
      if (patch.name !== undefined) columns.name = patch.name;
      if (patch.isShared !== undefined) columns.is_shared = patch.isShared;
      if (patch.config !== undefined) columns.config = patch.config;
      return ensureOk(await client.from('views').update(columns).eq('id', id));
    },
    onMutate: ({ id, patch }) =>
      optimistic((views) => views.map((view) => (view.id === id ? { ...view, ...patch } : view))),
    onError: rollback,
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => ensureOk(await client.from('views').delete().eq('id', id)),
    onMutate: (id) => optimistic((views) => views.filter((view) => view.id !== id)),
    onError: rollback,
    onSettled: () => {
      void refresh();
      // Deleting a view also drops it from everyone's favorites (trigger).
      void queryClient.invalidateQueries({ queryKey: keys.favorites(workspaceId) });
    },
  });

  return { create, update, remove };
}

const FAVORITE_KINDS = ['project', 'view', 'task', 'team'] as const;
export type FavoriteKind = (typeof FAVORITE_KINDS)[number];
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
