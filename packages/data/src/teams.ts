import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Label, LabelColor, Project, ProjectStatus, Team } from '@daiq/domain';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';
import { toLabel, toProject, toTeam } from './mappers';

export function useTeams(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.teams(workspaceId),
    queryFn: async (): Promise<Team[]> =>
      unwrap(
        await client
          .from('teams')
          .select('*, statuses(*), team_members(user_id)')
          .eq('workspace_id', workspaceId)
          .order('name'),
      ).map(toTeam),
    staleTime: 5 * 60_000,
  });
}

export function useCreateTeam(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      key: string;
      template: string;
      isPrivate: boolean;
    }) =>
      unwrap(
        await client.rpc('create_team', {
          workspace_id: workspaceId,
          name: input.name,
          key: input.key,
          template: input.template,
          is_private: input.isPrivate,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.teams(workspaceId) }),
  });
}

export function useTeamMembership(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.teams(workspaceId) });
  const join = useMutation({
    mutationFn: async (input: { teamId: string; userId: string }) =>
      ensureOk(
        await client
          .from('team_members')
          .insert({ team_id: input.teamId, user_id: input.userId, workspace_id: workspaceId }),
      ),
    onSuccess: refresh,
  });
  const leave = useMutation({
    mutationFn: async (input: { teamId: string; userId: string }) =>
      ensureOk(
        await client
          .from('team_members')
          .delete()
          .eq('team_id', input.teamId)
          .eq('user_id', input.userId),
      ),
    onSuccess: refresh,
  });
  return { join, leave };
}

export function useLabels(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.labels(workspaceId),
    queryFn: async (): Promise<Label[]> =>
      unwrap(
        await client.from('labels').select('*').eq('workspace_id', workspaceId).order('name'),
      ).map(toLabel),
    staleTime: 5 * 60_000,
  });
}

export function useCreateLabel(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string; color: LabelColor }): Promise<Label> =>
      toLabel(
        unwrap(
          await client
            .from('labels')
            .insert({
              id: input.id,
              workspace_id: workspaceId,
              name: input.name,
              color: input.color,
            })
            .select()
            .single(),
        ),
      ),
    onMutate: (input) => {
      queryClient.setQueryData<Label[]>(keys.labels(workspaceId), (labels = []) => [
        ...labels,
        { ...input, workspaceId },
      ]);
    },
    onError: (_error, input) => {
      queryClient.setQueryData<Label[]>(keys.labels(workspaceId), (labels = []) =>
        labels.filter((label) => label.id !== input.id),
      );
    },
  });
}

export function useProjects(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.projects(workspaceId),
    queryFn: async (): Promise<Project[]> =>
      unwrap(
        await client.from('projects').select('*').eq('workspace_id', workspaceId).order('sort_key'),
      ).map(toProject),
    staleTime: 60_000,
  });
}

export interface ProjectInput {
  id: string;
  teamId: string;
  name: string;
  status?: ProjectStatus;
  leadId?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export function useCreateProject(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectInput): Promise<Project> =>
      toProject(
        unwrap(
          await client
            .from('projects')
            .insert({
              id: input.id,
              workspace_id: workspaceId,
              team_id: input.teamId,
              name: input.name,
              status: input.status ?? 'planned',
              lead_id: input.leadId ?? null,
              start_date: input.startDate ?? null,
              target_date: input.targetDate ?? null,
            })
            .select()
            .single(),
        ),
      ),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(keys.projects(workspaceId), (projects = []) => [
        ...projects.filter((p) => p.id !== project.id),
        project,
      ]);
    },
  });
}

export function useUpdateProject(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Partial<
        Pick<Project, 'name' | 'status' | 'leadId' | 'startDate' | 'targetDate' | 'archivedAt'>
      >;
    }) => {
      const { patch } = input;
      return toProject(
        unwrap(
          await client
            .from('projects')
            .update({
              ...(patch.name !== undefined && { name: patch.name }),
              ...(patch.status !== undefined && { status: patch.status }),
              ...(patch.leadId !== undefined && { lead_id: patch.leadId }),
              ...(patch.startDate !== undefined && { start_date: patch.startDate }),
              ...(patch.targetDate !== undefined && { target_date: patch.targetDate }),
              ...(patch.archivedAt !== undefined && { archived_at: patch.archivedAt }),
            })
            .eq('id', input.id)
            .select()
            .single(),
        ),
      );
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: keys.projects(workspaceId) });
      const previous = queryClient.getQueryData<Project[]>(keys.projects(workspaceId));
      queryClient.setQueryData<Project[]>(keys.projects(workspaceId), (projects = []) =>
        projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(keys.projects(workspaceId), context?.previous);
    },
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(keys.projects(workspaceId), (projects = []) =>
        projects.map((p) => (p.id === project.id ? project : p)),
      );
    },
  });
}

export function useLabelActions(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.labels(workspaceId);
  const update = useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: LabelColor }) =>
      ensureOk(
        await client
          .from('labels')
          .update({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.color && { color: input.color }),
          })
          .eq('id', input.id),
      ),
    onMutate: (input) => {
      const previous = queryClient.getQueryData<Label[]>(key);
      queryClient.setQueryData<Label[]>(key, (labels = []) =>
        labels.map((label) =>
          label.id === input.id
            ? {
                ...label,
                ...(input.name !== undefined && { name: input.name }),
                ...(input.color && { color: input.color }),
              }
            : label,
        ),
      );
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(key, context?.previous),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => ensureOk(await client.from('labels').delete().eq('id', id)),
    onMutate: (id) => {
      const previous = queryClient.getQueryData<Label[]>(key);
      queryClient.setQueryData<Label[]>(key, (labels = []) =>
        labels.filter((label) => label.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.allTasks() }),
  });
  return { update, remove };
}
