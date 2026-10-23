import { useCreateLabel, useImportTasks, useTasks, type ImportRow } from '@daiq/data';
import {
  guessMapping,
  IMPORT_TARGET_LABEL,
  IMPORT_TARGETS,
  parseCsv,
  parseDateCell,
  parsePriority,
  isPriority,
  PRIORITY_LABEL,
  sortKeysBetween,
  splitList,
  textToDocument,
  type ImportTarget,
  type Team,
} from '@daiq/domain';
import { Button, FieldError, Label } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { UploadIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NotFoundPanel } from '../../../../components/not-found-panel';
import { ViewHeader } from '../../../../features/shell/view-header';
import {
  useWorkspace,
  useWorkspaceData,
  type WorkspaceData,
} from '../../../../features/workspace/workspace-context';
import { newId } from '../../../../lib/ids';

export const Route = createFileRoute('/$workspace/team/$teamKey/import')({
  component: ImportTasks,
});

const MAX_ROWS = 10_000;
const rowsName = (count: number) => (count === 1 ? '1 row names' : `${count} rows name`);
const select = 'h-8 rounded-md border border-border bg-surface px-2 text-[13px]';
type Mapping = Partial<Record<ImportTarget, number>>;

interface Plan {
  /** With the line they came from (1 is the header). */
  rows: (Omit<ImportRow, 'id' | 'sortKey' | 'labelIds'> & { line: number })[];
  labelNames: string[][];
  missingLabels: string[];
  unmatched: { status: number; assignee: number; project: number };
}

const byName = <T,>(items: readonly T[], name: (item: T) => string) =>
  new Map(items.map((item) => [name(item).trim().toLowerCase(), item]));

/** Turns CSV rows into tasks for this team, matching names to statuses, people, labels and projects. */
function plan(rows: string[][], mapping: Mapping, team: Team, data: WorkspaceData): Plan {
  const statuses = byName(team.statuses, (s) => s.name);
  const members = byName(data.members, (m) => m.displayName);
  const labels = byName(data.labels, (l) => l.name);
  const projects = byName(
    data.projects.filter((p) => p.teamId === team.id),
    (p) => p.name,
  );
  const cell = (row: string[], target: ImportTarget) => {
    const index = mapping[target];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };
  const unmatched = { status: 0, assignee: 0, project: 0 };
  const missing = new Set<string>();
  const labelNames: string[][] = [];

  const planned = rows.flatMap((row, index) => {
    const title = cell(row, 'title').slice(0, 200);
    if (!title) return [];
    const status = cell(row, 'status');
    const statusId = status ? (statuses.get(status.toLowerCase())?.id ?? null) : null;
    if (status && !statusId) unmatched.status += 1;
    const people = splitList(cell(row, 'assignee'));
    const assigneeIds = people.flatMap((name) => members.get(name.toLowerCase())?.id ?? []);
    if (assigneeIds.length < people.length) unmatched.assignee += 1;
    const project = cell(row, 'project');
    const projectId = project ? (projects.get(project.toLowerCase())?.id ?? null) : null;
    if (project && !projectId) unmatched.project += 1;
    const names = splitList(cell(row, 'labels')).map((name) => name.slice(0, 40));
    for (const name of names) if (!labels.has(name.toLowerCase())) missing.add(name);
    labelNames.push(names);
    const estimate = Math.round(Number(cell(row, 'estimate')));
    return [
      {
        line: index + 2,
        title,
        description: textToDocument(cell(row, 'description').slice(0, 20_000)),
        statusId,
        priority: parsePriority(cell(row, 'priority')),
        projectId,
        dueDate: parseDateCell(cell(row, 'dueDate')),
        startDate: parseDateCell(cell(row, 'startDate')),
        estimate:
          cell(row, 'estimate') && Number.isFinite(estimate) && estimate >= 0 && estimate <= 999
            ? estimate
            : null,
        assigneeIds,
      },
    ];
  });
  return { rows: planned, labelNames, missingLabels: [...missing], unmatched };
}

function ImportTasks() {
  const { teamKey } = Route.useParams();
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const team = data.teamsByKey.get(teamKey);
  const tasks = useTasks(team ? { kind: 'team', id: team.id } : null);
  const importTasks = useImportTasks(team?.id ?? '');
  const createLabel = useCreateLabel(workspace.id);
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [createLabels, setCreateLabels] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columns = (table[0] ?? []).map((name, index) => ({ name, index }));
  const body = table.slice(1);
  const result = useMemo(
    () => (team && body.length ? plan(body, mapping, team, data) : null),
    [team, body, mapping, data],
  );

  if (!team) {
    return (
      <NotFoundPanel title="Team not found" message={`There is no team with the key ${teamKey}.`} />
    );
  }

  const read = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setError('The file has no rows to import.');
      return;
    }
    if (rows.length - 1 > MAX_ROWS) {
      setError(`Import at most ${MAX_ROWS.toLocaleString()} tasks at a time; split the file.`);
      return;
    }
    setFileName(file.name);
    setTable(rows);
    setMapping(guessMapping(rows[0] ?? []));
  };

  const run = async () => {
    if (!result) return;
    setError(null);
    setProgress(0);
    try {
      // Labels that do not exist yet, created once each.
      const created = new Map<string, string>();
      if (createLabels) {
        for (const name of result.missingLabels) {
          // oxlint-disable-next-line no-await-in-loop
          const label = await createLabel.mutateAsync({ id: newId(), name, color: 'gray' });
          created.set(name.toLowerCase(), label.id);
        }
      }
      const labelId = (name: string) =>
        data.labels.find((l) => l.name.toLowerCase() === name.toLowerCase())?.id ??
        created.get(name.toLowerCase());
      // Above everything already in the list, in the file's order.
      const first = tasks.data?.reduce<string | null>(
        (min, task) => (min === null || task.sortKey < min ? task.sortKey : min),
        null,
      );
      const keys = sortKeysBetween(null, first ?? null, result.rows.length);
      const rows: ImportRow[] = result.rows.map(({ line: _line, ...row }, index) => ({
        ...row,
        id: newId(),
        sortKey: keys[index] ?? '',
        labelIds: (result.labelNames[index] ?? []).flatMap((name) => labelId(name) ?? []),
      }));
      await importTasks.mutateAsync({ rows, onProgress: setProgress });
      setImported(rows.length);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : 'The import stopped.'} Tasks imported before the error stay in ${team.name}.`,
      );
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title="Import tasks" icon={<UploadIcon className="size-4 text-fg-muted" />} />
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 md:p-6">
          {imported !== null ? (
            <section className="flex flex-col items-start gap-3" aria-live="polite">
              <h2 className="text-lg font-semibold font-display">
                Imported {imported.toLocaleString()} tasks
              </h2>
              <Link
                to="/$workspace/team/$teamKey/tasks"
                params={{ workspace: workspace.slug, teamKey: team.key }}
                className="text-[13px] text-accent-text underline-offset-4 hover:underline"
              >
                Open {team.name}’s tasks
              </Link>
            </section>
          ) : (
            <>
              <p className="text-[13px] text-fg-muted">
                Bring tasks into {team.name} from a CSV file, such as an export from Linear, Asana,
                ClickUp or a spreadsheet. Columns are matched by name; check them before importing.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-file">CSV file</Label>
                <input
                  id="import-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="text-[13px] file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-[13px] file:text-fg"
                  onChange={(event) => void read(event.target.files?.[0])}
                />
              </div>

              {fileName && result && (
                <>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-[13px] font-semibold">Columns</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {IMPORT_TARGETS.map((target) => (
                        <label
                          key={target}
                          className="flex items-center justify-between gap-3 text-[13px]"
                        >
                          {IMPORT_TARGET_LABEL[target]}
                          <select
                            className={select}
                            value={mapping[target] ?? ''}
                            onChange={(event) =>
                              setMapping({
                                ...mapping,
                                [target]:
                                  event.target.value === ''
                                    ? undefined
                                    : Number(event.target.value),
                              })
                            }
                          >
                            <option value="">
                              {target === 'title' ? 'Choose a column' : 'Don’t import'}
                            </option>
                            {columns.map((column) => (
                              <option key={column.index} value={column.index}>
                                {column.name || `Column ${column.index + 1}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <section aria-label="Preview" className="flex flex-col gap-2">
                    <h2 className="text-[13px] font-semibold">
                      Preview: {result.rows.length.toLocaleString()} tasks from {fileName}
                    </h2>
                    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-[13px]">
                      {result.rows.slice(0, 5).map((row) => (
                        <li
                          key={row.line}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate font-medium">{row.title}</span>
                          <span className="text-xs text-fg-muted">
                            {team.statuses.find((s) => s.id === row.statusId)?.name ??
                              'Default status'}
                          </span>
                          {isPriority(row.priority) && row.priority > 0 && (
                            <span className="text-xs text-fg-muted">
                              {PRIORITY_LABEL[row.priority]}
                            </span>
                          )}
                          {row.dueDate && (
                            <span className="text-xs text-fg-muted tabular">{row.dueDate}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <ul className="text-xs text-fg-muted">
                      {result.unmatched.status > 0 && (
                        <li>
                          {rowsName(result.unmatched.status)} a status {team.name} doesn’t have:
                          they get the default status.
                        </li>
                      )}
                      {result.unmatched.assignee > 0 && (
                        <li>
                          {rowsName(result.unmatched.assignee)} people who aren’t members: they are
                          left unassigned.
                        </li>
                      )}
                      {result.unmatched.project > 0 && (
                        <li>
                          {rowsName(result.unmatched.project)} a project {team.name} doesn’t have:
                          no project is set.
                        </li>
                      )}
                    </ul>
                    {result.missingLabels.length > 0 && (
                      <label className="flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={createLabels}
                          onChange={(event) => setCreateLabels(event.target.checked)}
                          className="accent-(--accent)"
                        />
                        Create {result.missingLabels.length} missing labels (
                        {result.missingLabels.slice(0, 5).join(', ')}
                        {result.missingLabels.length > 5 ? ', …' : ''})
                      </label>
                    )}
                  </section>

                  {mapping.title === undefined && (
                    <FieldError>Choose the column with the task titles.</FieldError>
                  )}
                  {error && <FieldError>{error}</FieldError>}
                  {progress !== null && (
                    <progress
                      aria-label="Importing"
                      max={result.rows.length}
                      value={progress}
                      className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-surface-muted [&::-webkit-progress-value]:bg-accent"
                    />
                  )}
                  <Button
                    variant="primary"
                    className="self-start"
                    disabled={
                      mapping.title === undefined || result.rows.length === 0 || progress !== null
                    }
                    onClick={() => void run()}
                  >
                    Import {result.rows.length.toLocaleString()} tasks
                  </Button>
                </>
              )}
              {!fileName && error && <FieldError>{error}</FieldError>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
