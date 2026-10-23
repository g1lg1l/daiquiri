import { m, provide } from '.';
import { settings } from './en/settings';

// Screens that read `m.settings` import `m` from here, so its English loads with them.
provide({ settings });

export { m };
