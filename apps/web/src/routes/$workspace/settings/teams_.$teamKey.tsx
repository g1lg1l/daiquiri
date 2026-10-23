import { useTeamFieldActions, useUpdateTeam } from '@daiq/data';
import { can, FIELD_KIND_LABEL, type EstimateScale } from '@daiq/domain';
import { buttonVariants, Input, Label, Textarea } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { NotFoundPanel } from '../../../components/not-found-panel';
import { TeamBadge } from '../../../components/team-badge';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';

export const Route = createFileRoute('/$workspace/settings/teams_/$teamKey')({
  component: TeamSettings,
});

const WEEKDAYS = Array.from({ length: 7 }, (_, day) => ({
  value: day,
  // 2023-01-01 was a Sunday: day 0.
  label: new Date(2023, 0, 1 + day).toLocaleDateString(undefined, { weekday: 'long' }),
}));

const select =
  'h-8 rounded-md border border-border bg-surface px-2 text-[13px] disabled:opacity-60';

function Module({
  title,
  description,
  enabled,
  disabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        <input
          id={`module-${title}`}
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(event) => onToggle(event.target.checked)}
          aria-describedby={`module-${title}-description`}
          className="mt-1 accent-(--accent)"
        />
        <div>
          <label htmlFor={`module-${title}`} className="block text-[13px] font-medium">
            {title}
          </label>
          <p id={`module-${title}-description`} className="text-xs text-fg-muted">
            {description}
          </p>
        </div>
      </div>
      {enabled && <div className="flex flex-wrap gap-4 pl-7">{children}</div>}
    </fieldset>
  );
}

/** One team's name, description, modules (estimates, cycles) and custom fields. */
function TeamSettings() {
  const { teamKey } = Route.useParams();
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const updateTeam = useUpdateTeam(workspace.id);
  const toggleField = useTeamFieldActions(workspace.id);
  const team = data.teamsByKey.get(teamKey);
  if (!team) {
    return (
      <NotFoundPanel
        title="Team not found"
        message={`There is no team with the key ${teamKey}, or it is private.`}
      />
    );
  }
  // RLS allows admins and the team's own (non-guest) members.
  const canEdit =
    can(workspace.role, 'workspace.update') ||
    (workspace.role !== 'guest' && team.memberIds.includes(userId));
  const save = (patch: Parameters<typeof updateTeam.mutate>[0]['patch']) =>
    updateTeam.mutate({ id: team.id, patch });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          to="/$workspace/settings/teams"
          params={{ workspace: workspace.slug }}
          className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
        >
          <ChevronLeftIcon className="size-3.5" /> Teams
        </Link>
        <h2 className="flex items-center gap-2 text-lg font-semibold font-display">
          <TeamBadge teamKey={team.key} /> {team.name}
        </h2>
        {!canEdit && (
          <p className="text-[13px] text-fg-muted">
            Only admins and members of {team.name} can change these settings.
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team-name">Name</Label>
          <Input
            id="team-name"
            defaultValue={team.name}
            key={team.name}
            maxLength={60}
            disabled={!canEdit}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== team.name) save({ name });
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team-description">Description</Label>
          <Textarea
            id="team-description"
            defaultValue={team.description ?? ''}
            key={team.description ?? ''}
            rows={2}
            maxLength={500}
            disabled={!canEdit}
            onBlur={(event) => {
              const description = event.target.value.trim() || null;
              if (description !== team.description) save({ description });
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Modules</h3>
        <Module
          title="Estimates"
          description="Size tasks in story points or hours. Shown on tasks, lists, boards and cycles."
          enabled={team.estimatesEnabled}
          disabled={!canEdit}
          onToggle={(estimatesEnabled) => save({ estimatesEnabled })}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estimate-scale">Scale</Label>
            <select
              id="estimate-scale"
              className={select}
              value={team.estimateScale}
              disabled={!canEdit}
              onChange={(event) =>
                save({ estimateScale: event.target.value === 'hours' ? 'hours' : 'points' })
              }
            >
              {(['points', 'hours'] satisfies EstimateScale[]).map((scale) => (
                <option key={scale} value={scale}>
                  {scale === 'points' ? 'Story points (1, 2, 3, 5, 8, 13)' : 'Hours'}
                </option>
              ))}
            </select>
          </div>
        </Module>
        <Module
          title="Cycles"
          description="Plan work in fixed periods. Daiquiri keeps the next three cycles ready and moves unfinished tasks into the next cycle when one ends."
          enabled={team.cyclesEnabled}
          disabled={!canEdit}
          onToggle={(cyclesEnabled) => save({ cyclesEnabled })}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-length">Length</Label>
            <select
              id="cycle-length"
              className={select}
              value={team.cycleWeeks}
              disabled={!canEdit}
              onChange={(event) => save({ cycleWeeks: Number(event.target.value) })}
            >
              {[1, 2, 3, 4].map((weeks) => (
                <option key={weeks} value={weeks}>
                  {weeks === 1 ? '1 week' : `${weeks} weeks`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-start">Starts on</Label>
            <select
              id="cycle-start"
              className={select}
              value={team.cycleStartWeekday}
              disabled={!canEdit}
              onChange={(event) => save({ cycleStartWeekday: Number(event.target.value) })}
            >
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
          <p className="w-full text-xs text-fg-subtle">
            Changes apply to cycles scheduled from now on.
          </p>
        </Module>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-[13px] font-medium">Automations</h3>
          <p className="text-xs text-fg-muted">
            Assign, label, reschedule or notify automatically when tasks change.
          </p>
        </div>
        <Link
          to="/$workspace/team/$teamKey/automations"
          params={{ workspace: workspace.slug, teamKey: team.key }}
          className={buttonVariants({ size: 'sm' })}
        >
          Manage automations
        </Link>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Custom fields</legend>
        <p className="text-xs text-fg-muted">
          Turn on the workspace fields this team uses, up to 12. Admins define them in{' '}
          <Link
            to="/$workspace/settings/fields"
            params={{ workspace: workspace.slug }}
            className="underline hover:text-fg"
          >
            Fields
          </Link>
          .
        </p>
        {data.fields.length === 0 ? (
          <p className="text-[13px] text-fg-subtle">The workspace has no custom fields yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {data.fields.map((field) => {
              const on = team.fieldIds.includes(field.id);
              return (
                <li key={field.id}>
                  <label className="flex items-center gap-3 px-3 py-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!canEdit || (!on && team.fieldIds.length >= 12)}
                      onChange={(event) =>
                        toggleField.mutate({ team, fieldId: field.id, on: event.target.checked })
                      }
                      className="accent-(--accent)"
                    />
                    <span className="flex-1">{field.name}</span>
                    <span className="text-xs text-fg-subtle">{FIELD_KIND_LABEL[field.kind]}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>
    </section>
  );
}
