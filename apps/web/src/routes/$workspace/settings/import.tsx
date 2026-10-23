import { buttonVariants, Label, Select } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FileSpreadsheetIcon, LockIcon, PlugZapIcon } from 'lucide-react';
import { useState } from 'react';
import type { Source } from '../../../features/import/sources';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';
import { m } from '../../../i18n/importer';

export const Route = createFileRoute('/$workspace/settings/import')({ component: ImportSettings });

type From = 'csv' | Source['id'];

const cards = (): {
  from: From;
  name: string;
  summary: string;
  brings: string;
  needs: string;
}[] => {
  const text = m.importer.settings.cards;
  return [
    { from: 'linear', name: 'Linear', ...text.linear },
    { from: 'asana', name: 'Asana', ...text.asana },
    { from: 'clickup', name: 'ClickUp', ...text.clickup },
    { from: 'csv', ...text.csv },
  ];
};

function ImportSettings() {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  // Importing creates tasks in a team, so only teams you belong to.
  const teams = data.myTeams;
  const [teamKey, setTeamKey] = useState(teams[0]?.key ?? '');

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold font-display">{m.importer.settings.title}</h2>
        <p className="text-[13px] text-fg-muted">{m.importer.settings.intro}</p>
      </section>

      {teams.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-[13px] text-fg-muted">
          {m.importer.settings.joinTeam}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-team">{m.importer.settings.into}</Label>
            <Select
              id="import-team"
              className="w-60"
              value={teamKey}
              onValueChange={setTeamKey}
              options={teams.map((team) => ({ value: team.key, label: team.name }))}
            />
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {cards().map((card) => (
              <li
                key={card.from}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
              >
                <div className="flex items-center gap-2">
                  {card.from === 'csv' ? (
                    <FileSpreadsheetIcon aria-hidden className="size-4 text-fg-muted" />
                  ) : (
                    <PlugZapIcon aria-hidden className="size-4 text-fg-muted" />
                  )}
                  <h3 className="text-sm font-semibold">{card.name}</h3>
                </div>
                <p className="text-[13px]">{card.summary}</p>
                <dl className="flex flex-col gap-2 text-xs">
                  <div>
                    <dt className="font-medium">{m.importer.settings.bringsOver}</dt>
                    <dd className="text-fg-muted">{card.brings}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">{m.importer.settings.youNeed}</dt>
                    <dd className="text-fg-muted">{card.needs}</dd>
                  </div>
                </dl>
                <Link
                  to="/$workspace/team/$teamKey/import"
                  params={{ workspace: workspace.slug, teamKey }}
                  search={{ from: card.from }}
                  className={buttonVariants({ size: 'sm', className: 'mt-auto self-start' })}
                >
                  {m.importer.settings.importFrom(card.name)}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{m.importer.settings.howItWorks}</h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-fg-muted marker:text-fg-subtle">
          {m.importer.settings.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2 text-[13px] text-fg-muted">
        <h3 className="text-sm font-semibold text-fg">{m.importer.settings.goodToKnow}</h3>
        <p className="flex gap-2">
          <LockIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {m.importer.settings.tokens}
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-fg-subtle">
          {m.importer.settings.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
