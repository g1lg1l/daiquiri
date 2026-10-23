import { auth } from './auth';
import { common } from './common';
import { importer } from './importer';
import { settings } from './settings';
import { shell } from './shell';
import { task } from './task';
import { tasks } from './tasks';
import { team } from './team';

/** English, the source language: every other language has exactly these keys. */
export const en = { auth, common, importer, settings, shell, task, tasks, team };
export type Messages = typeof en;
