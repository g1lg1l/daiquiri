-- Time tracking: one running timer per person, own entries only, visible with the task.
begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Hours', 't-hours', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-hours';
insert into public.team_members (team_id, workspace_id, user_id)
select t.id, t.workspace_id, tests.uid('bob') from public.teams t
join public.workspaces w on w.id = t.workspace_id and w.slug = 't-hours';
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-hours';
grant select on ctx to authenticated;

select tests.authenticate_as('alice');
select public.create_task(null, (select team_id from ctx), 'Write the report');
select public.create_task(null, (select team_id from ctx), 'Review the report');
create temp table ids on commit drop as
  select (select id from public.tasks where title = 'Write the report') as write,
         (select id from public.tasks where title = 'Review the report') as review;
grant select on ids to authenticated;

select public.start_timer((select write from ids));
select public.start_timer((select review from ids));
select is(
  (select array_agg(t.title || ':' || (e.ended_at is null) order by t.title)
   from public.time_entries e join public.tasks t on t.id = e.task_id),
  array['Review the report:true', 'Write the report:false'],
  'starting a timer stops the one already running');
select throws_ok(
  $$ insert into public.time_entries (workspace_id, task_id) select workspace_id, (select write from ids) from ctx $$,
  '23505', null, 'one running timer per person');
select is((select (public.stop_timer()).ended_at is not null), true, 'stopping ends it');

select lives_ok(
  $$ insert into public.time_entries (workspace_id, task_id, started_at, ended_at, note)
     select workspace_id, (select write from ids), now() - interval '2 hours', now() - interval '30 minutes', 'Draft'
     from ctx $$,
  'manual entries record a past span');
select throws_ok(
  $$ insert into public.time_entries (workspace_id, task_id, started_at, ended_at)
     select workspace_id, (select write from ids), now(), now() - interval '1 hour' from ctx $$,
  '23514', null, 'an entry cannot end before it starts');

select tests.authenticate_as('bob');
select is((select count(*)::int from public.time_entries), 3, 'the team sees everyone''s time on its tasks');
update public.time_entries set note = 'Not mine';
select is((select count(*)::int from public.time_entries where note = 'Not mine'), 0, 'but people change only their own');
select throws_ok(
  $$ insert into public.time_entries (workspace_id, task_id, user_id) select workspace_id, (select write from ids), tests.uid('alice') from ctx $$,
  '42501', null, 'and log only their own');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.time_entries), 0, 'outsiders see none');

select * from finish();
rollback;
