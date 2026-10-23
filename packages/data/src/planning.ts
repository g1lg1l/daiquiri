import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cycle, EstimateScale, Team } from '@daiq/domain';
import { useDaiqClient } from './context';
import type { TablesUpdate } from './database.types';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';

export function useCycles(teamId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.cycles(teamId ?? ''),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<Cycle[]> =>
      unwrap(
        await client
          .from('cycles')
          .select('id, workspace_id, team_id, number, name, starts_on, ends_on, completed_at')
          .eq('team_id', teamId ?? '')
          .order('number'),
      ).map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        teamId: row.team_id,
        number: row.number,
        name: row.name,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        completedAt: row.completed_at,
      })),
  });
}

export interface CycleDay {
  day: string;
  scope: number;
  completed: number;
  scopePoints: number;
  completedPoints: number;
}

/** Burn-up rows of a cycle, one per day up to today. */
export function useCycleProgress(cycleId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.cycleProgress(cycleId ?? ''),
    enabled: Boolean(cycleId),
    queryFn: async (): Promise<CycleDay[]> =>
      unwrap(await client.rpc('cycle_progress', { cycle_id: cycleId ?? '' })).map((row) => ({
        day: row.day,
        scope: row.scope,
        completed: row.completed,
        scopePoints: row.scope_points,
        completedPoints: row.completed_points,
      })),
  });
}

export function useRenameCycle(teamId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.cycles(teamId);
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string | null }) =>
      ensureOk(await client.from('cycles').update({ name }).eq('id', id)),
    onMutate: ({ id, name }) => {
      const previous = queryClient.getQueryData<Cycle[]>(key);
      queryClient.setQueryData<Cycle[]>(key, (cycles = []) =>
        cycles.map((cycle) => (cycle.id === id ? { ...cycle, name } : cycle)),
      );
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export type TeamSettings = Partial<
  Pick<
    Team,
    | 'name'
    | 'description'
    | 'estimatesEnabled'
    | 'cyclesEnabled'
    | 'cycleWeeks'
    | 'cycleStartWeekday'
    | 'timeTrackingEnabled'
    | 'triageEnabled'
  > & { estimateScale: EstimateScale }
>;

/** Team name, description and modules (estimates, cycles). */
export function useUpdateTeam(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.teams(workspaceId);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TeamSettings }) => {
      const columns: TablesUpdate<'teams'> = {};
      if (patch.name !== undefined) columns.name = patch.name;
      if (patch.description !== undefined) columns.description = patch.description;
      if (patch.estimatesEnabled !== undefined) columns.estimates_enabled = patch.estimatesEnabled;
      if (patch.estimateScale !== undefined) columns.estimate_scale = patch.estimateScale;
      if (patch.cyclesEnabled !== undefined) columns.cycles_enabled = patch.cyclesEnabled;
      if (patch.cycleWeeks !== undefined) columns.cycle_weeks = patch.cycleWeeks;
      if (patch.cycleStartWeekday !== undefined)
        columns.cycle_start_weekday = patch.cycleStartWeekday;
      if (patch.timeTrackingEnabled !== undefined)
        columns.time_tracking_enabled = patch.timeTrackingEnabled;
      if (patch.triageEnabled !== undefined) columns.triage_enabled = patch.triageEnabled;
      return ensureOk(await client.from('teams').update(columns).eq('id', id));
    },
    onMutate: ({ id, patch }) => {
      const previous = queryClient.getQueryData<Team[]>(key);
      queryClient.setQueryData<Team[]>(key, (teams = []) =>
        teams.map((team) => (team.id === id ? { ...team, ...patch } : team)),
      );
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: (_data, _error, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        // Turning cycles on schedules them in the database.
        queryClient.invalidateQueries({ queryKey: keys.cycles(id) }),
      ]),
  });
}
