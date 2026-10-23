import { count } from '../count';
import type { settings as source } from '../en/settings';

export const settings: typeof source = {
  title: 'Impostazioni',
  sections: {
    general: 'Generali',
    members: 'Membri',
    teams: 'Team',
    labels: 'Etichette',
    fields: 'Campi',
    templates: 'Modelli',
    import: 'Importazione',
    webhooks: 'Webhook',
    trash: 'Cestino',
    preferences: 'Preferenze',
  },
  adminsOnly: 'Alcune impostazioni sono disponibili solo per gli amministratori.',
  name: 'Nome',
  deleteNamed: (name) => `Elimina ${name}`,
  deleteTitle: (name) => `Eliminare ${name}?`,
  general: {
    intro: 'Il nome dello spazio di lavoro compare nella barra laterale e negli inviti.',
    renamed: 'Spazio di lavoro rinominato',
    name: 'Nome dello spazio di lavoro',
    address: 'Indirizzo web',
  },
  members: {
    intro:
      'I membri vedono tutti i team pubblici. Gli ospiti vedono solo i team a cui sono stati aggiunti.',
    roles: { owner: 'Proprietario', admin: 'Amministratore', member: 'Membro', guest: 'Ospite' },
    inviteByEmail: 'Invita via email',
    emailPlaceholder: 'nome@azienda.it',
    role: 'Ruolo',
    createInvitation: 'Crea invito',
    shareLink:
      'Condividi questo link. Funziona una sola volta, per quell’indirizzo email, per 7 giorni.',
    invitationLink: 'Link di invito',
    linkCopied: 'Link di invito copiato',
    copyManually: 'Copia il link manualmente.',
    you: '(tu)',
    joined: (ago) => `Iscrizione: ${ago}`,
    roleOf: (name) => `Ruolo di ${name}`,
    leave: 'Esci',
    pending: 'Inviti in sospeso',
    expires: (when) => `scade ${when}`,
    revoke: 'Revoca',
  },
  teams: {
    intro:
      'Ogni team ha il suo flusso di lavoro e la sua numerazione delle attività. I team privati sono visibili solo ai loro membri.',
    newTeam: 'Nuovo team',
    namePlaceholder: 'Design',
    private: 'Privato',
    keyTaken: (key) => `La chiave ${key} è già in uso. Prova un altro nome.`,
    privateTeam: 'Team privato',
    teamSettings: (name) => `Impostazioni di ${name}`,
    members: (n) => count(n, '# membro', '# membri'),
    leave: 'Esci',
    join: 'Unisciti',
  },
  team: {
    notFound: 'Team non trovato',
    notFoundMessage: (key) => `Non esiste un team con la chiave ${key}, oppure è privato.`,
    readOnly: (name) =>
      `Solo gli amministratori e i membri di ${name} possono modificare queste impostazioni.`,
    description: 'Descrizione',
    modules: 'Moduli',
    estimates: {
      title: 'Stime',
      description:
        'Dimensiona le attività in story point o in ore. Visibili su attività, elenchi, bacheche e cicli.',
      scale: 'Scala',
      points: 'Story point (1, 2, 3, 5, 8, 13)',
      hours: 'Ore',
    },
    cycles: {
      title: 'Cicli',
      description:
        'Pianifica il lavoro in periodi fissi. Daiquiri tiene pronti i tre cicli successivi e, quando un ciclo finisce, sposta le attività non completate nel successivo.',
      length: 'Durata',
      weeks: (n) => count(n, '# settimana', '# settimane'),
      startsOn: 'Inizia il',
      note: 'Le modifiche valgono per i cicli pianificati da ora in poi.',
    },
    triage: {
      title: 'Smistamento',
      description:
        'Le nuove richieste, da persone esterne al team o dai moduli, arrivano prima nello stato di smistamento, così qualcuno decide dove vanno.',
      note: 'Lo smistamento compare per primo nell’elenco del team. Disattivarlo mantiene lo stato e le sue attività.',
    },
    timeTracking: {
      title: 'Tempo',
      description:
        'Registra il tempo sulle attività con un timer o a mano. Tutti nel team vedono il tempo registrato.',
      note: 'Ognuno può avere un solo timer attivo alla volta; avviarne un altro ferma quello in corso.',
    },
    automations: {
      title: 'Automazioni',
      description:
        'Assegna, etichetta, ripianifica o notifica automaticamente quando le attività cambiano.',
      manage: 'Gestisci automazioni',
    },
    forms: {
      title: 'Moduli',
      description:
        'Raccogli richieste tramite un link, dai membri o da chiunque, direttamente nello smistamento.',
      manage: 'Gestisci moduli',
    },
    import: {
      title: 'Importa attività',
      description: 'Direttamente da Linear, Asana o ClickUp, oppure da un file CSV.',
    },
    fields: {
      title: 'Campi personalizzati',
      intro:
        'Attiva i campi dello spazio di lavoro che usa questo team, fino a 12. Gli amministratori li definiscono in',
      empty: 'Lo spazio di lavoro non ha ancora campi personalizzati.',
    },
  },
  labels: {
    intro:
      'Le etichette sono condivise da tutti i team. Chiunque può crearle; gli amministratori possono rinominarle o eliminarle.',
    newLabel: 'Nuova etichetta',
    namePlaceholder: 'Bug',
    colour: 'Colore',
    colourOf: (name) => `Colore di ${name}`,
    nameOf: (name) => `Nome di ${name}`,
    adminsCanEdit: 'Modificabile dagli amministratori',
    colours: {
      gray: 'grigio',
      red: 'rosso',
      orange: 'arancione',
      amber: 'ambra',
      lime: 'lime',
      green: 'verde',
      teal: 'verde acqua',
      blue: 'blu',
      indigo: 'indaco',
      violet: 'viola',
      pink: 'rosa',
    },
  },
  fields: {
    title: 'Campi personalizzati',
    intro:
      'I campi sono condivisi nello spazio di lavoro. Ogni team attiva quelli che gli servono (fino a 12) nelle sue impostazioni.',
    needOption: 'Aggiungi almeno un’opzione, una per riga.',
    newField: 'Nuovo campo',
    namePlaceholder: 'Gravità',
    type: 'Tipo',
    add: 'Aggiungi campo',
    options: 'Opzioni, una per riga',
    optionsPlaceholder: 'Minore\nMaggiore\nCritica',
    adminsOnly: 'Solo gli amministratori possono aggiungere o modificare i campi.',
    empty: 'Ancora nessun campo personalizzato.',
    usedBy: (teams) => `Usato da ${teams}`,
    unused: 'Non usato da nessun team',
    editTitle: (name) => `Modifica ${name}`,
    removeOptionNote: 'Rimuovere un’opzione la cancella dalle attività che la usano.',
    deleteDescription:
      'I suoi valori vengono rimossi da tutte le attività, in tutti i team. L’operazione non si può annullare.',
    deleteConfirm: 'Elimina campo',
  },
  templates: {
    intro:
      'Salva un’attività o un progetto come modello dal suo menu. Usa i modelli di attività dalla finestra di nuova attività e i modelli di progetto quando crei un progetto.',
    empty: 'Ancora nessun modello. Apri un’attività o un progetto e scegli Salva come modello.',
    task: 'Attività',
    taskWith: (subtasks) =>
      `Attività con ${count(subtasks, '# sotto-attività', '# sotto-attività')}`,
    project: (milestones, tasks) =>
      `Progetto con ${count(milestones, '# traguardo', '# traguardi')} e ${count(tasks, '# attività', '# attività')}`,
    savedBy: (name) => `, salvato da ${name}`,
    formerMember: 'un ex membro',
    renameTitle: 'Rinomina modello',
    deleteDescription: 'Le attività e i progetti già creati da questo modello restano come sono.',
    deleteConfirm: 'Elimina modello',
  },
  trash: {
    intro: (days) =>
      `Le attività eliminate restano qui per ${days} giorni, poi vengono eliminate definitivamente. Ripristinando un’attività tornano anche le sotto-attività eliminate con lei.`,
    empty: 'Il cestino è vuoto.',
    deleted: (ago, subtasks, daysLeft) =>
      `Eliminata ${ago}${subtasks > 0 ? `, con ${count(subtasks, '# sotto-attività', '# sotto-attività')}` : ''}. ${count(daysLeft, '# giorno rimasto', '# giorni rimasti')}.`,
    restored: (identifier) => `${identifier} ripristinata`,
    deleteForever: 'Elimina definitivamente',
    purgeTitle: (title) => `Eliminare definitivamente ${title}?`,
    purgeDescription:
      'L’attività, le sue sotto-attività, i commenti e la cronologia vengono eliminati. L’operazione non si può annullare.',
  },
  webhooks: {
    intro:
      'Daiquiri invia un JSON al tuo endpoint quando attività o commenti cambiano, in tutti i team. Le consegne non riuscite vengono ritentate sei volte, aspettando sempre di più.',
    signature: 'Verificare la firma',
    signatureHelp: (code) => [
      'Ogni richiesta ha un’intestazione ',
      code('Daiquiri-Signature: t=…,v1=…'),
      '. Calcola l’HMAC-SHA256 di ',
      code('t + "." + corpo grezzo'),
      ' con il tuo segreto e confrontalo con ',
      code('v1'),
      '; rifiuta le richieste il cui ',
      code('t'),
      ' risale a più di cinque minuti fa.',
    ],
    adminsOnly: 'Solo gli amministratori gestiscono i webhook.',
    demo: 'Nella demo i webhook sono disattivati, così non può inviare richieste ad altri siti.',
    badUrl: 'Usa un indirizzo https con un nome host pubblico, sulla porta standard (443).',
    namePlaceholder: 'Bot di deploy',
    endpoint: 'URL dell’endpoint',
    events: 'Eventi',
    add: 'Aggiungi webhook',
    sendTo: (name) => `Invia a ${name}`,
    sendTest: 'Invia test',
    testQueued: 'Test in coda',
    deliveries: 'Consegne',
    deliveriesTo: (name) => `Consegne a ${name}`,
    newSecret: 'Nuovo segreto',
    secretTitle: 'Segreto di firma',
    secretDescription:
      'Copialo ora: viene mostrato una sola volta. Il tuo endpoint lo usa per verificare che le richieste arrivino da Daiquiri.',
    secretCopied: 'Segreto copiato',
    noDeliveries: 'Ancora nessuna consegna. Invia un test per provarlo.',
    delivered: 'Consegnato',
    failed: 'Non riuscito',
    waiting: 'In attesa',
    status: {
      delivered: (code) => `consegnato (HTTP ${code})`,
      gaveUp: (attempts) => `abbandonato dopo ${attempts} tentativi`,
      retrying: (attempt) => `nuovo tentativo (${attempt} di 6)`,
      queued: 'in coda',
    },
    deleteDescription:
      'Le consegne si fermano, il registro e il segreto vengono eliminati e le automazioni che lo chiamano non riescono.',
    deleteConfirm: 'Elimina webhook',
  },
  preferences: {
    profile: 'Profilo',
    displayName: 'Nome visualizzato',
    nameUpdated: 'Nome aggiornato',
    appearance: 'Aspetto',
    theme: 'Tema',
    themes: { system: 'Sistema', light: 'Chiaro', dark: 'Scuro' },
    language: 'Lingua',
    languageHint: 'Cambiare lingua ricarica la pagina.',
    notifications: 'Notifiche',
    notificationsIntro:
      'Scegli cosa arriva nella tua Posta in arrivo da ogni team. “Solo ciò che mi riguarda” mantiene assegnazioni, menzioni e aggiornamenti delle attività che hai creato o che ti sono assegnate.',
    levels: {
      all: 'Tutti gli aggiornamenti',
      participating: 'Solo ciò che mi riguarda',
      mute: 'Niente',
    },
    keyboard: 'Tastiera',
    shortcuts: 'Scorciatoie a tasto singolo',
    shortcutsHint:
      'Disattivale se usi l’input vocale o dispositivi switch. Le scorciatoie con ⌘/Ctrl funzionano sempre.',
  },
};
