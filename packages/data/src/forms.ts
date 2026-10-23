import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isCustomFieldKind, type IntakeForm, type PublicForm } from '@daiq/domain';
import { z } from 'zod';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';

export type FormInput = Pick<
  IntakeForm,
  'name' | 'description' | 'isPublic' | 'askPriority' | 'fieldIds' | 'statusId' | 'enabled'
>;

const toColumns = (input: Partial<FormInput>) => ({
  ...(input.name !== undefined && { name: input.name }),
  ...(input.description !== undefined && { description: input.description }),
  ...(input.isPublic !== undefined && { is_public: input.isPublic }),
  ...(input.askPriority !== undefined && { ask_priority: input.askPriority }),
  ...(input.fieldIds !== undefined && { field_ids: input.fieldIds }),
  ...(input.statusId !== undefined && { status_id: input.statusId }),
  ...(input.enabled !== undefined && { enabled: input.enabled }),
});

export function useForms(teamId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.forms(teamId ?? ''),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<(IntakeForm & { submissions: number })[]> =>
      unwrap(
        await client
          .from('forms')
          .select('*, form_submissions(count)')
          .eq('team_id', teamId ?? '')
          .order('created_at'),
      ).map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        teamId: row.team_id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        isPublic: row.is_public,
        askPriority: row.ask_priority,
        fieldIds: row.field_ids,
        statusId: row.status_id,
        enabled: row.enabled,
        submissions: row.form_submissions[0]?.count ?? 0,
      })),
  });
}

export function useFormActions(workspaceId: string, teamId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.forms(teamId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: async (input: FormInput) =>
      ensureOk(
        await client.from('forms').insert({
          workspace_id: workspaceId,
          team_id: teamId,
          ...toColumns(input),
          name: input.name,
        }),
      ),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<FormInput> }) =>
      ensureOk(await client.from('forms').update(toColumns(patch)).eq('id', id)),
    onMutate: ({ id, patch }) =>
      queryClient.setQueryData<IntakeForm[]>(key, (list = []) =>
        list.map((form) => (form.id === id ? { ...form, ...patch } : form)),
      ),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => ensureOk(await client.from('forms').delete().eq('id', id)),
    onMutate: (id) =>
      queryClient.setQueryData<IntakeForm[]>(key, (list = []) => list.filter((f) => f.id !== id)),
    onSettled: refresh,
  });
  return { create, update, remove };
}

const publicFormSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  team: z.string(),
  workspace: z.string(),
  is_public: z.boolean(),
  ask_priority: z.boolean(),
  signed_in: z.boolean(),
  fields: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      options: z.array(z.object({ id: z.string(), name: z.string() })).catch([]),
    }),
  ),
});

/** A form by its link, as the person filling it in sees it (null: not found or not allowed). */
export function usePublicForm(slug: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.publicForm(slug),
    staleTime: 60_000,
    queryFn: async (): Promise<PublicForm | null> => {
      const data: unknown = unwrap(await client.rpc('form_by_slug', { slug }));
      if (data === null) return null;
      const row = publicFormSchema.parse(data);
      return {
        name: row.name,
        description: row.description,
        team: row.team,
        workspace: row.workspace,
        isPublic: row.is_public,
        askPriority: row.ask_priority,
        signedIn: row.signed_in,
        fields: row.fields.flatMap((f) =>
          isCustomFieldKind(f.kind)
            ? [
                {
                  id: f.id,
                  workspaceId: '',
                  name: f.name,
                  kind: f.kind,
                  options: f.options,
                  position: 0,
                },
              ]
            : [],
        ),
      };
    },
  });
}

export interface Submission {
  slug: string;
  title: string;
  details: string;
  email: string;
  priority: number;
  fields: Record<string, unknown>;
  /** The honeypot: people leave it empty. */
  website: string;
}

export function useSubmitForm() {
  const client = useDaiqClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async (s: Submission): Promise<string | null> =>
      unwrap(
        await client.rpc('submit_form', {
          slug: s.slug,
          title: s.title,
          details: s.details,
          email: s.email,
          priority: s.priority,
          fields: JSON.parse(JSON.stringify(s.fields)),
          website: s.website,
        }),
      ),
  });
}
