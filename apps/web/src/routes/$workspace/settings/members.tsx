import { useInvitations, useMemberActions, useMemberEmails, useMembers } from '@daiq/data';
import { can, invitableRoles, WORKSPACE_ROLES, type WorkspaceRole } from '@daiq/domain';
import { Avatar, Button, FieldError, Input, Label, toast } from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useWorkspace } from '../../../features/workspace/workspace-context';
import { formString } from '../../../lib/forms';
import { timeAgo } from '../../../lib/time';

export const Route = createFileRoute('/$workspace/settings/members')({
  component: MembersSettings,
});

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
};

function MembersSettings() {
  const { workspace, userId } = useWorkspace();
  const isAdmin = can(workspace.role, 'members.manage');
  const members = useMembers(workspace.id);
  const emails = useMemberEmails(workspace.id, isAdmin);
  const invitations = useInvitations(workspace.id, isAdmin);
  const actions = useMemberActions(workspace.id);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roles = invitableRoles(workspace.role);

  return (
    <>
      <section className="flex flex-col gap-4">
        <header>
          <h2 className="text-lg font-semibold font-display">Members</h2>
          <p className="text-[13px] text-fg-muted">
            Members see every public team. Guests only see the teams they are added to.
          </p>
        </header>
        {roles.length > 0 && (
          <form
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const role = formString(form, 'role');
              setError(null);
              actions.invite.mutate(
                {
                  email: formString(form, 'email').trim(),
                  role: WORKSPACE_ROLES.find((r) => r === role) ?? 'member',
                },
                {
                  onSuccess: (token) => {
                    setInviteLink(
                      `${window.location.origin}${import.meta.env.BASE_URL}invite/${token}`,
                    );
                    event.currentTarget?.reset();
                  },
                  onError: (e) => setError(e.message),
                },
              );
            }}
          >
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <Label htmlFor="invite-email">Invite by email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="name@company.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                name="role"
                defaultValue="member"
                className="h-8 rounded-md border border-border bg-surface px-2 text-[13px]"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" size="md" disabled={actions.invite.isPending}>
              Create invitation
            </Button>
            {error && <FieldError className="w-full">{error}</FieldError>}
            {inviteLink && (
              <div className="flex w-full flex-col gap-1.5 rounded-md bg-surface-subtle p-2.5">
                <p className="text-xs text-fg-muted">
                  Share this link with them. It works once, for that email address, for 7 days.
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={inviteLink}
                    aria-label="Invitation link"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(inviteLink).then(
                        () => toast('Invitation link copied'),
                        () => toast.error('Copy the link manually.'),
                      )
                    }
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {members.data?.map((member) => {
            const editable =
              member.id !== userId &&
              isAdmin &&
              (workspace.role === 'owner' || member.role !== 'owner');
            return (
              <li key={member.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                <Avatar name={member.displayName} src={member.avatarUrl} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">
                    {member.displayName}{' '}
                    {member.id === userId && (
                      <span className="font-normal text-fg-subtle">(you)</span>
                    )}
                  </span>
                  <span className="truncate text-xs text-fg-subtle">
                    {emails.data?.get(member.id) ?? `Joined ${timeAgo(member.joinedAt)}`}
                  </span>
                </div>
                {editable ? (
                  <select
                    aria-label={`Role of ${member.displayName}`}
                    value={member.role}
                    onChange={(e) => {
                      const role = WORKSPACE_ROLES.find((r) => r === e.target.value);
                      if (role) actions.setRole.mutate({ userId: member.id, role });
                    }}
                    className="h-7 rounded-md border border-border bg-surface px-1.5 text-xs"
                  >
                    {WORKSPACE_ROLES.filter((r) => r !== 'owner' || workspace.role === 'owner').map(
                      (role) => (
                        <option key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <span className="text-xs text-fg-muted">{ROLE_LABEL[member.role]}</span>
                )}
                {(editable || member.id === userId) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger"
                    onClick={() => actions.remove.mutate(member.id)}
                  >
                    {member.id === userId ? 'Leave' : 'Remove'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      {isAdmin && (invitations.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold">Pending invitations</h3>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {invitations.data?.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className="flex-1 truncate">{invitation.email}</span>
                <span className="text-xs text-fg-muted">{ROLE_LABEL[invitation.role]}</span>
                <span className="text-xs text-fg-subtle">
                  expires {timeAgo(invitation.expires_at)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => actions.revoke.mutate(invitation.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
