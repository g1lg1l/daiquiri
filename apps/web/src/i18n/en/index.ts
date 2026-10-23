import type { auth } from './auth';
import { common } from './common';
import type { importer } from './importer';
import type { settings } from './settings';
import { shell } from './shell';
import { task } from './task';
import { tasks } from './tasks';
import type { team } from './team';

/** English, bundled with the app shell: the strings every screen can need. */
export const en = { common, shell, task, tasks };

/**
 * Every namespace, in the source language; other languages have exactly these
 * keys. `auth`, `importer`, `settings` and `team` ship with the screens that
 * use them (see `provide`), so their English is not in the initial bundle.
 */
export type Messages = typeof en & {
  auth: typeof auth;
  importer: typeof importer;
  settings: typeof settings;
  team: typeof team;
};
