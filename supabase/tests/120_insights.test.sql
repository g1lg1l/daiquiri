-- Insights: time in status and cycle time from the activity log, within RLS.
begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('alice');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Flow', 't-flow', 'General', 'GEN');
insert into public.tasks (team_id, workspace_id, title)
select t.id, t.workspace_id, x.title from public.teams t
join public.workspaces w on w.id = t.workspace_id and w.slug = 't-flow',
(values ('Shipped'), ('Waiting')) as x(title);
select tests.clear_authentication();

-- History, written directly: within one transaction now() never moves.
-- Shipped: Todo for 4 days, In Progress for 4 days, Done 2 days ago.
-- Waiting: in Todo since it was created 10 days ago.
create temp table ids on commit drop as
  select (select id from public.tasks where title = 'Shipped') as shipped,
         (select id from public.tasks where title = 'Waiting') as waiting;
grant select on ids to authenticated;
set local session_replication_role = replica;
update public.tasks t set created_at = now() - interval '10 days',
  status_id = (select s.id from public.statuses s where s.team_id = t.team_id and s.name = 'Todo')
where t.id in (select shipped from ids union all select waiting from ids);
update public.tasks t set completed_at = now() - interval '2 days',
  status_id = (select s.id from public.statuses s where s.team_id = t.team_id and s.name = 'Done')
where t.id = (select shipped from ids);
delete from public.activity where task_id in (select shipped from ids union all select waiting from ids);
insert into public.activity (workspace_id, team_id, task_id, kind, data, created_at)
select t.workspace_id, t.team_id, t.id, 'task.status_changed', x.data::jsonb, now() - x.ago
from public.tasks t, (values
  ('{"from": "Todo", "to": "In Progress", "from_category": "unstarted", "to_category": "started"}', interval '6 days'),
  ('{"from": "In Progress", "to": "Done", "from_category": "started", "to_category": "completed"}', interval '2 days')
) as x(data, ago)
where t.id = (select shipped from ids);
set local session_replication_role = origin;

select tests.authenticate_as('alice');
create temp table flow on commit drop as
  select public.status_flow(array[(select shipped from ids), (select waiting from ids)]) as f;
select is(
  (select jsonb_agg(s -> 'status') from flow, jsonb_array_elements(f -> 'statuses') s),
  '["Todo", "In Progress"]'::jsonb, 'open statuses come in workflow order, done ones are left out');
select is(
  (select (s ->> 'median_hours')::numeric from flow, jsonb_array_elements(f -> 'statuses') s where s ->> 'status' = 'Todo'),
  168.0, 'time in status is the median over the tasks that were there (4 and 10 days)');
select is((select (f -> 'cycle_time' ->> 'median_hours')::numeric from flow), 96.0,
  'cycle time runs from first started to completed');
select is((select (f -> 'cycle_time' ->> 'tasks')::int from flow), 1, 'only completed tasks have a cycle time');

select tests.authenticate_as('eve');
select is(
  public.status_flow(array[(select shipped from ids), (select waiting from ids)]) -> 'statuses',
  '[]'::jsonb, 'outsiders get nothing for tasks they cannot see');

-- Demo workspaces come with weeks of history for the insights to show.
select tests.clear_authentication();
create temp table demo on commit drop as
  select app.seed_demo_workspace(tests.uid('alice'), 't-flow-demo', 'Demo history', false) as id;
grant select on demo to authenticated;
select tests.authenticate_as('alice');
select ok(
  (select max(created_at) - min(created_at) > interval '30 days' from public.tasks
   where workspace_id = (select id from demo)),
  'demo tasks are spread over several weeks');
select ok(
  (select (public.status_flow(array_agg(id)) -> 'cycle_time' ->> 'tasks')::int > 0 from public.tasks
   where workspace_id = (select id from demo)),
  'and their completed work has a cycle time');

select * from finish();
rollback;
