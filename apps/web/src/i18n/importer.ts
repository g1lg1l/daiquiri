import { m, provide } from '.';
import { importer } from './en/importer';

// Screens that read `m.importer` import `m` from here, so its English loads with them.
provide({ importer });

export { m };
