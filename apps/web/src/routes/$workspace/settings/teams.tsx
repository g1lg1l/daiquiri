import { useCreateTeam, useTeamMembership } from '@daiq/data';
import { can, suggestTeamKey, teamKeySchema } from '@daiq/domain';
import { Button, FieldError, Input, Label } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { LockIcon, SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { TeamBadge } from '../../../components/team-badge';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';

export const Route = createFileRoute('/$workspace/settings/teams')({ component: TeamsSettings });

function TeamsSettings() {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const createTeam = useCreateTeam(workspace.id);
  const membership = useTeamMembership(workspace.id);
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = suggestTeamKey(name);
  const keyTaken = data.teamsByKey.has(key);

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold font-display">Teams</h2>
        <p className="text-[13px] text-fg-muted">
          Each team has its own workflow and task numbers. Private teams are visible only to their
          members.
        </p>
      </header>
      {can(workspace.role, 'teams.create') && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            createTeam.mutate(
              { name: name.trim(), key, template: 'generic', isPrivate },
              { onSuccess: () => setName(''), onError: (e) => setError(e.message) },
            );
          }}
        >
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <Label htmlFor="team-name">New team</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Design"
              required
              maxLength={60}
            />
          </div>
          <label className="flex h-8 items-center gap-1.5 text-[13px]">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="accent-(--accent)"
            />
            Private
          </label>
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim() || keyTaken || !teamKeySchema.safeParse(key).success}
          >
            Create {key && `(${key})`}
          </Button>
          {keyTaken && (
            <FieldError className="w-full">
              The key {key} is already used. Try a different name.
            </FieldError>
          )}
          {error && <FieldError className="w-full">{error}</FieldError>}
        </form>
      )}
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {data.teams.map((team) => {
          const isMember = team.memberIds.includes(userId);
          return (
            <li key={team.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
              <TeamBadge teamKey={team.key} />
              <Link
                to="/$workspace/team/$teamKey/tasks"
                params={{ workspace: workspace.slug, teamKey: team.key }}
                className="flex-1 truncate font-medium hover:underline"
              >
                {team.name}
              </Link>
              {team.isPrivate && (
                <LockIcon className="size-3.5 text-fg-subtle" aria-label="Private team" />
              )}
              <Link
                to="/$workspace/settings/teams/$teamKey"
                params={{ workspace: workspace.slug, teamKey: team.key }}
                className="flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-muted hover:text-fg"
                aria-label={`${team.name} settings`}
              >
                <SettingsIcon className="size-4" />
              </Link>
              <span className="text-xs text-fg-subtle tabular">
                {team.memberIds.length} members
              </span>
              {isMember ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => membership.leave.mutate({ teamId: team.id, userId })}
                >
                  Leave
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => membership.join.mutate({ teamId: team.id, userId })}
                >
                  Join
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
