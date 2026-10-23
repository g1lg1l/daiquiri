import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isProjectHealth,
  isRichDocument,
  type Milestone,
  type ProjectHealth,
  type ProjectUpdate,
  type RichDocument,
} from '@daiq/domain';
import { useDaiqClient } from './context';
import type { TablesUpdate } from './database.types';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';
import { documentToJson } from './mappers';

export function useMilestones(projectId: string | null | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.milestones(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<Milestone[]> =>
      unwrap(
        await client
          .from('milestones')
          .select('id, workspace_id, team_id, project_id, name, target_date, sort_key')
          .eq('project_id', projectId ?? '')
          .order('sort_key')
          .order('id'),
      ).map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        teamId: row.team_id,
        projectId: row.project_id,
        name: row.name,
        targetDate: row.target_date,
        sortKey: row.sort_key,
      })),
  });
}

export type MilestonePatch = Partial<Pick<Milestone, 'name' | 'targetDate' | 'sortKey'>>;

/** Create, edit and delete a project's milestones, optimistically. */
export function useMilestoneActions(project: { id: string; teamId: string; workspaceId: string }) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.milestones(project.id);
  const optimistic = (change: (list: Milestone[]) => Milestone[]) => {
    const previous = queryClient.getQueryData<Milestone[]>(key);
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<Milestone[]>(key, (list = []) => change(list));
    return { previous };
  };
  const rollback = (_e: unknown, _i: unknown, context?: { previous?: Milestone[] }) =>
    queryClient.setQueryData(key, context?.previous);
  const settle = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      // Deleting a milestone clears it from its tasks.
      queryClient.invalidateQueries({ queryKey: keys.allTasks() }),
    ]);

  const create = useMutation({
    mutationFn: async (milestone: Pick<Milestone, 'id' | 'name' | 'targetDate' | 'sortKey'>) =>
      ensureOk(
        // team_id and workspace_id are overwritten from the project by the database.
        await client.from('milestones').insert({
          id: milestone.id,
          workspace_id: project.workspaceId,
          team_id: project.teamId,
          project_id: project.id,
          name: milestone.name,
          target_date: milestone.targetDate,
          sort_key: milestone.sortKey,
        }),
      ),
    onMutate: (milestone) =>
      optimistic((list) => [
        ...list,
        {
          ...milestone,
          projectId: project.id,
          teamId: project.teamId,
          workspaceId: project.workspaceId,
        },
      ]),
    onError: rollback,
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: MilestonePatch }) => {
      const columns: TablesUpdate<'milestones'> = {};
      if (patch.name !== undefined) columns.name = patch.name;
      if (patch.targetDate !== undefined) columns.target_date = patch.targetDate;
      if (patch.sortKey !== undefined) columns.sort_key = patch.sortKey;
      return ensureOk(await client.from('milestones').update(columns).eq('id', id));
    },
    onMutate: ({ id, patch }) =>
      optimistic((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m))),
    onError: rollback,
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await client.from('milestones').delete().eq('id', id)),
    onMutate: (id) => optimistic((list) => list.filter((m) => m.id !== id)),
    onError: rollback,
    onSettled: settle,
  });
  return { create, update, remove };
}

function toUpdate(row: {
  id: string;
  project_id: string;
  author_id: string | null;
  health: string;
  body: unknown;
  created_at: string;
  updated_at: string;
}): ProjectUpdate {
  return {
    id: row.id,
    projectId: row.project_id,
    authorId: row.author_id,
    health: isProjectHealth(row.health) ? row.health : 'on_track',
    body: isRichDocument(row.body) ? row.body : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useProjectUpdates(projectId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.projectUpdates(projectId),
    queryFn: async (): Promise<ProjectUpdate[]> =>
      unwrap(
        await client
          .from('project_updates')
          .select('id, project_id, author_id, health, body, created_at, updated_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(100),
      ).map(toUpdate),
  });
}

export interface LatestUpdate {
  projectId: string;
  health: ProjectHealth;
  createdAt: string;
}

/** The newest update of every visible project, for health badges in project lists. */
export function useLatestProjectUpdates(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.latestProjectUpdates(workspaceId),
    // The cache (persisted as JSON) holds an array; components get a Map via select.
    queryFn: async (): Promise<LatestUpdate[]> =>
      unwrap(
        await client.from('project_latest_updates').select('project_id, health, created_at'),
      ).flatMap((row) =>
        row.project_id && row.health && row.created_at && isProjectHealth(row.health)
          ? [{ projectId: row.project_id, health: row.health, createdAt: row.created_at }]
          : [],
      ),
    select: (rows) => new Map(rows.map((row) => [row.projectId, row])),
  });
}

export function useProjectUpdateActions(
  project: { id: string; teamId: string; workspaceId: string },
  userId: string,
) {
  const projectId = project.id;
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.projectUpdates(projectId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['project-updates'] });
  const post = useMutation({
    mutationFn: async (update: { id: string; health: ProjectHealth; body: RichDocument | null }) =>
      ensureOk(
        await client.from('project_updates').insert({
          id: update.id,
          workspace_id: project.workspaceId,
          team_id: project.teamId,
          project_id: projectId,
          health: update.health,
          body: update.body ? documentToJson(update.body) : null,
        }),
      ),
    onMutate: (update) => {
      const previous = queryClient.getQueryData<ProjectUpdate[]>(key);
      const now = new Date().toISOString();
      queryClient.setQueryData<ProjectUpdate[]>(key, (list = []) => [
        { ...update, projectId, authorId: userId, createdAt: now, updatedAt: now },
        ...list,
      ]);
      return { previous };
    },
    onError: (_e, _i, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await client.from('project_updates').delete().eq('id', id)),
    onMutate: (id) => {
      const previous = queryClient.getQueryData<ProjectUpdate[]>(key);
      queryClient.setQueryData<ProjectUpdate[]>(key, (list = []) =>
        list.filter((u) => u.id !== id),
      );
      return { previous };
    },
    onError: (_e, _i, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: refresh,
  });
  return { post, remove };
}
