import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useDaiqClient } from './context';
import { unwrap } from './errors';
import { keys } from './keys';

const flowSchema = z.object({
  statuses: z.array(
    z.object({
      status: z.string(),
      category: z.string(),
      tasks: z.number(),
      median_hours: z.number(),
    }),
  ),
  cycle_time: z.object({
    tasks: z.number(),
    median_hours: z.number().nullable(),
    p85_hours: z.number().nullable(),
  }),
});
export type StatusFlow = z.infer<typeof flowSchema>;

/** Order-independent fingerprint of a set of ids, so the query key stays small. */
function fingerprint(ids: readonly string[]): string {
  let hash = 0;
  for (const id of ids.toSorted()) {
    for (let i = 0; i < id.length; i++) hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0;
  }
  return `${ids.length}:${(hash >>> 0).toString(36)}`;
}

/** Time in status and cycle time for these tasks, from their status history. */
export function useStatusFlow(workspaceId: string, taskIds: readonly string[]) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.statusFlow(workspaceId, fingerprint(taskIds)),
    enabled: taskIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<StatusFlow> =>
      flowSchema.parse(unwrap(await client.rpc('status_flow', { task_ids: [...taskIds] }))),
  });
}
