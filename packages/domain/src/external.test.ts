import {
  asanaComments,
  clickUpComments,
  defaultStatusFor,
  fromAsana,
  fromClickUp,
  fromLinear,
  orderForImport,
  type ExternalTask,
} from './external';
import type { Status } from './model';

const node = (sourceId: string, parentId: string | null): ExternalTask => ({
  sourceId,
  parentId,
  title: sourceId,
  description: '',
  descriptionFormat: 'text',
  status: null,
  category: null,
  priority: 0,
  assignees: [],
  labels: [],
  project: null,
  dueDate: null,
  startDate: null,
  estimatePoints: null,
  estimateHours: null,
  comments: [],
});

describe('importing from other tools', () => {
  it('reads a Linear issue', () => {
    const task = fromLinear({
      id: 'lin-1',
      title: 'Crash on save',
      description: '**Steps**\n\n1. Save',
      priority: 1,
      estimate: 3,
      dueDate: '2026-11-02',
      state: { name: 'In Review', type: 'started' },
      assignee: { name: 'Ana Ruiz', email: 'ana@example.com' },
      labels: { nodes: [{ name: 'Bug' }] },
      project: { name: 'Mobile app' },
      parent: { id: 'lin-0' },
      comments: {
        nodes: [{ body: 'On it', createdAt: '2026-10-20T10:00:00Z', user: { name: 'Marco' } }],
      },
    });
    expect(task).toMatchObject({
      sourceId: 'lin-1',
      parentId: 'lin-0',
      status: 'In Review',
      category: 'started',
      priority: 1,
      estimatePoints: 3,
      labels: ['Bug'],
      project: 'Mobile app',
      descriptionFormat: 'markdown',
      comments: [{ author: 'Marco', text: 'On it' }],
    });
    expect(fromLinear({ title: 'No id' })).toBeNull();
  });

  it('reads an Asana task, using its section as the status', () => {
    const task = fromAsana(
      {
        gid: '12',
        name: 'Write the brief',
        notes: 'Plain notes',
        completed: true,
        due_on: '2026-11-05',
        assignee: { name: 'Lea Novak', email: null },
        tags: [{ name: 'Content' }],
        memberships: [{ project: { gid: 'p1' }, section: { name: 'Doing' } }],
      },
      'p1',
    );
    expect(task).toMatchObject({
      status: 'Doing',
      category: 'completed',
      descriptionFormat: 'text',
    });
    expect(
      asanaComments([
        { type: 'system', text: 'moved this', created_at: '2026-10-01T00:00:00Z' },
        {
          type: 'comment',
          text: 'Looks good',
          created_at: '2026-10-02T00:00:00Z',
          created_by: { name: 'Ana' },
        },
      ]),
    ).toEqual([{ author: 'Ana', at: '2026-10-02T00:00:00Z', text: 'Looks good' }]);
  });

  it('reads a ClickUp task: priority words, status types, epoch dates, estimates in hours', () => {
    const task = fromClickUp({
      id: 'cu1',
      name: 'Plan the event',
      text_content: 'Text',
      status: { status: 'in progress', type: 'custom' },
      priority: { priority: 'high' },
      assignees: [{ username: 'tomas', email: 'tomas@example.com' }],
      tags: [{ name: 'ops' }],
      due_date: String(new Date(2026, 10, 30, 12).getTime()),
      time_estimate: 5_400_000,
      parent: 'cu0',
    });
    expect(task).toMatchObject({
      category: 'started',
      priority: 2,
      dueDate: '2026-11-30',
      estimateHours: 1.5,
      parentId: 'cu0',
    });
    expect(
      clickUpComments([{ comment_text: 'Hi', date: '0', user: { username: 'Lea' } }]),
    ).toHaveLength(1);
  });

  it('orders parents first and folds nesting deeper than three levels', () => {
    const ordered = orderForImport([
      node('d', 'c'),
      node('c', 'b'),
      node('b', 'a'),
      node('a', null),
      node('x', 'missing'),
      node('p', 'q'),
      node('q', 'p'),
    ]);
    expect(ordered.map((t) => `${t.sourceId}<${t.parentId ?? ''}`)).toEqual([
      'a<',
      'b<a',
      // Siblings keep the source's order.
      'd<b',
      'c<b',
      'x<',
      'p<',
      'q<p',
    ]);
  });

  it('maps statuses by name, then by kind', () => {
    const statuses: Status[] = [
      { id: 's1', teamId: 't', name: 'Todo', category: 'unstarted', position: 1 },
      { id: 's2', teamId: 't', name: 'In Progress', category: 'started', position: 2 },
      { id: 's3', teamId: 't', name: 'In Review', category: 'started', position: 3 },
    ];
    expect(defaultStatusFor({ status: 'in review', category: 'started' }, statuses)).toBe('s3');
    expect(defaultStatusFor({ status: 'Doing', category: 'started' }, statuses)).toBe('s2');
    expect(defaultStatusFor({ status: 'Someday', category: null }, statuses)).toBeNull();
  });
});
