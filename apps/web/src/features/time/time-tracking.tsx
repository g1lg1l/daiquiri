import { useRunningTimer, useTimeEntries, useTimeEntryActions, useTimerActions } from '@daiq/data';
import { formatClock, formatDuration, parseDuration, type Task } from '@daiq/domain';
import { Avatar, Button, FieldError, Input, Label } from '@daiq/ui';
import { PlayIcon, PlusIcon, SquareIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useToday } from '../../lib/use-today';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { useElapsed } from './use-elapsed';

const seconds = (start: string, end: string) =>
  (new Date(end).getTime() - new Date(start).getTime()) / 1000;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Time logged on a task: a timer and manual entries (feature spec §3.5). */
export function TimeTracking({ task }: { task: Task }) {
  const { userId } = useWorkspace();
  const data = useWorkspaceData();
  const entries = useTimeEntries(task.id);
  const running = useRunningTimer(userId).data;
  const timer = useTimerActions(userId);
  const actions = useTimeEntryActions(task);
  const runningHere = running?.taskId === task.id ? running : null;
  const elapsed = useElapsed(runningHere?.startedAt);
  const today = useToday();
  const [logging, setLogging] = useState(false);
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const finished = (entries.data ?? []).filter((e) => e.endedAt !== null);
  const total =
    finished.reduce((sum, e) => sum + seconds(e.startedAt, e.endedAt ?? e.startedAt), 0) + elapsed;

  return (
    <section aria-labelledby="time-heading" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 id="time-heading" className="text-[13px] font-semibold">
          Time
        </h2>
        <span
          className="text-xs text-fg-muted tabular"
          aria-label={`Total ${formatDuration(total)}`}
        >
          {total > 0 ? formatDuration(total) : 'None logged'}
        </span>
        <span className="ml-auto flex gap-1">
          {runningHere ? (
            <Button size="sm" onClick={() => timer.stop.mutate()}>
              <SquareIcon className="fill-current" /> Stop
              <span className="tabular">{formatClock(elapsed)}</span>
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => timer.start.mutate(task)}>
              <PlayIcon /> Start timer
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setLogging(!logging)}>
            <PlusIcon /> Log time
          </Button>
        </span>
      </div>

      {logging && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const length = parseDuration(duration);
            if (!length) {
              setError('Enter a duration between 1 minute and 24 hours, like 1h 30m or 45m.');
              return;
            }
            // Today's entries end now; earlier days at the end of a working day.
            const end = date === today ? new Date() : new Date(`${date}T17:00:00`);
            actions.add.mutate(
              {
                startedAt: new Date(end.getTime() - length * 1000).toISOString(),
                endedAt: end.toISOString(),
                note: note.trim() || null,
              },
              {
                onSuccess: () => {
                  setDuration('');
                  setNote('');
                  setError(null);
                  setLogging(false);
                },
                onError: (e) => setError(e.message),
              },
            );
          }}
        >
          <div className="flex w-28 flex-col gap-1.5">
            <Label htmlFor="time-duration">Duration</Label>
            <Input
              id="time-duration"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              placeholder="1h 30m"
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="time-date">Date</Label>
            <Input
              id="time-date"
              type="date"
              value={date}
              max={today}
              onChange={(event) => setDate(event.target.value || today)}
            />
          </div>
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <Label htmlFor="time-note">Note</Label>
            <Input
              id="time-note"
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <Button type="submit" variant="primary" size="sm">
            Log
          </Button>
          {error && <FieldError className="w-full">{error}</FieldError>}
        </form>
      )}

      {finished.length > 0 && (
        <ul className="flex flex-col gap-1">
          {finished.map((entry) => {
            const person = data.membersById.get(entry.userId)?.displayName ?? 'Former member';
            return (
              <li
                key={entry.id}
                className="group/entry flex items-center gap-2 text-xs text-fg-muted"
              >
                <Avatar name={person} size="xs" />
                <span className="font-medium text-fg">{person}</span>
                <span className="tabular">
                  {formatDuration(seconds(entry.startedAt, entry.endedAt ?? entry.startedAt))}
                </span>
                <span>{day(entry.startedAt)}</span>
                {entry.note && <span className="min-w-0 truncate">{entry.note}</span>}
                {entry.userId === userId && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto opacity-0 group-hover/entry:opacity-100 focus-visible:opacity-100"
                    aria-label={`Delete ${formatDuration(seconds(entry.startedAt, entry.endedAt ?? entry.startedAt))} on ${day(entry.startedAt)}`}
                    onClick={() => actions.remove.mutate(entry.id)}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
