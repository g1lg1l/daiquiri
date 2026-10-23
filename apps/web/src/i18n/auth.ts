import { m, provide } from '.';
import { auth } from './en/auth';

// Screens that read `m.auth` import `m` from here, so its English loads with them.
provide({ auth });

export { m };
