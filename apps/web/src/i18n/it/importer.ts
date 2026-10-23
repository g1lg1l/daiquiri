import { count } from '../count';
import type { importer as source } from '../en/importer';

const num = (n: number) => n.toLocaleString('it');

export const importer: typeof source = {
  imported: (n) => count(n, 'Importata # attività', 'Importate # attività'),
  importTasks: (n) => `Importa ${num(n)} attività`,
  openTasks: (team) => `Apri le attività di ${team}`,
  importing: 'Importazione',
  sources: {
    unreachable: (source) =>
      `Impossibile raggiungere ${source}. Controlla la connessione e il token.`,
    rejected: (source) => `${source} non ha accettato questo token.`,
    httpError: (source, status) => `${source} ha risposto con un errore (HTTP ${status}).`,
    queryFailed: 'la richiesta non è riuscita',
    teams: 'Team',
    issuesRead: (n) => count(n, '# issue letta', '# issue lette'),
    tasksRead: (n) => count(n, '# attività letta', '# attività lette'),
    commentsRead: (done, total) => `Commenti: ${done} di ${num(total)} attività`,
    linear: {
      scope: 'Team',
      token: 'Chiave API personale',
      help: 'Linear → Settings → Account → Security & access → Personal API keys',
    },
    asana: {
      scope: 'Progetto',
      token: 'Token di accesso personale',
      help: 'Asana → My settings → Apps → Developer apps → Personal access token',
    },
    clickup: {
      scope: 'Elenco',
      token: 'Token API personale',
      help: 'ClickUp → Settings → Apps → API token',
    },
  },
  service: {
    unreadable: (source) => `Impossibile leggere ${source}.`,
    importingBusy: 'Importazione…',
    addingComments: 'Aggiunta dei commenti…',
    untitled: 'Senza titolo',
    andComments: (n) => count(n, ' e # commento', ' e # commenti'),
    connecting: 'Connessione…',
    nothingToImport: (source) => `Questo account ${source} non ha niente da importare.`,
    tokenLabel: (source, token) => `${token} di ${source}`,
    createIn: 'Creane uno in',
    tokenPrivacy:
      '. Viene usato dal tuo browser solo per questa importazione: mai salvato, mai inviato a Daiquiri.',
    connect: 'Connetti',
    reading: 'Lettura…',
    noTasks: (scope) => `${scope} non ha attività da importare.`,
    scopeToImport: (scope) => `${scope} da importare`,
    includeComments:
      'Includi i commenti (più lento: una richiesta per attività con Asana e ClickUp)',
    readTasks: 'Leggi le attività',
    review: 'Riepilogo',
    summary: (n, scope) => `${num(n)} attività da ${scope}`,
    subtasks: (n) => `, di cui ${num(n)} sotto-attività`,
    withComments: (n) => count(n, ', con # commento', ', con # commenti'),
    statuses: 'Stati',
    completed: 'Completata',
    noStatus: 'Nessuno stato',
    statusFor: (status) => `Stato per ${status}`,
    withoutStatus: 'attività senza stato',
    teamDefault: (team) => `Stato predefinito di ${team}`,
    unassigned: (names, more) =>
      `Non sono membri qui, restano senza assegnatario: ${names}${more > 0 ? ` e altri ${more}` : ''}.`,
    adminsMatch: ' (Gli amministratori abbinano le persone anche per email.)',
    createLabels: (n) => count(n, 'Crea # etichetta mancante', 'Crea # etichette mancanti'),
    createProjects: (n, names) => `${count(n, 'Crea # progetto', 'Crea # progetti')} (${names})`,
    errorKept: ' Le attività importate prima dell’errore restano.',
  },
  csv: {
    teamNotFound: 'Team non trovato',
    noTeam: (key) => `Non esiste un team con la chiave ${key}.`,
    noRows: 'Il file non ha righe da importare.',
    tooMany: (max) => `Importa al massimo ${num(max)} attività alla volta; dividi il file.`,
    stopped: 'L’importazione si è interrotta.',
    errorKept: (team) => ` Le attività importate prima dell’errore restano in ${team}.`,
    title: (team) => `Importa in ${team}`,
    howItWorks: 'Come funziona l’importazione',
    from: 'Importa da',
    intro: (team) =>
      `Porta le attività in ${team} da un file CSV, come un foglio di calcolo o un’esportazione da un altro strumento. Le colonne sono abbinate per nome; controllale prima di importare.`,
    file: 'File CSV',
    choose: 'Scegli un file CSV',
    dropHint: 'oppure trascinalo qui',
    columns: 'Colonne',
    chooseColumn: 'Scegli una colonna',
    skip: 'Non importare',
    column: (n) => `Colonna ${n}`,
    preview: 'Anteprima',
    previewTitle: (n, file) => `Anteprima: ${num(n)} attività da ${file}`,
    defaultStatus: 'Stato predefinito',
    unmatchedStatus: (n, team) =>
      count(
        n,
        `# riga indica uno stato che ${team} non ha: avrà lo stato predefinito.`,
        `# righe indicano uno stato che ${team} non ha: avranno lo stato predefinito.`,
      ),
    unmatchedAssignee: (n) =>
      count(
        n,
        '# riga indica persone che non sono membri: resta senza assegnatario.',
        '# righe indicano persone che non sono membri: restano senza assegnatario.',
      ),
    unmatchedProject: (n, team) =>
      count(
        n,
        `# riga indica un progetto che ${team} non ha: nessun progetto impostato.`,
        `# righe indicano un progetto che ${team} non ha: nessun progetto impostato.`,
      ),
    createLabels: (n, names) =>
      `${count(n, 'Crea # etichetta mancante', 'Crea # etichette mancanti')} (${names})`,
    chooseTitle: 'Scegli la colonna con i titoli delle attività.',
  },
  settings: {
    title: 'Importa',
    intro:
      'Porta il tuo lavoro da un altro strumento. Le attività importate vengono aggiunte al team che scegli, sopra quelle già presenti; nello strumento di origine non cambia nulla, quindi puoi provare e importare di nuovo.',
    joinTeam: 'Prima unisciti a un team: le attività vengono sempre importate in un team.',
    into: 'Importa in',
    bringsOver: 'Cosa porta',
    youNeed: 'Cosa ti serve',
    importFrom: (name) => `Importa da ${name}`,
    cards: {
      linear: {
        summary: 'Un intero team di Linear, sotto-issue comprese.',
        brings:
          'Titoli, descrizioni in Markdown, stati, priorità, assegnatari, etichette, progetti, scadenze, stime, sotto-issue e commenti.',
        needs: 'Una chiave API personale (Settings → Account → Security & access).',
      },
      asana: {
        summary: 'Un progetto di Asana; le sue sezioni diventano stati.',
        brings:
          'Nomi delle attività, note, sezioni e completamento, assegnatari, tag come etichette, date di inizio e scadenze, due livelli di sotto-attività e commenti.',
        needs: 'Un token di accesso personale (My settings → Apps → Developer apps).',
      },
      clickup: {
        summary: 'Un elenco di ClickUp, con le sue sotto-attività.',
        brings:
          'Nomi, descrizioni in Markdown, stati, priorità, assegnatari, tag come etichette, date di inizio e scadenze, stime di tempo o punti, sotto-attività e commenti.',
        needs: 'Un token API personale (Settings → Apps).',
      },
      csv: {
        name: 'File CSV',
        summary: 'Un foglio di calcolo o un’esportazione da qualsiasi altro strumento.',
        brings:
          'Titolo, descrizione, stato, priorità, assegnatari, etichette, progetto, data di inizio, scadenza e stima, in qualsiasi combinazione. Abbini le colonne prima di importare.',
        needs: 'Un file .csv con una riga di intestazione, fino a 10.000 righe.',
      },
    },
    howItWorks: 'Come funziona',
    steps: [
      'Connettiti con un token o scegli un file CSV.',
      'Scegli cosa importare e controlla come i suoi stati corrispondono a quelli del tuo team.',
      'Controlla il riepilogo (persone, nuove etichette, nuovi progetti) e importa.',
    ],
    goodToKnow: 'Buono a sapersi',
    tokens:
      'I token vengono usati dal tuo browser per leggere dall’altro strumento durante l’importazione. Non vengono mai inviati ai server di Daiquiri né salvati.',
    notes: [
      'Le persone vengono abbinate ai membri per email (se sei amministratore) o per nome; chi non corrisponde resta senza assegnatario.',
      'Le etichette e i progetti che non esistono ancora possono essere creati durante l’importazione.',
      'I commenti vengono pubblicati da te, preceduti dall’autore e dalla data originali, perché Daiquiri non può scrivere a nome di altri.',
      'Le sotto-attività oltre il terzo livello vengono collegate al genitore consentito più vicino.',
    ],
  },
};
