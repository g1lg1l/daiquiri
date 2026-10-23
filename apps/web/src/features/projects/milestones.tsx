import { useMilestoneActions, useMilestones } from '@daiq/data';
import {
  isClosedCategory,
  parseIsoDate,
  sortKeyBetween,
  type Milestone,
  type Project,
  type Task,
} from '@daiq/domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Label,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@daiq/ui';
import { DiamondIcon, MoreHorizontalIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { locale } from '../../i18n';
import { m } from '../../i18n/team';
import { formString } from '../../lib/forms';
import { newId } from '../../lib/ids';
import { DateField } from '../tasks/task-actions';
import { pushUndo } from '../undo/undo';
import { useWorkspaceData } from '../workspace/workspace-context';

function MilestoneForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Pick<Milestone, 'name' | 'targetDate'>;
  submitLabel: string;
  onSubmit: (values: { name: string; targetDate: string | null }) => void;
}) {
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? null);
  return (
    <form
      className="flex w-64 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const name = formString(form, 'name').trim();
        if (name) onSubmit({ name, targetDate });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="milestone-name">{m.team.nameLabel}</Label>
        <Input
          id="milestone-name"
          name="name"
          required
          maxLength={120}
          autoFocus
          defaultValue={initial?.name}
          placeholder={m.team.milestones.namePlaceholder}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">{m.team.targetDate}</span>
        <DateField
          label={m.team.targetDate}
          value={targetDate}
          onChange={setTargetDate}
          variant="secondary"
        />
      </div>
      <Button type="submit" variant="primary" size="sm">
        {submitLabel}
      </Button>
    </form>
  );
}

/**
 * The project's milestones in order, each with its progress (feature spec §2).
 * Group the task list by milestone to see and move their tasks.
 */
export function Milestones({ project, tasks }: { project: Project; tasks: readonly Task[] }) {
  const data = useWorkspaceData();
  const milestones = useMilestones(project.id);
  const actions = useMilestoneActions(project);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const list = milestones.data ?? [];
  const editingMilestone = list.find((milestone) => milestone.id === editing);
  const t = m.team.milestones;
  const shortDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });

  const progress = (id: string) => {
    let done = 0;
    let total = 0;
    for (const task of tasks) {
      if (task.milestoneId !== id) continue;
      const category = data.statuses.get(task.statusId)?.category;
      if (category === 'canceled') continue;
      total += 1;
      if (category && isClosedCategory(category)) done += 1;
    }
    return { done, total };
  };

  return (
    <section
      aria-label={t.label}
      className="flex items-stretch gap-2 overflow-x-auto border-b border-border px-4 py-2 scrollbar-thin"
    >
      {list.map((milestone) => {
        const { done, total } = progress(milestone.id);
        return (
          <article
            key={milestone.id}
            aria-label={t.summary(milestone.name, done, total)}
            className="flex w-52 shrink-0 flex-col gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5"
          >
            <div className="flex items-center gap-1.5">
              <DiamondIcon aria-hidden className="size-3 shrink-0 text-accent-text" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {milestone.name}
              </span>
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      aria-label={t.actions(milestone.name)}
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuItem onClick={() => setEditing(milestone.id)}>{m.common.edit}</MenuItem>
                  <MenuItem
                    destructive
                    onClick={() => {
                      actions.remove.mutate(milestone.id);
                      pushUndo(
                        {
                          label: t.deleteUndo(milestone.name),
                          undo: () => actions.create.mutateAsync(milestone),
                        },
                        { toast: t.deleted(milestone.name) },
                      );
                    }}
                  >
                    {m.common.delete}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-fg-muted">
              <span
                className="h-1 flex-1 overflow-hidden rounded-full bg-surface-muted"
                aria-hidden
              >
                <span
                  className="block h-full rounded-full bg-status-completed"
                  style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                />
              </span>
              <span className="tabular">
                {done}/{total}
              </span>
              {milestone.targetDate && (
                <span className="tabular">
                  {shortDate.format(parseIsoDate(milestone.targetDate))}
                </span>
              )}
            </div>
          </article>
        );
      })}
      <Dialog
        open={editingMilestone !== undefined}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="w-auto">
          <DialogTitle>{t.editTitle}</DialogTitle>
          {editingMilestone && (
            <MilestoneForm
              initial={editingMilestone}
              submitLabel={m.common.save}
              onSubmit={(patch) => {
                actions.update.mutate({ id: editingMilestone.id, patch });
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Popover open={adding} onOpenChange={setAdding}>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm" className="shrink-0 self-center">
              <PlusIcon /> {list.length ? t.milestone : t.add}
            </Button>
          }
        />
        <PopoverContent className="p-3">
          <MilestoneForm
            submitLabel={t.addSubmit}
            onSubmit={({ name, targetDate }) => {
              actions.create.mutate({
                id: newId(),
                name,
                targetDate,
                sortKey: sortKeyBetween(list.at(-1)?.sortKey ?? null, null),
              });
              setAdding(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </section>
  );
}
