import {
  useMembers,
  useNotificationSettings,
  useSetNotificationLevel,
  useUpdateProfile,
} from '@daiq/data';
import { isNotificationLevel, type NotificationLevel } from '@daiq/domain';
import { Button, Input, Label, Select, toast, useTheme, type ThemePreference } from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  setShortcutsEnabled,
  SHORTCUTS_DISABLED_KEY as SHORTCUTS_KEY,
} from '../../../features/shortcuts/keyboard';
import { TeamBadge } from '../../../components/team-badge';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';
import { locale, LOCALES, setLocale } from '../../../i18n';
import { m } from '../../../i18n/settings';

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

const LEVELS: NotificationLevel[] = ['all', 'participating', 'mute'];

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
        <h2 className="text-lg font-semibold font-display">
          {m.settings.preferences.notifications}
        </h2>
        <p className="text-[13px] text-fg-muted">{m.settings.preferences.notificationsIntro}</p>
      </header>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {data.myTeams.map((team) => (
          <li key={team.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
            <TeamBadge teamKey={team.key} />
            <label htmlFor={`notify-${team.id}`} className="flex-1">
              {team.name}
            </label>
            <Select
              id={`notify-${team.id}`}
              value={settings.data?.find((s) => s.teamId === team.id)?.level ?? 'all'}
              onValueChange={(level) => {
                if (isNotificationLevel(level)) setLevel.mutate({ teamId: team.id, level });
              }}
              options={LEVELS.map((value) => ({
                value,
                label: m.settings.preferences.levels[value],
              }))}
            />
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
  const me = members.data?.find((member) => member.id === userId);
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(me?.displayName ?? '');
  const [shortcuts, setShortcuts] = useState(readShortcutsEnabled);

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold font-display">{m.settings.preferences.profile}</h2>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            updateProfile.mutate(
              { userId, displayName: name.trim() },
              { onSuccess: () => toast(m.settings.preferences.nameUpdated) },
            );
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="display-name">{m.settings.preferences.displayName}</Label>
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
            {m.common.save}
          </Button>
        </form>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold font-display">{m.settings.preferences.appearance}</h2>
        <fieldset className="flex gap-2">
          <legend className="sr-only">{m.settings.preferences.theme}</legend>
          {(['system', 'light', 'dark'] as const satisfies readonly ThemePreference[]).map(
            (value) => (
              <label
                key={value}
                className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-[13px] has-checked:border-accent has-checked:bg-accent-subtle/60"
              >
                <input
                  type="radio"
                  name="theme"
                  checked={preference === value}
                  onChange={() => setPreference(value)}
                  className="accent-(--accent)"
                />
                {m.settings.preferences.themes[value]}
              </label>
            ),
          )}
        </fieldset>
        <div className="flex flex-col items-start gap-1.5">
          <Label htmlFor="language">{m.settings.preferences.language}</Label>
          <Select
            id="language"
            value={locale}
            onValueChange={(value) => {
              const next = LOCALES.find((l) => l.id === value);
              if (next) setLocale(next.id);
            }}
            options={LOCALES.map((l) => ({ value: l.id, label: l.name }))}
          />
          <p className="text-xs text-fg-subtle">{m.settings.preferences.languageHint}</p>
        </div>
      </section>
      <NotificationLevels />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold font-display">{m.settings.preferences.keyboard}</h2>
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
            className="switch mt-0.5"
          />
          <span>
            {m.settings.preferences.shortcuts}
            <span className="block text-xs text-fg-subtle">
              {m.settings.preferences.shortcutsHint}
            </span>
          </span>
        </label>
      </section>
    </>
  );
}
