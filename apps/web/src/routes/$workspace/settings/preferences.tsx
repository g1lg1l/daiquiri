import {
  useMembers,
  useNotificationSettings,
  useSetNotificationLevel,
  useUpdateProfile,
} from '@daiq/data';
import { isNotificationLevel, type NotificationLevel } from '@daiq/domain';
import { Button, Input, Label, toast, useTheme, type ThemePreference } from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  setShortcutsEnabled,
  SHORTCUTS_DISABLED_KEY as SHORTCUTS_KEY,
} from '../../../features/shortcuts/keyboard';
import { TeamBadge } from '../../../components/team-badge';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';

export const Route = createFileRoute('/$workspace/settings/preferences')({
  component: Preferences,
});

function readShortcutsEnabled(): boolean {
  try {
    return localStorage.getItem(SHORTCUTS_KEY) !== '1';
  } catch {
    return true;
  }
}

const LEVELS: { value: NotificationLevel; label: string }[] = [
  { value: 'all', label: 'All activity' },
  { value: 'participating', label: 'Only what involves me' },
  { value: 'mute', label: 'Nothing' },
];

/** Per-team notification level (feature spec §5). */
function NotificationLevels() {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const settings = useNotificationSettings(workspace.id);
  const setLevel = useSetNotificationLevel(workspace.id);
  if (data.myTeams.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-lg font-semibold font-display">Notifications</h2>
        <p className="text-[13px] text-fg-muted">
          Choose what reaches your inbox from each team. “Only what involves me” keeps assignments,
          mentions and activity on tasks you created or are assigned to.
        </p>
      </header>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {data.myTeams.map((team) => (
          <li key={team.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
            <TeamBadge teamKey={team.key} />
            <label htmlFor={`notify-${team.id}`} className="flex-1">
              {team.name}
            </label>
            <select
              id={`notify-${team.id}`}
              value={settings.data?.find((s) => s.teamId === team.id)?.level ?? 'all'}
              onChange={(event) => {
                const level = event.target.value;
                if (isNotificationLevel(level)) setLevel.mutate({ teamId: team.id, level });
              }}
              className="h-8 rounded-md border border-border bg-surface px-2 text-[13px]"
            >
              {LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Preferences() {
  const { workspace, userId } = useWorkspace();
  const { preference, setPreference } = useTheme();
  const members = useMembers(workspace.id);
  const me = members.data?.find((m) => m.id === userId);
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(me?.displayName ?? '');
  const [shortcuts, setShortcuts] = useState(readShortcutsEnabled);

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold font-display">Profile</h2>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            updateProfile.mutate(
              { userId, displayName: name.trim() },
              { onSuccess: () => toast('Name updated') },
            );
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim() || name.trim() === me?.displayName}
          >
            Save
          </Button>
        </form>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold font-display">Appearance</h2>
        <fieldset className="flex gap-2">
          <legend className="sr-only">Theme</legend>
          {(['system', 'light', 'dark'] as const satisfies readonly ThemePreference[]).map(
            (value) => (
              <label
                key={value}
                className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-[13px] capitalize has-checked:border-accent has-checked:bg-accent-subtle/60"
              >
                <input
                  type="radio"
                  name="theme"
                  checked={preference === value}
                  onChange={() => setPreference(value)}
                  className="accent-(--accent)"
                />
                {value}
              </label>
            ),
          )}
        </fieldset>
      </section>
      <NotificationLevels />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold font-display">Keyboard</h2>
        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={shortcuts}
            onChange={(e) => {
              const enabled = e.target.checked;
              setShortcuts(enabled);
              setShortcutsEnabled(enabled);
              try {
                localStorage.setItem(SHORTCUTS_KEY, enabled ? '0' : '1');
              } catch {
                // The choice still applies for this session.
              }
            }}
            className="mt-0.5 accent-(--accent)"
          />
          <span>
            Single-key shortcuts
            <span className="block text-xs text-fg-subtle">
              Turn off if you use speech input or switch devices. Shortcuts with ⌘/Ctrl always work.
            </span>
          </span>
        </label>
      </section>
    </>
  );
}
