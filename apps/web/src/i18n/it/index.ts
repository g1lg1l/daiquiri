import { localizeErrors } from '@daiq/data';
import { localizeDomain } from '@daiq/domain';
import { localizeEditor } from '@daiq/editor/strings';
import { localizeUi } from '@daiq/ui';
import type { Messages } from '../en';
import { auth } from './auth';
import { common } from './common';
import { data } from './data';
import { domain } from './domain';
import { editor } from './editor';
import { importer } from './importer';
import { settings } from './settings';
import { shell } from './shell';
import { task } from './task';
import { tasks } from './tasks';
import { team } from './team';
import { ui } from './ui';

export const it: Messages = { auth, common, importer, settings, shell, task, tasks, team };

/**
 * The shared packages keep their own words (English by default); imported
 * here, not in ../index.ts, so their label modules stay out of the first load.
 */
export function localizePackages(): void {
  localizeDomain(domain, 'it');
  localizeEditor(editor);
  localizeUi(ui, 'it');
  localizeErrors(data);
}
