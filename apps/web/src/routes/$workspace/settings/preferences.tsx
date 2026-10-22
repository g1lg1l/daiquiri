import { useMembers, useUpdateProfile } from '@daiq/data';
import { Button, Input, Label, toast, useTheme, type ThemePreference } from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  setShortcutsEnabled,
  SHORTCUTS_DISABLED_KEY as SHORTCUTS_KEY,
} from '../../../features/shortcuts/keyboard';
import { useWorkspace } from '../../../features/workspace/workspace-context';

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
