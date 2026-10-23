import type { Status, Task } from './model';
import {
  filterTasks,
  groupTasks,
  hasActiveFilters,
  nestSubtasks,
  sameViewConfig,
  sortTasks,
  toViewConfig,
  viewSearchSchema,
  type GroupContext,
} from './view';

const statuses: Status[] = [
  { id: 'todo', teamId: 't', name: 'Todo', category: 'unstarted', position: 1 },
  { id: 'doing', teamId: 't', name: 'Doing', category: 'started', position: 1 },
  { id: 'done', teamId: 't', name: 'Done', category: 'completed', position: 1 },
];

let seq = 0;
const task = (overrides: Partial<Task>): Task => ({
  id: `task-${++seq}`,
  workspaceId: 'w',
  teamId: 't',
  number: seq,
  title: `Task ${seq}`,
  statusId: 'todo',
  priority: 0,
  projectId: null,
  parentId: null,
  creatorId: 'me',
  startDate: null,
  dueDate: null,
  estimate: null,
  cycleId: null,
  milestoneId: null,
  sortKey: `a${seq}`,
  completedAt: null,
  canceledAt: null,
  createdAt: `2026-10-0${seq % 9}T00:00:00Z`,
  updatedAt: `2026-10-0${seq % 9}T00:00:00Z`,
  assigneeIds: [],
  labelIds: [],
  ...overrides,
});

const context: GroupContext = {
  userId: 'me',
  today: '2026-10-22',
  statuses: new Map(statuses.map((s) => [s.id, s])),
  orderedStatuses: statuses,
  members: new Map([
    ['me', { displayName: 'Me' }],
    ['ana', { displayName: 'Ana' }],
  ]),
  projects: new Map(),
  labels: new Map(),
};

describe('view engine', () => {
  const tasks = [
    task({ title: 'Fix login', priority: 1, assigneeIds: ['me'], dueDate: '2026-10-20' }),
    task({ title: 'Write docs', priority: 4, assigneeIds: ['ana'], statusId: 'doing' }),
    task({ title: 'Old done', statusId: 'done', completedAt: '2026-09-01T00:00:00Z' }),
    task({
      title: 'Recently done',
      statusId: 'done',
      completedAt: '2026-10-21T00:00:00Z',
      labelIds: ['bug'],
    }),
    task({ title: 'Plan launch', priority: 2, dueDate: '2026-10-24' }),
  ];

  it('parses URL search params leniently', () => {
    expect(
      viewSearchSchema.parse({ group: 'nope', assignee: 'me,none', priority: [1, '2'] }),
    ).toEqual({
      group: undefined,
      assignee: ['me', 'none'],
      priority: [1, 2],
    });
  });

  it('hides completed work older than a week by default', () => {
    const titles = filterTasks(tasks, {}, context).map((t) => t.title);
    expect(titles).not.toContain('Old done');
    expect(titles).toContain('Recently done');
    expect(filterTasks(tasks, { completed: 'none' }, context).map((t) => t.title)).not.toContain(
      'Recently done',
    );
    expect(filterTasks(tasks, { completed: 'all' }, context)).toHaveLength(5);
  });

  it('filters by me, none, priority, due and text', () => {
    expect(filterTasks(tasks, { assignee: ['me'] }, context).map((t) => t.title)).toEqual([
      'Fix login',
    ]);
    expect(filterTasks(tasks, { assignee: ['none'] }, context)).toHaveLength(2);
    expect(filterTasks(tasks, { priority: [1, 2] }, context)).toHaveLength(2);
    expect(filterTasks(tasks, { due: 'overdue' }, context).map((t) => t.title)).toEqual([
      'Fix login',
    ]);
    expect(filterTasks(tasks, { due: 'week' }, context)).toHaveLength(2);
    expect(filterTasks(tasks, { q: 'LAUNCH' }, context).map((t) => t.title)).toEqual([
      'Plan launch',
    ]);
    expect(filterTasks(tasks, { category: ['started'] }, context).map((t) => t.title)).toEqual([
      'Write docs',
    ]);
  });

  it('knows when filters are active', () => {
    expect(hasActiveFilters({ group: 'priority', layout: 'board' })).toBe(false);
    expect(hasActiveFilters({ assignee: ['me'] })).toBe(true);
    expect(hasActiveFilters({ q: '' })).toBe(false);
  });

  it('sorts by priority with no priority last, and by due date with undated last', () => {
    expect(sortTasks(tasks, 'priority').map((t) => t.priority)).toEqual([1, 2, 4, 0, 0]);
    expect(
      sortTasks(tasks, 'due')
        .slice(0, 2)
        .map((t) => t.dueDate),
    ).toEqual(['2026-10-20', '2026-10-24']);
  });

  it('groups by status keeping empty workflow columns', () => {
    const groups = groupTasks(filterTasks(tasks, {}, context), 'status', context);
    expect(groups.map((g) => [g.label, g.tasks.length])).toEqual([
      ['Todo', 2],
      ['Doing', 1],
      ['Done', 1],
    ]);
  });

  it('groups by assignee with me first and unassigned last', () => {
    const groups = groupTasks(tasks, 'assignee', context);
    expect(groups.map((g) => g.label)).toEqual(['Me', 'Ana', 'No assignee']);
  });

  it('nests sub-tasks under their parents at any depth', () => {
    const parent = task({ title: 'Parent' });
    const child = task({ title: 'Child', parentId: parent.id });
    const grandchild = task({ title: 'Grandchild', parentId: child.id });
    const loose = task({ title: 'Loose' });
    expect(
      nestSubtasks([grandchild, loose, child, parent]).map((n) => `${n.task.title}:${n.depth}`),
    ).toEqual(['Loose:0', 'Parent:0', 'Child:1', 'Grandchild:2']);
  });
});

describe('saved view configs', () => {
  it('drops per-visit params, empty filters and defaults', () => {
    expect(
      toViewConfig({
        layout: 'list',
        group: 'priority',
        peek: 'ENG-1',
        view: '5f0c9b3e-2d4a-4c8e-9a51-0b6f1e2d3c4b',
        status: [],
        q: '',
      }),
    ).toEqual({ group: 'priority' });
  });

  it('treats id lists as sets', () => {
    expect(sameViewConfig({ label: ['b', 'a'] }, { label: ['a', 'b'] })).toBe(true);
    expect(sameViewConfig({ label: ['a'] }, { label: ['a', 'b'] })).toBe(false);
  });

  it('notices a changed display option', () => {
    expect(sameViewConfig({ layout: 'board' }, {})).toBe(false);
    expect(sameViewConfig({ layout: 'list' }, {})).toBe(true);
  });

  it('accepts a saved view id in the URL and rejects anything else', () => {
    expect(viewSearchSchema.parse({ view: 'not-a-uuid' }).view).toBeUndefined();
  });
});

describe('grouping by milestone', () => {
  it('keeps every milestone in order and adds "No milestone" only when used', () => {
    const milestones = [
      {
        id: 'm2',
        workspaceId: 'w',
        teamId: 't',
        projectId: 'p',
        name: 'GA',
        targetDate: null,
        sortKey: 'a2',
      },
      {
        id: 'm1',
        workspaceId: 'w',
        teamId: 't',
        projectId: 'p',
        name: 'Beta',
        targetDate: null,
        sortKey: 'a1',
      },
    ];
    const tasks = [task({ id: 'x', milestoneId: 'm2' }), task({ id: 'y', milestoneId: null })];
    const groups = groupTasks(tasks, 'milestone', { ...context, milestones });
    expect(groups.map((g) => [g.label, g.tasks.length])).toEqual([
      ['Beta', 0],
      ['GA', 1],
      ['No milestone', 1],
    ]);
    expect(
      groupTasks([tasks[0]!], 'milestone', { ...context, milestones }).map((g) => g.label),
    ).toEqual(['Beta', 'GA']);
  });
});
