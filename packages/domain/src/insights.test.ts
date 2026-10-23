import { exportRows, formatHours, median, summarize, toCsv, weeklyThroughput } from './insights';
import type { Status, Task } from './model';

const todo: Status = { id: 'todo', teamId: 't', name: 'Todo', category: 'unstarted', position: 1 };
const done: Status = { id: 'done', teamId: 't', name: 'Done', category: 'completed', position: 2 };
const statuses = new Map([todo, done].map((s) => [s.id, s]));

// Noon local time keeps the calendar day stable in every time zone.
const at = (day: string) => new Date(`${day}T12:00:00`).toISOString();

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    workspaceId: 'w',
    teamId: 't',
    number: 1,
    title: 'Task',
    statusId: 'todo',
    priority: 0,
    projectId: null,
    parentId: null,
    creatorId: null,
    startDate: null,
    dueDate: null,
    estimate: null,
    cycleId: null,
    milestoneId: null,
    attachmentCount: 0,
    recurring: false,
    fields: {},
    sortKey: 'a',
    completedAt: null,
    canceledAt: null,
    createdAt: at('2026-10-01'),
    updatedAt: at('2026-10-01'),
    assigneeIds: [],
    labelIds: [],
    ...overrides,
  };
}

// Friday 23 October 2026; weeks start on Monday 19 October.
const today = '2026-10-23';

describe('insights', () => {
  it('counts created and completed work per week with running burn-up totals', () => {
    const weeks = weeklyThroughput(
      [
        task({ createdAt: at('2026-01-05'), completedAt: at('2026-01-09'), statusId: 'done' }),
        task({ createdAt: at('2026-10-12'), completedAt: at('2026-10-20'), statusId: 'done' }),
        task({ createdAt: at('2026-10-20') }),
        task({ createdAt: at('2026-10-13'), canceledAt: at('2026-10-21') }),
      ],
      today,
      2,
    );
    expect(weeks).toEqual([
      { week: '2026-10-12', created: 2, completed: 0, scope: 3, done: 1 },
      { week: '2026-10-19', created: 1, completed: 1, scope: 3, done: 2 },
    ]);
  });

  it('summarizes open, overdue and completed work', () => {
    const summary = summarize(
      [
        task({ dueDate: '2026-10-20', assigneeIds: ['ana'], estimate: 3 }),
        task({ dueDate: '2026-10-30', assigneeIds: ['ana', 'bo'] }),
        task({}),
        task({ statusId: 'done', createdAt: at('2026-10-11'), completedAt: at('2026-10-21') }),
        task({ statusId: 'done', createdAt: at('2026-10-01'), completedAt: at('2026-10-05') }),
      ],
      statuses,
      today,
    );
    expect(summary).toMatchObject({ open: 3, overdue: 1, completedThisWeek: 1, leadTimeDays: 7 });
    expect(summary.byStatus.map((s) => [s.status.name, s.tasks])).toEqual([
      ['Todo', 3],
      ['Done', 2],
    ]);
    expect(summary.byAssignee).toEqual([
      { assigneeId: 'ana', tasks: 2, estimate: 3 },
      { assigneeId: 'bo', tasks: 1, estimate: 0 },
      { assigneeId: null, tasks: 1, estimate: 0 },
    ]);
  });

  it('takes medians and formats durations', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(formatHours(5.4)).toBe('5 h');
    expect(formatHours(84)).toBe('3.5 d');
    expect(formatHours(400)).toBe('17 d');
  });
});

describe('export', () => {
  it('writes readable rows and safe CSV', () => {
    const rows = exportRows(
      [
        task({
          title: '=HYPERLINK("http://evil")',
          assigneeIds: ['ana'],
          fields: { f1: 's2' },
          dueDate: '2026-10-30',
        }),
      ],
      {
        identifier: () => 'ENG-1',
        statuses,
        members: new Map([['ana', { displayName: 'Ana' }]]),
        labels: new Map(),
        projects: new Map(),
        fields: [
          {
            id: 'f1',
            workspaceId: 'w',
            name: 'Severity',
            kind: 'select',
            options: [{ id: 's2', name: 'Major, really' }],
            position: 0,
          },
        ],
      },
    );
    expect(rows[0]).toMatchObject({
      ID: 'ENG-1',
      Status: 'Todo',
      Assignees: 'Ana',
      Severity: 'Major, really',
    });
    const [header, line] = toCsv(rows).split('\r\n');
    expect(header?.startsWith('ID,Title,Status,Priority')).toBe(true);
    // Formulas are neutralised and quotes doubled; commas force quoting.
    expect(line).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(line).toContain('"Major, really"');
  });
});
