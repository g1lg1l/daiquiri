-- Realtime change events: one per task for normal edits, one per team for bulk writes.
-- The team is new, so its topic only carries this test's events.
begin;
\ir _helpers.psql
select plan(6);

select tests.create_user('alice');
select tests.authenticate_as('alice');
select public.create_workspace('Events', 't-events', 'General', 'GEN');
select tests.clear_authentication();
create temp table team on commit drop as
  select t.id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-events';
grant select on team to authenticated;

-- Counted as the test owner: realtime.messages RLS only shows the topic being joined.
create function pg_temp.workspace_events(entity text) returns integer language sql as $$
  select count(*)::int from realtime.messages m
  where m.topic = 'workspace:' || (select workspace_id from team)
    and m.payload ->> 'entity' = entity
$$;
create temp table before_import on commit drop as
  select pg_temp.workspace_events('team') as team_events,
         (select updated_at from public.teams where id = (select id from team)) as updated_at;

create function pg_temp.events(entity text) returns integer language sql as $$
  select count(*)::int from realtime.messages m
  where m.topic = 'team:' || (select id from team)
    and m.payload ->> 'entity' = entity
$$;

select tests.authenticate_as('alice');
insert into public.tasks (team_id, workspace_id, title)
select id, workspace_id, 'Small ' || n from team, generate_series(1, 3) n;
select tests.clear_authentication();
select is(pg_temp.events('task'), 3, 'a small insert sends one event per task');

select tests.authenticate_as('alice');
insert into public.tasks (team_id, workspace_id, title)
select id, workspace_id, 'Imported ' || n from team, generate_series(1, 200) n;
select tests.clear_authentication();
select is(pg_temp.events('task_bulk'), 1, 'an import sends a single bulk event for the team');
select is(pg_temp.events('task'), 3, 'and no per-task events');
select is(
  pg_temp.workspace_events('team'), (select team_events from before_import),
  'bumping the task counter is not broadcast as a team change'
);
select is(
  (select updated_at from public.teams where id = (select id from team)),
  (select updated_at from before_import),
  'nor does it touch the team''s updated_at'
);

select tests.authenticate_as('alice');
update public.tasks set priority = 2 where title like 'Imported%';
select tests.clear_authentication();
select is(pg_temp.events('task_bulk'), 2, 'a bulk edit is one event too');

select * from finish();
rollback;
