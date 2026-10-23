import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Member, Workspace, WorkspaceRole } from '@daiq/domain';
import { useDaiqClient } from './context';
import { ensureOk, unwrap, unwrapMaybe } from './errors';
import { keys } from './keys';

export function useWorkspaces(userId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.workspaces(),
    queryFn: async (): Promise<Workspace[]> => {
      const rows = unwrap(
        await client
          .from('workspace_members')
          .select('role, workspaces(id, slug, name, is_demo)')
          .eq('user_id', userId),
      );
      return rows
        .flatMap((row) =>
          row.workspaces
            ? [
                {
                  id: row.workspaces.id,
                  slug: row.workspaces.slug,
                  name: row.workspaces.name,
                  isDemo: row.workspaces.is_demo,
                  role: row.role,
                },
              ]
            : [],
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useCreateWorkspace() {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      slug: string;
      teamName: string;
      teamKey: string;
      template: string;
    }) =>
      unwrap(
        await client.rpc('create_workspace', {
          name: input.name,
          slug: input.slug,
          team_name: input.teamName,
          team_key: input.teamKey,
          template: input.template,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.workspaces() }),
  });
}

export function useCreateDemoWorkspace() {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await client.rpc('create_demo_workspace')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.workspaces() }),
  });
}

export function useRenameWorkspace(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      ensureOk(await client.from('workspaces').update({ name }).eq('id', workspaceId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.workspaces() }),
  });
}

export function useMembers(workspaceId: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.members(workspaceId),
    queryFn: async (): Promise<Member[]> => {
      const rows = unwrap(
        await client
          .from('workspace_members')
          .select('user_id, role, created_at, profiles(display_name, avatar_url)')
          .eq('workspace_id', workspaceId),
      );
      return rows
        .map((row) => ({
          id: row.user_id,
          role: row.role,
          joinedAt: row.created_at,
          displayName: row.profiles?.display_name ?? 'Unknown',
          avatarUrl: row.profiles?.avatar_url ?? null,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
    staleTime: 5 * 60_000,
  });
}

export function useMemberEmails(workspaceId: string, enabled: boolean) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.memberEmails(workspaceId),
    enabled,
    // The cache is persisted as JSON: keep an array there and build the Map on read.
    queryFn: async () =>
      unwrap(await client.rpc('workspace_member_emails', { workspace_id: workspaceId })),
    select: (rows) => new Map(rows.map((row) => [row.user_id, row.email])),
  });
}

export function useInvitations(workspaceId: string, enabled: boolean) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.invitations(workspaceId),
    enabled,
    queryFn: async () =>
      unwrap(
        await client
          .from('invitations')
          .select('id, email, role, expires_at, created_at')
          .eq('workspace_id', workspaceId)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ),
  });
}

export function useMemberActions(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.members(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: keys.invitations(workspaceId) }),
    ]);

  const invite = useMutation({
    mutationFn: async (input: { email: string; role: WorkspaceRole }) =>
      unwrap(
        await client.rpc('create_invitation', {
          workspace_id: workspaceId,
          email: input.email,
          role: input.role,
        }),
      ),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: async (invitationId: string) =>
      ensureOk(await client.rpc('revoke_invitation', { invitation_id: invitationId })),
    onSuccess: refresh,
  });
  const setRole = useMutation({
    mutationFn: async (input: { userId: string; role: WorkspaceRole }) =>
      ensureOk(
        await client.rpc('set_member_role', {
          workspace_id: workspaceId,
          user_id: input.userId,
          role: input.role,
        }),
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (userId: string) =>
      ensureOk(await client.rpc('remove_member', { workspace_id: workspaceId, user_id: userId })),
    onSuccess: refresh,
  });
  return { invite, revoke, setRole, remove };
}

export function useInvitationPreview(token: string) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: async () =>
      unwrapMaybe(await client.rpc('preview_invitation', { token }))?.at(0) ?? null,
    retry: false,
  });
}

export function useAcceptInvitation() {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => unwrap(await client.rpc('accept_invitation', { token })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.workspaces() }),
  });
}

export function useUpdateProfile() {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; displayName: string }) =>
      ensureOk(
        await client
          .from('profiles')
          .update({ display_name: input.displayName })
          .eq('id', input.userId),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });
}
