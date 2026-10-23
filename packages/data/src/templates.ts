import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isTemplateKind, type Project, type Template } from '@daiq/domain';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import type { Json } from './database.types';
import { keys } from './keys';
import { toProject } from './mappers';
import { refreshTasks } from './tasks';

const length = (value: Json | undefined) => (Array.isArray(value) ? value.length : 0);

function counts(payload: Json): Template['counts'] {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { subtasks: 0, milestones: 0, tasks: 0 };
  }
  return {
    subtasks: length(payload.subtasks),
    milestones: length(payload.milestones),
    tasks: length(payload.tasks),
  };
}

export function useTemplates(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.templates(workspaceId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Template[]> =>
      unwrap(
        await client
          .from('templates')
          .select('id, workspace_id, team_id, kind, name, payload, created_by, created_at')
          .eq('workspace_id', workspaceId)
          .order('name'),
      ).flatMap((row) =>
        isTemplateKind(row.kind)
          ? [
              {
                id: row.id,
                workspaceId: row.workspace_id,
                teamId: row.team_id,
                kind: row.kind,
                name: row.name,
                createdBy: row.created_by,
                createdAt: row.created_at,
                counts: counts(row.payload),
              },
            ]
          : [],
      ),
  });
}

/** Save tasks and projects as templates, use them, rename or delete them. */
export function useTemplateActions(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.templates(workspaceId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const save = useMutation({
    mutationFn: async (input: { kind: 'task' | 'project'; sourceId: string; name: string }) =>
      ensureOk(
        input.kind === 'task'
          ? await client.rpc('save_task_template', { task_id: input.sourceId, name: input.name })
          : await client.rpc('save_project_template', {
              project_id: input.sourceId,
              name: input.name,
            }),
      ),
    onSettled: refresh,
  });
  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      ensureOk(await client.from('templates').update({ name }).eq('id', id)),
    onMutate: ({ id, name }) =>
      queryClient.setQueryData<Template[]>(key, (list = []) =>
        list.map((t) => (t.id === id ? { ...t, name } : t)),
      ),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await client.from('templates').delete().eq('id', id)),
    onMutate: (id) =>
      queryClient.setQueryData<Template[]>(key, (list = []) => list.filter((t) => t.id !== id)),
    onSettled: refresh,
  });
  const createTask = useMutation({
    mutationFn: async (input: { templateId: string; projectId?: string | null }) => {
      const row = unwrap(
        await client.rpc('create_task_from_template', {
          template_id: input.templateId,
          ...(input.projectId && { project_id: input.projectId }),
        }),
      );
      // Read it back with its relations (and sub-tasks via the list refresh).
      await refreshTasks(client, queryClient, [row.id]);
      await queryClient.invalidateQueries({ queryKey: keys.allTasks() });
      return { id: row.id, teamId: row.team_id, number: row.number };
    },
  });
  const createProject = useMutation({
    mutationFn: async (input: { templateId: string; name: string; startDate: string | null }) =>
      toProject(
        unwrap(
          await client.rpc('create_project_from_template', {
            template_id: input.templateId,
            name: input.name,
            ...(input.startDate && { start_date: input.startDate }),
          }),
        ),
      ),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(keys.projects(workspaceId), (projects = []) => [
        ...projects.filter((p) => p.id !== project.id),
        project,
      ]);
      void queryClient.invalidateQueries({ queryKey: keys.allTasks() });
    },
  });
  return { save, rename, remove, createTask, createProject };
}
