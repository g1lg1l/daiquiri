import { useRenameWorkspace } from '@daiq/data';
import { can } from '@daiq/domain';
import { Button, Input, Label, toast } from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useWorkspace } from '../../../features/workspace/workspace-context';
import { m } from '../../../i18n/settings';

export const Route = createFileRoute('/$workspace/settings/')({ component: GeneralSettings });

function GeneralSettings() {
  const { workspace } = useWorkspace();
  const rename = useRenameWorkspace(workspace.id);
  const [name, setName] = useState(workspace.name);
  const editable = can(workspace.role, 'workspace.update');
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold font-display">{m.settings.sections.general}</h2>
        <p className="text-[13px] text-fg-muted">{m.settings.general.intro}</p>
      </header>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          rename.mutate(name.trim(), { onSuccess: () => toast(m.settings.general.renamed) });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-name">{m.settings.general.name}</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            disabled={!editable}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-url">{m.settings.general.address}</Label>
          <Input
            id="ws-url"
            value={`${window.location.origin}${import.meta.env.BASE_URL}${workspace.slug}`}
            readOnly
            disabled
          />
        </div>
        {editable && (
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="self-start"
            disabled={!name.trim() || name.trim() === workspace.name}
          >
            {m.common.save}
          </Button>
        )}
      </form>
    </section>
  );
}
