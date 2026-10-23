-- Insights (feature spec §14): time in status and cycle time for a set of tasks.
--
-- The rest of the insights layout (status mix, throughput, burn-up, overdue,
-- open work by assignee, lead time) is computed in the browser from the view's
-- loaded and filtered tasks. Status history only lives in the activity log, so
-- these two come from here. security invoker: RLS on tasks and activity
-- decides what is counted.

create function public.status_flow(task_ids uuid[])
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with picked as (
    select t.id, t.created_at, t.completed_at, s.name as status, s.category::text as category
    from public.tasks t join public.statuses s on s.id = t.status_id
    where t.id = any(task_ids) and t.deleted_at is null
  ),
  changes as (
    select a.task_id, a.created_at,
           a.data ->> 'from' as from_status,
           a.data ->> 'from_category' as from_category,
           a.data ->> 'to_category' as to_category,
           row_number() over w as n,
           lag(a.created_at) over w as previous_at
    from public.activity a join picked p on p.id = a.task_id
    where a.kind = 'task.status_changed'
    window w as (partition by a.task_id order by a.created_at, a.id)
  ),
  stays as (
    -- Each change closes the stay in its "from" status...
    select c.task_id, c.from_status as status, c.from_category as category,
           c.created_at - coalesce(c.previous_at, p.created_at) as spent
    from changes c join picked p on p.id = c.task_id
    union all
    -- ...and the current status has been held since the last change.
    select p.id, p.status, p.category,
           now() - coalesce((select max(c.created_at) from changes c where c.task_id = p.id), p.created_at)
    from picked p
  ),
  per_task as (
    select status, category, task_id, extract(epoch from sum(spent)) / 3600 as hours
    from stays
    where category in ('backlog', 'unstarted', 'started')
    group by status, category, task_id
  ),
  -- Cycle time: from first entering a started status to completion. A task
  -- created straight into a started status started when it was created.
  cycle as (
    select extract(epoch from p.completed_at - coalesce(
             min(c.created_at) filter (where c.to_category = 'started'),
             min(p.created_at) filter (where c.n = 1 and c.from_category = 'started'))) / 3600 as hours
    from picked p join changes c on c.task_id = p.id
    where p.completed_at is not null
    group by p.id, p.completed_at
  )
  select jsonb_build_object(
    'statuses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'status', status, 'category', category, 'tasks', tasks, 'median_hours', median_hours)
             order by array_position(array['backlog', 'unstarted', 'started'], category), median_hours desc)
      from (
        select status, category, count(*)::int as tasks,
               round((percentile_cont(0.5) within group (order by hours))::numeric, 1) as median_hours
        from per_task group by status, category
      ) s
    ), '[]'::jsonb),
    'cycle_time', (
      select jsonb_build_object(
               'tasks', count(*)::int,
               'median_hours', round((percentile_cont(0.5) within group (order by hours))::numeric, 1),
               'p85_hours', round((percentile_cont(0.85) within group (order by hours))::numeric, 1))
      from cycle where hours is not null
    )
  )
$$;
grant execute on function public.status_flow(uuid[]) to authenticated;

-- Demo data with a past: the seed creates everything "now", which leaves the
-- insights with a single week. Spread the demo's tasks over the last ten weeks
-- (deterministically, by title) and record the status changes that got them
-- where they are. The original seed is wrapped rather than copied.
alter function app.seed_demo_workspace(uuid, text, text, boolean) rename to seed_demo_workspace_now;

create function app.age_demo_history(p_ws uuid) returns void
language sql set search_path = '' as $$
  update public.tasks t
  set created_at = now() - make_interval(days => 3 + abs(hashtext(t.title)) % 67, hours => abs(hashtext(t.title)) % 24)
  where t.workspace_id = p_ws;

  -- Completed work finished somewhere between creation and today.
  update public.tasks t
  set completed_at = t.created_at + (now() - t.created_at) * (0.4 + (abs(hashtext(t.title)) % 50) / 100.0)
  where t.workspace_id = p_ws and t.completed_at is not null;

  update public.activity a set created_at = t.created_at
  from public.tasks t
  where a.task_id = t.id and t.workspace_id = p_ws and a.kind = 'task.created';

  -- Started and completed tasks went through the team's first unstarted and
  -- first started statuses.
  insert into public.activity (workspace_id, team_id, task_id, project_id, actor_id, kind, data, created_at)
  select t.workspace_id, t.team_id, t.id, t.project_id, t.creator_id, 'task.status_changed',
         jsonb_build_object('from', todo.name, 'to', doing.name,
                            'from_category', 'unstarted', 'to_category', 'started'),
         t.created_at + (coalesce(t.completed_at, now()) - t.created_at) * 0.3
  from public.tasks t
  join public.statuses s on s.id = t.status_id and s.category in ('started', 'completed')
  cross join lateral (select x.name from public.statuses x where x.team_id = t.team_id
                      and x.category = 'unstarted' order by x.position limit 1) todo
  cross join lateral (select x.name from public.statuses x where x.team_id = t.team_id
                      and x.category = 'started' and (s.category = 'completed' or x.id = s.id)
                      order by x.position limit 1) doing
  where t.workspace_id = p_ws;

  insert into public.activity (workspace_id, team_id, task_id, project_id, actor_id, kind, data, created_at)
  select t.workspace_id, t.team_id, t.id, t.project_id, t.creator_id, 'task.status_changed',
         jsonb_build_object('from', doing.name, 'to', s.name,
                            'from_category', 'started', 'to_category', 'completed'),
         t.completed_at
  from public.tasks t
  join public.statuses s on s.id = t.status_id and s.category = 'completed'
  cross join lateral (select x.name from public.statuses x where x.team_id = t.team_id
                      and x.category = 'started' order by x.position limit 1) doing
  where t.workspace_id = p_ws;
$$;

create function app.seed_demo_workspace(
  p_owner uuid, p_slug text, p_name text, p_is_demo boolean default true
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := app.seed_demo_workspace_now(p_owner, p_slug, p_name, p_is_demo);
begin
  perform app.age_demo_history(ws);
  return ws;
end $$;
