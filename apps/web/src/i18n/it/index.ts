import type { Messages } from '../en';
import { auth } from './auth';
import { common } from './common';
import { importer } from './importer';
import { settings } from './settings';
import { shell } from './shell';
import { task } from './task';
import { tasks } from './tasks';
import { team } from './team';

export const it: Messages = { auth, common, importer, settings, shell, task, tasks, team };
