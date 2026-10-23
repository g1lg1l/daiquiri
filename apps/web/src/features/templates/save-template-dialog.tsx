import { useTemplateActions } from '@daiq/data';
import type { TemplateKind } from '@daiq/domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FieldError,
  Input,
  Label,
  toast,
} from '@daiq/ui';
import { useState } from 'react';
import { m } from '../../i18n';
import { formString } from '../../lib/forms';
import { useWorkspace } from '../workspace/workspace-context';

/** Names and saves a task or a project as a template for its team. */
export function SaveTemplateDialog({
  kind,
  sourceId,
  defaultName,
  open,
  onOpenChange,
}: {
  kind: TemplateKind;
  sourceId: string;
  defaultName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspace } = useWorkspace();
  const { save } = useTemplateActions(workspace.id);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{m.task.template.title[kind]}</DialogTitle>
        <DialogDescription>{m.task.template.what[kind]}</DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const name = formString(new FormData(event.currentTarget), 'name').trim();
            save.mutate(
              { kind, sourceId, name },
              {
                onSuccess: () => {
                  toast(m.task.template.saved(name));
                  onOpenChange(false);
                },
                onError: (e) => setError(e.message),
              },
            );
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">{m.task.template.name}</Label>
            <Input
              id="template-name"
              name="name"
              required
              maxLength={80}
              defaultValue={defaultName}
              autoFocus
            />
          </div>
          {error && <FieldError>{error}</FieldError>}
          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              {m.common.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {m.task.template.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
