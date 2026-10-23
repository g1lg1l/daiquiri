import { QueryClient } from '@tanstack/react-query';
import type { Task } from '@daiq/domain';
import { findTask, patchTask, removeTasks, snapshotTasks, upsertTask, upsertTasks } from './cache';
import { keys } from './keys';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  workspaceId: 'w1',
  teamId: 'team-a',
  number: 1,
  title: 'Task',
  statusId: 's1',
  priority: 0,
  projectId: null,
  parentId: null,
  creatorId: 'me',
  startDate: null,
  dueDate: null,
  estimate: null,
  cycleId: null,
  milestoneId: null,
  attachmentCount: 0,
  sortKey: 'a0',
  completedAt: null,
  canceledAt: null,
  createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  assigneeIds: [],
  labelIds: [],
  ...overrides,
});

function setup() {
  const client = new QueryClient();
  client.setQueryData(keys.tasks({ kind: 'team', id: 'team-a' }), [task()]);
  client.setQueryData(keys.tasks({ kind: 'team', id: 'team-b' }), []);
  client.setQueryData(keys.tasks({ kind: 'project', id: 'p1' }), []);
  client.setQueryData(keys.tasks({ kind: 'assignee', id: 'me', workspaceId: 'w1' }), []);
  return client;
}

const list = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryData<Task[]>(key) ?? [];

describe('task cache patchers', () => {
  it('moves a task between scoped lists when its properties change', () => {
    const client = setup();
    patchTask(client, 't1', { projectId: 'p1', assigneeIds: ['me'] });
    expect(list(client, keys.tasks({ kind: 'project', id: 'p1' }))).toHaveLength(1);
    expect(
      list(client, keys.tasks({ kind: 'assignee', id: 'me', workspaceId: 'w1' })),
    ).toHaveLength(1);

    upsertTask(client, { ...findTask(client, 't1')!, teamId: 'team-b', projectId: null });
    expect(list(client, keys.tasks({ kind: 'team', id: 'team-a' }))).toHaveLength(0);
    expect(list(client, keys.tasks({ kind: 'team', id: 'team-b' }))).toHaveLength(1);
    expect(list(client, keys.tasks({ kind: 'project', id: 'p1' }))).toHaveLength(0);
  });

  it('inserts new tasks only into matching lists', () => {
    const client = setup();
    upsertTask(client, task({ id: 't2', teamId: 'team-b' }));
    expect(list(client, keys.tasks({ kind: 'team', id: 'team-b' })).map((t) => t.id)).toEqual([
      't2',
    ]);
    expect(list(client, keys.tasks({ kind: 'team', id: 'team-a' })).map((t) => t.id)).toEqual([
      't1',
    ]);
  });

  it('removes tasks everywhere and restores snapshots', () => {
    const client = setup();
    const restore = snapshotTasks(client);
    removeTasks(client, new Set(['t1']));
    expect(findTask(client, 't1')).toBeUndefined();
    restore();
    expect(findTask(client, 't1')?.title).toBe('Task');
  });

  it('keeps detail queries in sync', () => {
    const client = setup();
    client.setQueryData(keys.taskDetail('team-a', 1), { ...task(), description: null });
    patchTask(client, 't1', { title: 'Renamed' });
    expect(client.getQueryData<Task>(keys.taskDetail('team-a', 1))?.title).toBe('Renamed');
  });

  it('applies a batch with one write per list', () => {
    const client = setup();
    const writes: unknown[] = [];
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success')
        writes.push(event.query.queryKey);
    });
    const batch = Array.from({ length: 500 }, (_, i) =>
      task({ id: `n${i}`, number: i + 2, title: `New ${i}` }),
    );
    upsertTasks(client, [task({ title: 'Renamed' }), ...batch]);
    unsubscribe();
    expect(list(client, keys.tasks({ kind: 'team', id: 'team-a' }))).toHaveLength(501);
    expect(findTask(client, 't1')?.title).toBe('Renamed');
    expect(list(client, keys.tasks({ kind: 'team', id: 'team-b' }))).toHaveLength(0);
    expect(writes).toHaveLength(1);
  });
});
