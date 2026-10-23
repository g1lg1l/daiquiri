import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RichDocument } from '@daiq/domain';
import { useDaiqClient } from './context';
import { unwrap } from './errors';
import { keys } from './keys';
import { documentToJson } from './mappers';

export interface ImportRow {
  id: string;
  title: string;
  description: RichDocument | null;
  statusId: string | null;
  priority: number;
  projectId: string | null;
  dueDate: string | null;
  startDate: string | null;
  estimate: number | null;
  sortKey: string;
  assigneeIds: string[];
  labelIds: string[];
}

/** Rows per request: well under the API's 8 s statement timeout with every trigger. */
const BATCH = 500;

/**
 * Imports tasks in batches through import_tasks (one atomic call per batch,
 * as the signed-in user under RLS) and reports progress. A failing batch
 * stops the import and leaves the batches before it in place.
 */
export function useImportTasks(teamId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({
      rows,
      onProgress,
    }: {
      rows: readonly ImportRow[];
      onProgress: (done: number) => void;
    }) => {
      for (let from = 0; from < rows.length; from += BATCH) {
        const batch = rows.slice(from, from + BATCH).map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description ? documentToJson(row.description) : null,
          status_id: row.statusId,
          priority: row.priority,
          project_id: row.projectId,
          due_date: row.dueDate,
          start_date: row.startDate,
          estimate: row.estimate,
          sort_key: row.sortKey,
          assignee_ids: row.assigneeIds,
          label_ids: row.labelIds,
        }));
        // Sequential on purpose: batches land in order and a failure stops the rest.
        // oxlint-disable-next-line no-await-in-loop
        unwrap(await client.rpc('import_tasks', { team_id: teamId, rows: batch }));
        onProgress(Math.min(rows.length, from + BATCH));
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.allTasks() }),
  });
}
