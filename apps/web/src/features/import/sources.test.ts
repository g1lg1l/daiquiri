import { SOURCES } from './sources';

/** A fake service: answers by path, records what was asked. */
function serve(routes: Record<string, unknown>) {
  const asked: { url: string; auth: string | null }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      asked.push({ url, auth: new Headers(init?.headers).get('authorization') });
      const key = Object.keys(routes).find((path) => url.includes(path));
      return Promise.resolve(
        key ? new Response(JSON.stringify(routes[key])) : new Response('{}', { status: 404 }),
      );
    }),
  );
  return asked;
}

const source = (id: string) => {
  const found = SOURCES.find((s) => s.id === id);
  if (!found) throw new Error(id);
  return found;
};
const options = { comments: true, onProgress: () => undefined };

describe('import sources', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads an Asana project with sub-tasks and comments', async () => {
    const asked = serve({
      '/projects/p1/tasks': {
        data: [
          {
            gid: 't1',
            name: 'Brief',
            num_subtasks: 1,
            memberships: [{ project: { gid: 'p1' }, section: { name: 'Doing' } }],
          },
        ],
        next_page: null,
      },
      '/tasks/t1/subtasks': {
        data: [{ gid: 't2', name: 'Draft', parent: { gid: 't1' }, num_subtasks: 0 }],
      },
      '/tasks/t1/stories': {
        data: [{ type: 'comment', text: 'Nice', created_at: '2026-10-01T00:00:00Z' }],
      },
      '/tasks/t2/stories': { data: [] },
    });
    const tasks = await source('asana').tasks(
      'pat',
      { id: 'p1', name: 'Launch', group: 'Acme' },
      options,
    );
    expect(tasks.map((t) => [t.title, t.parentId, t.status, t.comments.length])).toEqual([
      ['Brief', null, 'Doing', 1],
      ['Draft', 't1', null, 0],
    ]);
    expect(asked.every((a) => a.auth === 'Bearer pat')).toBe(true);
  });

  it('lists ClickUp lists across spaces and folders, and pages through tasks', async () => {
    serve({
      '/team/9/space': { spaces: [{ id: 's1', name: 'Product' }] },
      '/team': { teams: [{ id: '9', name: 'Acme' }] },
      '/space/s1/folder': { folders: [{ name: 'Q4', lists: [{ id: 'l2', name: 'Launch' }] }] },
      '/space/s1/list': { lists: [{ id: 'l1', name: 'Inbox' }] },
    });
    const scopes = await source('clickup').scopes('pk_1');
    expect(scopes).toEqual([
      { id: 'l1', name: 'Inbox', group: 'Acme · Product' },
      { id: 'l2', name: 'Q4 / Launch', group: 'Acme · Product' },
    ]);

    const asked = serve({
      'page=0': { tasks: [{ id: 'a', name: 'One' }], last_page: false },
      'page=1': { tasks: [{ id: 'b', name: 'Two', parent: 'a' }], last_page: true },
      '/comment': { comments: [] },
    });
    const tasks = await source('clickup').tasks(
      'pk_1',
      scopes[0] ?? { id: '', name: '', group: '' },
      options,
    );
    expect(tasks.map((t) => `${t.sourceId}<${t.parentId ?? ''}`)).toEqual(['a<', 'b<a']);
    // Personal tokens go in the header as they are.
    expect(asked[0]?.auth).toBe('pk_1');
  });

  it('explains a rejected token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))),
    );
    await expect(source('linear').scopes('bad')).rejects.toThrow(
      'Linear did not accept this token.',
    );
  });
});
