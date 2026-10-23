import { m, provide } from '.';
import { team } from './en/team';

// Screens that read `m.team` import `m` from here, so its English loads with them.
provide({ team });

export { m };
