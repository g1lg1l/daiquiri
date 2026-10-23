import { count } from '../count';

const num = (n: number) => n.toLocaleString('en');

/** Importing tasks from CSV files, Linear, Asana and ClickUp. */
export const importer = {
  imported: (n: number) => count(n, 'Imported # task', 'Imported # tasks'),
  importTasks: (n: number) => count(n, 'Import # task', 'Import # tasks'),
  openTasks: (team: string) => `Open ${team}’s tasks`,
  importing: 'Importing',
  sources: {
    unreachable: (source: string) =>
      `Could not reach ${source}. Check your connection and the token.`,
    rejected: (source: string) => `${source} did not accept this token.`,
    httpError: (source: string, status: number) =>
      `${source} answered with an error (HTTP ${status}).`,
    queryFailed: 'the query failed',
    teams: 'Teams',
    issuesRead: (n: number) => count(n, '# issue read', '# issues read'),
    tasksRead: (n: number) => count(n, '# task read', '# tasks read'),
    commentsRead: (done: number, total: number) =>
      count(total, `Comments: ${done} of # task`, `Comments: ${done} of # tasks`),
    /** The menus in each service, so they stay as the service names them. */
    linear: {
      scope: 'Team',
      token: 'Personal API key',
      help: 'Linear → Settings → Account → Security & access → Personal API keys',
    },
    asana: {
      scope: 'Project',
      token: 'Personal access token',
      help: 'Asana → My settings → Apps → Developer apps → Personal access token',
    },
    clickup: {
      scope: 'List',
      token: 'Personal API token',
      help: 'ClickUp → Settings → Apps → API token',
    },
  },
  service: {
    unreadable: (source: string) => `${source} could not be read.`,
    importingBusy: 'Importing…',
    addingComments: 'Adding comments…',
    untitled: 'Untitled',
    andComments: (n: number) => count(n, ' and # comment', ' and # comments'),
    connecting: 'Connecting…',
    nothingToImport: (source: string) => `This ${source} account has nothing to import.`,
    tokenLabel: (source: string, token: string) => `${source} ${token.toLowerCase()}`,
    /** Around the link to the service's token settings. */
    createIn: 'Create one in',
    tokenPrivacy:
      '. It is used from your browser for this import only: never stored, never sent to Daiquiri.',
    connect: 'Connect',
    reading: 'Reading…',
    noTasks: (scope: string) => `${scope} has no tasks to import.`,
    scopeToImport: (scope: string) => `${scope} to import`,
    includeComments: 'Include comments (slower: one request per task for Asana and ClickUp)',
    readTasks: 'Read tasks',
    review: 'Review',
    summary: (n: number, scope: string) =>
      count(n, `# task from ${scope}`, `# tasks from ${scope}`),
    subtasks: (n: number) => count(n, ', # of them a sub-task', ', # of them sub-tasks'),
    withComments: (n: number) => count(n, ', with # comment', ', with # comments'),
    statuses: 'Statuses',
    completed: 'Completed',
    noStatus: 'No status',
    statusFor: (status: string) => `Status for ${status}`,
    withoutStatus: 'tasks without a status',
    teamDefault: (team: string) => `${team}’s default`,
    unassigned: (names: string, more: number) =>
      `Not members here, left unassigned: ${names}${more > 0 ? ` and ${more} more` : ''}.`,
    adminsMatch: ' (Admins also match people by email.)',
    createLabels: (n: number) => count(n, 'Create # missing label', 'Create # missing labels'),
    createProjects: (n: number, names: string) =>
      count(n, `Create # project (${names})`, `Create # projects (${names})`),
    errorKept: ' Tasks imported before the error stay.',
  },
  csv: {
    teamNotFound: 'Team not found',
    noTeam: (key: string) => `There is no team with the key ${key}.`,
    noRows: 'The file has no rows to import.',
    tooMany: (max: number) => `Import at most ${num(max)} tasks at a time; split the file.`,
    stopped: 'The import stopped.',
    errorKept: (team: string) => ` Tasks imported before the error stay in ${team}.`,
    title: (team: string) => `Import into ${team}`,
    howItWorks: 'How importing works',
    from: 'Import from',
    intro: (team: string) =>
      `Bring tasks into ${team} from a CSV file, such as a spreadsheet or an export from another tool. Columns are matched by name; check them before importing.`,
    file: 'CSV file',
    choose: 'Choose a CSV file',
    dropHint: 'or drop it here',
    columns: 'Columns',
    chooseColumn: 'Choose a column',
    skip: 'Don’t import',
    column: (n: number) => `Column ${n}`,
    preview: 'Preview',
    previewTitle: (n: number, file: string) =>
      count(n, `Preview: # task from ${file}`, `Preview: # tasks from ${file}`),
    defaultStatus: 'Default status',
    unmatchedStatus: (n: number, team: string) =>
      count(
        n,
        `# row names a status ${team} doesn’t have: they get the default status.`,
        `# rows name a status ${team} doesn’t have: they get the default status.`,
      ),
    unmatchedAssignee: (n: number) =>
      count(
        n,
        '# row names people who aren’t members: they are left unassigned.',
        '# rows name people who aren’t members: they are left unassigned.',
      ),
    unmatchedProject: (n: number, team: string) =>
      count(
        n,
        `# row names a project ${team} doesn’t have: no project is set.`,
        `# rows name a project ${team} doesn’t have: no project is set.`,
      ),
    createLabels: (n: number, names: string) =>
      count(n, `Create # missing label (${names})`, `Create # missing labels (${names})`),
    chooseTitle: 'Choose the column with the task titles.',
  },
  settings: {
    title: 'Import',
    intro:
      'Bring your work over from another tool. Imported tasks are added to the team you choose, above what is already there; nothing changes in the tool you import from, so you can try it and import again.',
    joinTeam: 'Join a team first: tasks are always imported into a team.',
    into: 'Import into',
    bringsOver: 'Brings over',
    youNeed: 'You need',
    importFrom: (name: string) => `Import from ${name}`,
    cards: {
      linear: {
        summary: 'A whole Linear team, sub-issues included.',
        brings:
          'Titles, Markdown descriptions, statuses, priorities, assignees, labels, projects, due dates, estimates, sub-issues and comments.',
        needs: 'A personal API key (Settings → Account → Security & access).',
      },
      asana: {
        summary: 'One Asana project; its sections become statuses.',
        brings:
          'Task names, notes, sections and completion, assignees, tags as labels, start and due dates, two levels of sub-tasks, and comments.',
        needs: 'A personal access token (My settings → Apps → Developer apps).',
      },
      clickup: {
        summary: 'One ClickUp list, with its sub-tasks.',
        brings:
          'Names, Markdown descriptions, statuses, priorities, assignees, tags as labels, start and due dates, time estimates or points, sub-tasks and comments.',
        needs: 'A personal API token (Settings → Apps).',
      },
      csv: {
        name: 'CSV file',
        summary: 'A spreadsheet or an export from any other tool.',
        brings:
          'Any of title, description, status, priority, assignees, labels, project, start and due dates and estimate. You match the columns before importing.',
        needs: 'A .csv file with a header row, up to 10,000 rows.',
      },
    },
    howItWorks: 'How it works',
    steps: [
      'Connect with a token, or choose a CSV file.',
      'Pick what to import and check how its statuses map to your team’s.',
      'Review the summary (people, new labels, new projects) and import.',
    ],
    goodToKnow: 'Good to know',
    tokens:
      'Tokens are used by your browser to read from the other tool during the import. They are never sent to Daiquiri’s servers and never saved.',
    notes: [
      'People are matched to members by email (when you are an admin) or by name; anyone else is left unassigned.',
      'Labels and projects that don’t exist yet can be created during the import.',
      'Comments are posted by you, starting with their original author and date, because Daiquiri cannot write as someone else.',
      'Sub-tasks deeper than three levels are attached to their nearest allowed parent.',
    ],
  },
};
