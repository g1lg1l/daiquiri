import { buttonVariants, Label, Select } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FileSpreadsheetIcon, LockIcon, PlugZapIcon } from 'lucide-react';
import { useState } from 'react';
import type { Source } from '../../../features/import/sources';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';

export const Route = createFileRoute('/$workspace/settings/import')({ component: ImportSettings });

type From = 'csv' | Source['id'];

const CARDS: { from: From; name: string; summary: string; brings: string; needs: string }[] = [
  {
    from: 'linear',
    name: 'Linear',
    summary: 'A whole Linear team, sub-issues included.',
    brings:
      'Titles, Markdown descriptions, statuses, priorities, assignees, labels, projects, due dates, estimates, sub-issues and comments.',
    needs: 'A personal API key (Settings → Account → Security & access).',
  },
  {
    from: 'asana',
    name: 'Asana',
    summary: 'One Asana project; its sections become statuses.',
    brings:
      'Task names, notes, sections and completion, assignees, tags as labels, start and due dates, two levels of sub-tasks, and comments.',
    needs: 'A personal access token (My settings → Apps → Developer apps).',
  },
  {
    from: 'clickup',
    name: 'ClickUp',
    summary: 'One ClickUp list, with its sub-tasks.',
    brings:
      'Names, Markdown descriptions, statuses, priorities, assignees, tags as labels, start and due dates, time estimates or points, sub-tasks and comments.',
    needs: 'A personal API token (Settings → Apps).',
  },
  {
    from: 'csv',
    name: 'CSV file',
    summary: 'A spreadsheet or an export from any other tool.',
    brings:
      'Any of title, description, status, priority, assignees, labels, project, start and due dates and estimate. You match the columns before importing.',
    needs: 'A .csv file with a header row, up to 10,000 rows.',
  },
];

function ImportSettings() {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  // Importing creates tasks in a team, so only teams you belong to.
  const teams = data.myTeams;
  const [teamKey, setTeamKey] = useState(teams[0]?.key ?? '');

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold font-display">Import</h2>
        <p className="text-[13px] text-fg-muted">
          Bring your work over from another tool. Imported tasks are added to the team you choose,
          above what is already there; nothing changes in the tool you import from, so you can try
          it and import again.
        </p>
      </section>

      {teams.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-[13px] text-fg-muted">
          Join a team first: tasks are always imported into a team.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-team">Import into</Label>
            <Select
              id="import-team"
              className="w-60"
              value={teamKey}
              onValueChange={setTeamKey}
              options={teams.map((team) => ({ value: team.key, label: team.name }))}
            />
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {CARDS.map((card) => (
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
                    <dt className="font-medium">Brings over</dt>
                    <dd className="text-fg-muted">{card.brings}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">You need</dt>
                    <dd className="text-fg-muted">{card.needs}</dd>
                  </div>
                </dl>
                <Link
                  to="/$workspace/team/$teamKey/import"
                  params={{ workspace: workspace.slug, teamKey }}
                  search={{ from: card.from }}
                  className={buttonVariants({ size: 'sm', className: 'mt-auto self-start' })}
                >
                  Import from {card.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">How it works</h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-fg-muted marker:text-fg-subtle">
          <li>Connect with a token, or choose a CSV file.</li>
          <li>Pick what to import and check how its statuses map to your team’s.</li>
          <li>Review the summary (people, new labels, new projects) and import.</li>
        </ol>
      </section>

      <section className="flex flex-col gap-2 text-[13px] text-fg-muted">
        <h3 className="text-sm font-semibold text-fg">Good to know</h3>
        <p className="flex gap-2">
          <LockIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Tokens are used by your browser to read from the other tool during the import. They are
          never sent to Daiquiri’s servers and never saved.
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-fg-subtle">
          <li>
            People are matched to members by email (when you are an admin) or by name; anyone else
            is left unassigned.
          </li>
          <li>Labels and projects that don’t exist yet can be created during the import.</li>
          <li>
            Comments are posted by you, starting with their original author and date, because
            Daiquiri cannot write as someone else.
          </li>
          <li>Sub-tasks deeper than three levels are attached to their nearest allowed parent.</li>
        </ul>
      </section>
    </>
  );
}
