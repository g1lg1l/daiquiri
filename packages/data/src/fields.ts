import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isCustomFieldKind,
  type CustomField,
  type CustomFieldKind,
  type FieldOption,
  type FieldValue,
  type Task,
  type Team,
} from '@daiq/domain';
import { findTask, patchTask } from './cache';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';

function toOptions(value: unknown): FieldOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) =>
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof item.id === 'string' &&
    'name' in item &&
    typeof item.name === 'string'
      ? [{ id: item.id, name: item.name }]
      : [],
  );
}

export function useCustomFields(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.customFields(workspaceId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CustomField[]> =>
      unwrap(
        await client
          .from('custom_fields')
          .select('id, workspace_id, name, kind, options, position')
          .eq('workspace_id', workspaceId)
          .order('position')
          .order('name'),
      ).flatMap((row) =>
        isCustomFieldKind(row.kind)
          ? [
              {
                id: row.id,
                workspaceId: row.workspace_id,
                name: row.name,
                kind: row.kind,
                options: toOptions(row.options),
                position: row.position,
              },
            ]
          : [],
      ),
  });
}

/** Admins define, rename and delete workspace fields. */
export function useCustomFieldActions(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.customFields(workspaceId);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: keys.teams(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: keys.allTasks() }),
    ]);
  const create = useMutation({
    mutationFn: async (field: {
      id: string;
      name: string;
      kind: CustomFieldKind;
      options: FieldOption[];
      position: number;
    }) =>
      ensureOk(
        await client.from('custom_fields').insert({
          id: field.id,
          workspace_id: workspaceId,
          name: field.name,
          kind: field.kind,
          options: field.options.map((o) => ({ id: o.id, name: o.name })),
          position: field.position,
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
      patch: Partial<Pick<CustomField, 'name' | 'options'>>;
    }) =>
      ensureOk(
        await client
          .from('custom_fields')
          .update({
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.options !== undefined && {
              options: patch.options.map((o) => ({ id: o.id, name: o.name })),
            }),
          })
          .eq('id', id),
      ),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await client.from('custom_fields').delete().eq('id', id)),
    onSettled: refresh,
  });
  return { create, update, remove };
}

/** Turn a workspace field on or off for one team (at most 12 per team). */
export function useTeamFieldActions(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.teams(workspaceId);
  return useMutation({
    mutationFn: async ({ team, fieldId, on }: { team: Team; fieldId: string; on: boolean }) =>
      on
        ? ensureOk(
            await client.from('team_custom_fields').insert({
              workspace_id: workspaceId,
              team_id: team.id,
              field_id: fieldId,
              position: team.fieldIds.length,
            }),
          )
        : ensureOk(
            await client
              .from('team_custom_fields')
              .delete()
              .match({ team_id: team.id, field_id: fieldId }),
          ),
    onMutate: ({ team, fieldId, on }) => {
      const previous = queryClient.getQueryData<Team[]>(key);
      queryClient.setQueryData<Team[]>(key, (teams = []) =>
        teams.map((t) =>
          t.id === team.id
            ? {
                ...t,
                fieldIds: on ? [...t.fieldIds, fieldId] : t.fieldIds.filter((id) => id !== fieldId),
              }
            : t,
        ),
      );
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Set or clear one field on a task, optimistically. */
export function useSetFieldValue() {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      task,
      fieldId,
      value,
    }: {
      task: Pick<Task, 'id' | 'workspaceId'>;
      fieldId: string;
      value: FieldValue | null;
    }) =>
      value === null || (Array.isArray(value) && value.length === 0)
        ? ensureOk(
            await client
              .from('task_field_values')
              .delete()
              .match({ task_id: task.id, field_id: fieldId }),
          )
        : ensureOk(
            await client.from('task_field_values').upsert({
              task_id: task.id,
              field_id: fieldId,
              workspace_id: task.workspaceId,
              value,
            }),
          ),
    onMutate: ({ task, fieldId, value }) => {
      const current = findTask(queryClient, task.id);
      const previous = current?.fields;
      const fields = { ...current?.fields };
      if (value === null || (Array.isArray(value) && value.length === 0)) delete fields[fieldId];
      else fields[fieldId] = value;
      patchTask(queryClient, task.id, { fields });
      return { previous };
    },
    onError: (_error, { task }, context) => {
      if (context?.previous) patchTask(queryClient, task.id, { fields: context.previous });
    },
  });
}
