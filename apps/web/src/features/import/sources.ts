import {
  asanaComments,
  clickUpComments,
  fromAsana,
  fromClickUp,
  fromLinear,
  type ExternalTask,
} from '@daiq/domain';
import { m } from '../../i18n/importer';

/*
 * Reading tasks from Linear, Asana and ClickUp, straight from the browser
 * (all three allow cross-origin requests). The person's API token is used for
 * these requests only: it is never sent to Daiquiri's servers or stored.
 */

export interface Scope {
  id: string;
  name: string;
  group: string;
}

export interface FetchOptions {
  comments: boolean;
  onProgress: (message: string) => void;
}

export interface Source {
  id: 'linear' | 'asana' | 'clickup';
  name: string;
  /** What the person picks to import: a team, a project or a list. */
  scopeLabel: string;
  tokenLabel: string;
  tokenHelp: { text: string; url: string };
  scopes: (token: string) => Promise<Scope[]>;
  tasks: (token: string, scope: Scope, options: FetchOptions) => Promise<ExternalTask[]>;
}

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** JSON from a service, waiting out rate limits (HTTP 429) a few times. */
async function request(
  source: string,
  url: string,
  init: RequestInit,
  attempt = 0,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(m.importer.sources.unreachable(source));
  }
  if (response.status === 429 && attempt < 5) {
    const wait = Number(response.headers.get('retry-after')) || 2 ** attempt * 5;
    await sleep(Math.min(wait, 60) * 1000);
    return request(source, url, init, attempt + 1);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(m.importer.sources.rejected(source));
  }
  if (!response.ok) throw new Error(m.importer.sources.httpError(source, response.status));
  return response.json();
}

/** Runs `fn` over `items`, `limit` at a time. */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      // oxlint-disable-next-line no-await-in-loop
      if (item !== undefined) results[index] = await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown) => (typeof value === 'string' ? value : '');

// Linear ------------------------------------------------------------------------

async function linear(token: string, query: string, variables: Record<string, unknown>) {
  const body = record(
    await request('Linear', 'https://api.linear.app/graphql', {
      method: 'POST',
      // Personal API keys go in the header as they are, without "Bearer".
      headers: { 'Content-Type': 'application/json', Authorization: token.trim() },
      body: JSON.stringify({ query, variables }),
    }),
  );
  const errors = list(body.errors);
  if (errors.length)
    throw new Error(`Linear: ${text(record(errors[0]).message) || m.importer.sources.queryFailed}`);
  return record(body.data);
}

const LINEAR_ISSUE = (comments: boolean) => `
  id title description priority estimate dueDate
  state { name type }
  assignee { name email }
  labels(first: 20) { nodes { name } }
  project { name }
  parent { id }
  ${comments ? 'comments(first: 25) { nodes { body createdAt user { name } } }' : ''}`;

const linearSource: Source = {
  id: 'linear',
  name: 'Linear',
  get scopeLabel() {
    return m.importer.sources.linear.scope;
  },
  get tokenLabel() {
    return m.importer.sources.linear.token;
  },
  get tokenHelp() {
    return {
      text: m.importer.sources.linear.help,
      url: 'https://linear.app/settings/account/security',
    };
  },
  scopes: async (token) => {
    const data = await linear(token, 'query { teams(first: 100) { nodes { id key name } } }', {});
    return list(record(data.teams).nodes).map((value) => {
      const team = record(value);
      return {
        id: text(team.id),
        name: `${text(team.name)} (${text(team.key)})`,
        group: m.importer.sources.teams,
      };
    });
  },
  tasks: async (token, scope, { comments, onProgress }) => {
    const tasks: ExternalTask[] = [];
    let after: string | null = null;
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop
      const data = await linear(
        token,
        `query ($team: String!, $after: String) {
          team(id: $team) { issues(first: 50, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { ${LINEAR_ISSUE(comments)} } } } }`,
        { team: scope.id, after },
      );
      const issues = record(record(data.team).issues);
      tasks.push(...list(issues.nodes).flatMap((issue) => fromLinear(issue) ?? []));
      onProgress(m.importer.sources.issuesRead(tasks.length));
      const page = record(issues.pageInfo);
      if (page.hasNextPage !== true) break;
      after = text(page.endCursor);
    }
    return tasks;
  },
};

// Asana ---------------------------------------------------------------------------

const ASANA = 'https://app.asana.com/api/1.0';
const ASANA_FIELDS =
  'name,notes,completed,due_on,start_on,assignee.name,assignee.email,tags.name,memberships.project.gid,memberships.section.name,parent.gid,num_subtasks';

async function asanaPages(token: string, path: string): Promise<unknown[]> {
  const items: unknown[] = [];
  let offset: string | null = null;
  for (;;) {
    const url = `${ASANA}${path}${path.includes('?') ? '&' : '?'}limit=100${offset ? `&offset=${offset}` : ''}`;
    const init = { headers: { Authorization: `Bearer ${token.trim()}` } };
    // oxlint-disable-next-line no-await-in-loop
    const body = record(await request('Asana', url, init));
    items.push(...list(body.data));
    const next = record(body.next_page).offset;
    if (typeof next !== 'string') return items;
    offset = next;
  }
}

const asanaSource: Source = {
  id: 'asana',
  name: 'Asana',
  get scopeLabel() {
    return m.importer.sources.asana.scope;
  },
  get tokenLabel() {
    return m.importer.sources.asana.token;
  },
  get tokenHelp() {
    return { text: m.importer.sources.asana.help, url: 'https://app.asana.com/0/my-apps' };
  },
  scopes: async (token) => {
    const workspaces = await asanaPages(token, '/workspaces');
    const groups = await mapLimit(workspaces, 3, async (value) => {
      const workspace = record(value);
      const projects = await asanaPages(
        token,
        `/projects?workspace=${text(workspace.gid)}&archived=false&opt_fields=name`,
      );
      return projects.map((p) => ({
        id: text(record(p).gid),
        name: text(record(p).name),
        group: text(workspace.name),
      }));
    });
    return groups.flat();
  },
  tasks: async (token, scope, { comments, onProgress }) => {
    const top = await asanaPages(token, `/projects/${scope.id}/tasks?opt_fields=${ASANA_FIELDS}`);
    const tasks = top.flatMap((value) => fromAsana(value, scope.id) ?? []);
    onProgress(m.importer.sources.tasksRead(tasks.length));
    // Sub-tasks are not project members: read them per task, two levels down.
    let level = top.filter((value) => Number(record(value).num_subtasks) > 0);
    for (let depth = 0; depth < 2 && level.length; depth++) {
      // oxlint-disable-next-line no-await-in-loop
      const found = await mapLimit(level, 3, (value) =>
        asanaPages(token, `/tasks/${text(record(value).gid)}/subtasks?opt_fields=${ASANA_FIELDS}`),
      );
      const subtasks = found.flat();
      tasks.push(...subtasks.flatMap((value) => fromAsana(value, scope.id) ?? []));
      onProgress(m.importer.sources.tasksRead(tasks.length));
      level = subtasks.filter((value) => Number(record(value).num_subtasks) > 0);
    }
    if (comments) {
      let done = 0;
      await mapLimit(tasks, 3, async (task) => {
        const stories = await asanaPages(
          token,
          `/tasks/${task.sourceId}/stories?opt_fields=type,text,created_at,created_by.name`,
        );
        task.comments = asanaComments(stories);
        done += 1;
        if (done % 10 === 0) onProgress(m.importer.sources.commentsRead(done, tasks.length));
      });
    }
    return tasks;
  },
};

// ClickUp -------------------------------------------------------------------------------

const CLICKUP = 'https://api.clickup.com/api/v2';
const clickUp = (token: string, path: string) =>
  request('ClickUp', `${CLICKUP}${path}`, { headers: { Authorization: token.trim() } }).then(
    record,
  );

const clickUpSource: Source = {
  id: 'clickup',
  name: 'ClickUp',
  get scopeLabel() {
    return m.importer.sources.clickup.scope;
  },
  get tokenLabel() {
    return m.importer.sources.clickup.token;
  },
  get tokenHelp() {
    return { text: m.importer.sources.clickup.help, url: 'https://app.clickup.com/settings/apps' };
  },
  scopes: async (token) => {
    const teams = list((await clickUp(token, '/team')).teams);
    const perTeam = await mapLimit(teams, 2, async (value) => {
      const team = record(value);
      const spaces = list(
        (await clickUp(token, `/team/${text(team.id)}/space?archived=false`)).spaces,
      );
      const perSpace = await mapLimit(spaces, 3, async (spaceValue) => {
        const space = record(spaceValue);
        const [folders, loose] = await Promise.all([
          clickUp(token, `/space/${text(space.id)}/folder?archived=false`),
          clickUp(token, `/space/${text(space.id)}/list?archived=false`),
        ]);
        const inFolders = list(folders.folders).flatMap((folderValue) => {
          const folder = record(folderValue);
          return list(folder.lists).map((l) => ({
            id: text(record(l).id),
            name: `${text(folder.name)} / ${text(record(l).name)}`,
            group: `${text(team.name)} · ${text(space.name)}`,
          }));
        });
        const direct = list(loose.lists).map((l) => ({
          id: text(record(l).id),
          name: text(record(l).name),
          group: `${text(team.name)} · ${text(space.name)}`,
        }));
        return [...direct, ...inFolders];
      });
      return perSpace.flat();
    });
    return perTeam.flat();
  },
  tasks: async (token, scope, { comments, onProgress }) => {
    const tasks: ExternalTask[] = [];
    for (let page = 0; ; page++) {
      // oxlint-disable-next-line no-await-in-loop
      const body = await clickUp(
        token,
        `/list/${scope.id}/task?page=${page}&subtasks=true&include_closed=true&include_markdown_description=true`,
      );
      tasks.push(...list(body.tasks).flatMap((task) => fromClickUp(task) ?? []));
      onProgress(m.importer.sources.tasksRead(tasks.length));
      if (body.last_page === true || list(body.tasks).length === 0) break;
    }
    if (comments) {
      let done = 0;
      await mapLimit(tasks, 3, async (task) => {
        task.comments = clickUpComments(
          list((await clickUp(token, `/task/${task.sourceId}/comment`)).comments),
        );
        done += 1;
        if (done % 10 === 0) onProgress(m.importer.sources.commentsRead(done, tasks.length));
      });
    }
    return tasks;
  },
};

export const SOURCES: readonly Source[] = [linearSource, asanaSource, clickUpSource];
