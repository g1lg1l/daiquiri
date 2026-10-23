import { useInvitations, useMemberActions, useMemberEmails, useMembers } from '@daiq/data';
import { can, invitableRoles, WORKSPACE_ROLES } from '@daiq/domain';
import { Avatar, Button, FieldError, Input, Label, Select, toast } from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useWorkspace } from '../../../features/workspace/workspace-context';
import { m } from '../../../i18n/settings';
import { formString } from '../../../lib/forms';
import { timeAgo } from '../../../lib/time';

export const Route = createFileRoute('/$workspace/settings/members')({
  component: MembersSettings,
});

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
          <h2 className="text-lg font-semibold font-display">{m.settings.sections.members}</h2>
          <p className="text-[13px] text-fg-muted">{m.settings.members.intro}</p>
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
              <Label htmlFor="invite-email">{m.settings.members.inviteByEmail}</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder={m.settings.members.emailPlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role">{m.settings.members.role}</Label>
              <Select
                id="invite-role"
                name="role"
                defaultValue="member"
                options={roles.map((role) => ({
                  value: role,
                  label: m.settings.members.roles[role],
                }))}
              />
            </div>
            <Button type="submit" variant="primary" size="md" disabled={actions.invite.isPending}>
              {m.settings.members.createInvitation}
            </Button>
            {error && <FieldError className="w-full">{error}</FieldError>}
            {inviteLink && (
              <div className="flex w-full flex-col gap-1.5 rounded-md bg-surface-subtle p-2.5">
                <p className="text-xs text-fg-muted">{m.settings.members.shareLink}</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={inviteLink}
                    aria-label={m.settings.members.invitationLink}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(inviteLink).then(
                        () => toast(m.settings.members.linkCopied),
                        () => toast.error(m.settings.members.copyManually),
                      )
                    }
                  >
                    {m.common.copy}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
        <ul className="flex rise-children flex-col divide-y divide-border card">
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
                      <span className="font-normal text-fg-subtle">{m.settings.members.you}</span>
                    )}
                  </span>
                  <span className="truncate text-xs text-fg-subtle">
                    {emails.data?.get(member.id) ??
                      m.settings.members.joined(timeAgo(member.joinedAt))}
                  </span>
                </div>
                {editable ? (
                  <Select
                    aria-label={m.settings.members.roleOf(member.displayName)}
                    size="sm"
                    className="text-xs"
                    value={member.role}
                    onValueChange={(value) => {
                      const role = WORKSPACE_ROLES.find((r) => r === value);
                      if (role) actions.setRole.mutate({ userId: member.id, role });
                    }}
                    options={WORKSPACE_ROLES.filter(
                      (r) => r !== 'owner' || workspace.role === 'owner',
                    ).map((role) => ({ value: role, label: m.settings.members.roles[role] }))}
                  />
                ) : (
                  <span className="text-xs text-fg-muted">
                    {m.settings.members.roles[member.role]}
                  </span>
                )}
                {(editable || member.id === userId) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger"
                    onClick={() => actions.remove.mutate(member.id)}
                  >
                    {member.id === userId ? m.settings.members.leave : m.common.remove}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      {isAdmin && (invitations.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold">{m.settings.members.pending}</h3>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {invitations.data?.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className="flex-1 truncate">{invitation.email}</span>
                <span className="text-xs text-fg-muted">
                  {m.settings.members.roles[invitation.role]}
                </span>
                <span className="text-xs text-fg-subtle">
                  {m.settings.members.expires(timeAgo(invitation.expires_at))}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => actions.revoke.mutate(invitation.id)}
                >
                  {m.settings.members.revoke}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
