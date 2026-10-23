import { useRecurrence, useRecurrenceActions } from '@daiq/data';
import {
  describeRecurrence,
  isRecurrenceUnit,
  RECURRENCE_UNITS,
  WEEKDAY_SHORT,
  type RecurrenceRule,
  type Task,
} from '@daiq/domain';
import { Button, cn, Input, Label, Popover, PopoverContent, PopoverTrigger } from '@daiq/ui';
import { RepeatIcon } from 'lucide-react';
import { useState } from 'react';

const DEFAULT_RULE: RecurrenceRule = {
  unit: 'week',
  every: 1,
  weekdays: [],
  afterCompletion: false,
};
// Monday first.
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const weekdayName = (day: number) =>
  new Date(2023, 0, 1 + day).toLocaleDateString(undefined, { weekday: 'long' });
const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

const select = 'h-8 rounded-md border border-border bg-surface px-2 text-[13px]';

/** The task's "Repeat" property: shows the rule and edits it in a popover (feature spec §3.7). */
export function RecurrenceEditor({
  task,
  triggerClassName,
}: {
  task: Pick<Task, 'id' | 'workspaceId'>;
  triggerClassName: string;
}) {
  const recurrence = useRecurrence(task.id).data ?? null;
  const actions = useRecurrenceActions(task);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RecurrenceRule>(DEFAULT_RULE);
  const weekly = draft.unit === 'week' && !draft.afterCompletion;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(recurrence ?? DEFAULT_RULE);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className={triggerClassName}>
            <RepeatIcon className={cn(!recurrence && 'text-fg-subtle')} />
            <span className={cn('truncate', !recurrence && 'text-fg-subtle')}>
              {recurrence ? describeRecurrence(recurrence) : 'Doesn’t repeat'}
            </span>
          </Button>
        }
      />
      <PopoverContent className="w-72 p-3">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            actions.set.mutate(draft);
            setOpen(false);
          }}
        >
          <fieldset className="flex rounded-md border border-border p-0.5 text-[13px]">
            <legend className="sr-only">Create the next task</legend>
            {[
              { value: false, label: 'On a schedule' },
              { value: true, label: 'After completion' },
            ].map((mode) => (
              <label
                key={mode.label}
                className={cn(
                  'flex-1 cursor-pointer rounded-[5px] px-2 py-1 text-center text-fg-muted has-focus-visible:outline-2 has-focus-visible:outline-focus',
                  draft.afterCompletion === mode.value && 'bg-surface-emphasis text-fg',
                )}
              >
                <input
                  type="radio"
                  name="recurrence-mode"
                  className="sr-only"
                  checked={draft.afterCompletion === mode.value}
                  onChange={() => setDraft({ ...draft, afterCompletion: mode.value })}
                />
                {mode.label}
              </label>
            ))}
          </fieldset>

          <div className="flex items-end gap-2">
            <div className="flex w-20 flex-col gap-1.5">
              <Label htmlFor="recurrence-every">{draft.afterCompletion ? 'After' : 'Every'}</Label>
              <Input
                id="recurrence-every"
                type="number"
                min={1}
                max={365}
                required
                value={draft.every}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    every: Math.min(365, Math.max(1, event.target.valueAsNumber || 1)),
                  })
                }
              />
            </div>
            <select
              aria-label="Unit"
              className={cn(select, 'flex-1')}
              value={draft.unit}
              onChange={(event) => {
                const unit = event.target.value;
                if (isRecurrenceUnit(unit)) setDraft({ ...draft, unit });
              }}
            >
              {RECURRENCE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {draft.every === 1 ? unit : `${unit}s`}
                </option>
              ))}
            </select>
          </div>

          {weekly && (
            <fieldset className="flex justify-between gap-1">
              <legend className="mb-1.5 text-xs text-fg-muted">On</legend>
              {WEEK.map((day) => (
                <label
                  key={day}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-border text-xs text-fg-muted has-checked:border-accent has-checked:bg-accent-subtle has-checked:text-fg has-focus-visible:outline-2 has-focus-visible:outline-focus"
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    aria-label={weekdayName(day)}
                    checked={draft.weekdays.includes(day)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        weekdays: event.target.checked
                          ? [...draft.weekdays, day]
                          : draft.weekdays.filter((d) => d !== day),
                      })
                    }
                  />
                  {WEEKDAY_SHORT[day]?.slice(0, 2)}
                </label>
              ))}
            </fieldset>
          )}

          <p className="text-xs text-fg-subtle">
            {draft.afterCompletion
              ? 'The next task is created when this one is completed, after the time above.'
              : recurrence?.nextOn && !recurrence.afterCompletion
                ? `Next task on ${formatDay(recurrence.nextOn)}. Its due date keeps this task’s rhythm.`
                : 'Each new task gets this task’s details, with dates moved forward.'}
          </p>

          <div className="flex justify-end gap-2">
            {recurrence && (
              <Button
                type="button"
                onClick={() => {
                  actions.clear.mutate();
                  setOpen(false);
                }}
              >
                Stop repeating
              </Button>
            )}
            <Button type="submit" variant="primary">
              {recurrence ? 'Save' : 'Repeat'}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
