import { useTeamFieldActions, useUpdateTeam } from '@daiq/data';
import { can, FIELD_KIND_LABEL, type EstimateScale } from '@daiq/domain';
import { buttonVariants, Input, Label, Select, Textarea } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { NotFoundPanel } from '../../../components/not-found-panel';
import { TeamBadge } from '../../../components/team-badge';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';
import { locale } from '../../../i18n';
import { m } from '../../../i18n/settings';

export const Route = createFileRoute('/$workspace/settings/teams_/$teamKey')({
  component: TeamSettings,
});

const weekdays = () =>
  Array.from({ length: 7 }, (_, day) => ({
    value: String(day),
    // 2023-01-01 was a Sunday: day 0.
    label: new Date(2023, 0, 1 + day).toLocaleDateString(locale, { weekday: 'long' }),
  }));

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

/** One team's name, description, modules (estimates, cycles, time tracking) and custom fields. */
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
        title={m.settings.team.notFound}
        message={m.settings.team.notFoundMessage(teamKey)}
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
          <ChevronLeftIcon className="size-3.5" /> {m.settings.sections.teams}
        </Link>
        <h2 className="flex items-center gap-2 text-lg font-semibold font-display">
          <TeamBadge teamKey={team.key} /> {team.name}
        </h2>
        {!canEdit && (
          <p className="text-[13px] text-fg-muted">{m.settings.team.readOnly(team.name)}</p>
        )}
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team-name">{m.settings.name}</Label>
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
          <Label htmlFor="team-description">{m.settings.team.description}</Label>
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
        <h3 className="text-sm font-semibold">{m.settings.team.modules}</h3>
        <Module
          title={m.settings.team.estimates.title}
          description={m.settings.team.estimates.description}
          enabled={team.estimatesEnabled}
          disabled={!canEdit}
          onToggle={(estimatesEnabled) => save({ estimatesEnabled })}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estimate-scale">{m.settings.team.estimates.scale}</Label>
            <Select
              id="estimate-scale"
              value={team.estimateScale}
              disabled={!canEdit}
              onValueChange={(value) =>
                save({ estimateScale: value === 'hours' ? 'hours' : 'points' })
              }
              options={(['points', 'hours'] satisfies EstimateScale[]).map((scale) => ({
                value: scale,
                label: m.settings.team.estimates[scale],
              }))}
            />
          </div>
        </Module>
        <Module
          title={m.settings.team.cycles.title}
          description={m.settings.team.cycles.description}
          enabled={team.cyclesEnabled}
          disabled={!canEdit}
          onToggle={(cyclesEnabled) => save({ cyclesEnabled })}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-length">{m.settings.team.cycles.length}</Label>
            <Select
              id="cycle-length"
              value={String(team.cycleWeeks)}
              disabled={!canEdit}
              onValueChange={(value) => save({ cycleWeeks: Number(value) })}
              options={[1, 2, 3, 4].map((weeks) => ({
                value: String(weeks),
                label: m.settings.team.cycles.weeks(weeks),
              }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-start">{m.settings.team.cycles.startsOn}</Label>
            <Select
              id="cycle-start"
              value={String(team.cycleStartWeekday)}
              disabled={!canEdit}
              onValueChange={(value) => save({ cycleStartWeekday: Number(value) })}
              options={weekdays()}
            />
          </div>
          <p className="w-full text-xs text-fg-subtle">{m.settings.team.cycles.note}</p>
        </Module>
        <Module
          title={m.settings.team.triage.title}
          description={m.settings.team.triage.description}
          enabled={team.triageEnabled}
          disabled={!canEdit}
          onToggle={(triageEnabled) => save({ triageEnabled })}
        >
          <p className="text-xs text-fg-subtle">{m.settings.team.triage.note}</p>
        </Module>
        <Module
          title={m.settings.team.timeTracking.title}
          description={m.settings.team.timeTracking.description}
          enabled={team.timeTrackingEnabled}
          disabled={!canEdit}
          onToggle={(timeTrackingEnabled) => save({ timeTrackingEnabled })}
        >
          <p className="text-xs text-fg-subtle">{m.settings.team.timeTracking.note}</p>
        </Module>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-[13px] font-medium">{m.settings.team.automations.title}</h3>
          <p className="text-xs text-fg-muted">{m.settings.team.automations.description}</p>
        </div>
        <Link
          to="/$workspace/team/$teamKey/automations"
          params={{ workspace: workspace.slug, teamKey: team.key }}
          className={buttonVariants({ size: 'sm' })}
        >
          {m.settings.team.automations.manage}
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-[13px] font-medium">{m.settings.team.forms.title}</h3>
          <p className="text-xs text-fg-muted">{m.settings.team.forms.description}</p>
        </div>
        <Link
          to="/$workspace/team/$teamKey/forms"
          params={{ workspace: workspace.slug, teamKey: team.key }}
          className={buttonVariants({ size: 'sm' })}
        >
          {m.settings.team.forms.manage}
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-[13px] font-medium">{m.settings.team.import.title}</h3>
          <p className="text-xs text-fg-muted">{m.settings.team.import.description}</p>
        </div>
        <Link
          to="/$workspace/team/$teamKey/import"
          params={{ workspace: workspace.slug, teamKey: team.key }}
          className={buttonVariants({ size: 'sm' })}
        >
          {m.settings.team.import.title}
        </Link>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">{m.settings.team.fields.title}</legend>
        <p className="text-xs text-fg-muted">
          {m.settings.team.fields.intro}{' '}
          <Link
            to="/$workspace/settings/fields"
            params={{ workspace: workspace.slug }}
            className="underline hover:text-fg"
          >
            {m.settings.sections.fields}
          </Link>
          .
        </p>
        {data.fields.length === 0 ? (
          <p className="text-[13px] text-fg-subtle">{m.settings.team.fields.empty}</p>
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
