import { useCreateLabel, useLabelActions } from '@daiq/data';
import { can, LABEL_COLORS, type LabelColor } from '@daiq/domain';
import { Button, Input, Label, Menu, MenuContent, MenuItem, MenuTrigger } from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { LABEL_COLOR } from '../../../features/tasks/label-colors';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';
import { m } from '../../../i18n/settings';
import { newId } from '../../../lib/ids';

export const Route = createFileRoute('/$workspace/settings/labels')({ component: LabelsSettings });

function LabelsSettings() {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const createLabel = useCreateLabel(workspace.id);
  const labelActions = useLabelActions(workspace.id);
  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColor>('blue');
  const canManage = can(workspace.role, 'labels.manage');

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold font-display">{m.settings.sections.labels}</h2>
        <p className="text-[13px] text-fg-muted">{m.settings.labels.intro}</p>
      </header>
      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          createLabel.mutate(
            { id: newId(), name: name.trim(), color },
            { onSuccess: () => setName('') },
          );
        }}
      >
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="label-name">{m.settings.labels.newLabel}</Label>
          <Input
            id="label-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={40}
            placeholder={m.settings.labels.namePlaceholder}
          />
        </div>
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{m.settings.labels.colour}</legend>
          {LABEL_COLORS.map((c) => (
            <label
              key={c}
              className="cursor-pointer rounded-full p-0.5 has-checked:ring-2 has-checked:ring-focus"
            >
              <input
                type="radio"
                name="color"
                value={c}
                checked={color === c}
                onChange={() => setColor(c)}
                className="sr-only"
                aria-label={m.settings.labels.colours[c]}
              />
              <span className="block size-4 rounded-full" style={{ background: LABEL_COLOR[c] }} />
            </label>
          ))}
        </fieldset>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          {m.common.create}
        </Button>
      </form>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {data.labels.map((label) => (
          <li key={label.id} className="flex items-center gap-3 px-3 py-1.5 text-[13px]">
            {canManage ? (
              <Menu>
                <MenuTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-full p-1 hover:bg-surface-muted"
                      aria-label={m.settings.labels.colourOf(label.name)}
                    />
                  }
                >
                  <span
                    className="block size-2.5 rounded-full"
                    style={{ background: LABEL_COLOR[label.color] }}
                  />
                </MenuTrigger>
                <MenuContent className="flex min-w-0 flex-wrap gap-0.5 p-1">
                  {LABEL_COLORS.map((c) => (
                    <MenuItem
                      key={c}
                      className="size-7 justify-center px-0"
                      aria-label={m.settings.labels.colours[c]}
                      onClick={() => labelActions.update.mutate({ id: label.id, color: c })}
                    >
                      <span
                        className="block size-3 rounded-full"
                        style={{ background: LABEL_COLOR[c] }}
                      />
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            ) : (
              <span
                className="m-1 size-2.5 rounded-full"
                style={{ background: LABEL_COLOR[label.color] }}
              />
            )}
            {canManage ? (
              <Input
                aria-label={m.settings.labels.nameOf(label.name)}
                defaultValue={label.name}
                maxLength={40}
                className="h-7 flex-1 border-transparent bg-transparent shadow-none hover:border-border"
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== label.name)
                    labelActions.update.mutate({ id: label.id, name: next });
                  else e.target.value = label.name;
                }}
              />
            ) : (
              <span className="flex-1">{label.name}</span>
            )}
            {canManage ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger"
                onClick={() => labelActions.remove.mutate(label.id)}
              >
                {m.common.delete}
              </Button>
            ) : (
              <span className="text-xs text-fg-subtle">{m.settings.labels.adminsCanEdit}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
