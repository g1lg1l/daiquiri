-- Notification levels per team: All, Participating, Mute.
begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Quiet', 't-quiet', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-quiet';
insert into public.team_members (team_id, workspace_id, user_id)
select t.id, t.workspace_id, tests.uid('bob') from public.teams t
join public.workspaces w on w.id = t.workspace_id and w.slug = 't-quiet';
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-quiet';
grant select on ctx to authenticated;

select tests.authenticate_as('alice');
select public.create_task(null, (select team_id from ctx), 'Followed task');
create temp table task on commit drop as select id from public.tasks where title = 'Followed task';
grant select on task to authenticated;
select tests.authenticate_as('bob');
insert into public.task_subscribers (task_id, workspace_id, user_id)
select id, (select workspace_id from ctx), tests.uid('bob') from task;

create function pg_temp.comment(body text) returns void language sql as $$
  insert into public.comments (workspace_id, task_id, body)
  select (select workspace_id from ctx), (select id from task),
         jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object(
           'type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', body)))))
$$;
create function pg_temp.bob_has(kind text) returns integer language sql as $$
  select count(*)::int from public.notifications where user_id = tests.uid('bob') and kind = $1
$$;

-- Mute: nothing from the team.
select tests.authenticate_as('bob');
insert into public.notification_settings (workspace_id, team_id, level) select workspace_id, team_id, 'mute' from ctx;
select tests.authenticate_as('alice');
select pg_temp.comment('Muted?');
select tests.clear_authentication();
select is(pg_temp.bob_has('comment'), 0, 'muted teams send nothing');

-- Participating: only what concerns you.
select tests.authenticate_as('bob');
update public.notification_settings set level = 'participating';
select tests.authenticate_as('alice');
select pg_temp.comment('Participating?');
select tests.clear_authentication();
select is(pg_temp.bob_has('comment'), 0, 'participating skips comments on tasks you only follow');
delete from public.notifications where user_id = tests.uid('bob');
select tests.authenticate_as('alice');
insert into public.task_assignees (task_id, workspace_id, user_id) select id, (select workspace_id from ctx), tests.uid('bob') from task;
select tests.clear_authentication();
select is(pg_temp.bob_has('assigned'), 1, 'but tells you when you are assigned');
delete from public.notifications where user_id = tests.uid('bob');
select tests.authenticate_as('alice');
select pg_temp.comment('Now?');
select tests.clear_authentication();
select is(pg_temp.bob_has('comment'), 1, 'and about activity on your own tasks');

-- All (the default) again.
select tests.authenticate_as('bob');
delete from public.notification_settings;
select tests.clear_authentication();
delete from public.task_assignees where user_id = tests.uid('bob');
delete from public.notifications where user_id = tests.uid('bob');
select tests.authenticate_as('alice');
select pg_temp.comment('Everything');
select tests.clear_authentication();
select is(pg_temp.bob_has('comment'), 1, 'everything else follows subscriptions');

-- Settings are private.
select tests.authenticate_as('bob');
insert into public.notification_settings (workspace_id, team_id, level) select workspace_id, team_id, 'mute' from ctx;
select tests.authenticate_as('alice');
select is((select count(*)::int from public.notification_settings), 0, 'nobody sees another person''s settings');
select throws_ok(
  $$ insert into public.notification_settings (user_id, workspace_id, team_id, level)
     select tests.uid('bob'), workspace_id, team_id, 'all' from ctx $$,
  '42501', null, 'nor writes them');
select tests.authenticate_as('eve');
select throws_ok(
  $$ insert into public.notification_settings (workspace_id, team_id, level) select workspace_id, team_id, 'all' from ctx $$,
  '42501', null, 'and only teams you can see have settings');

select * from finish();
rollback;
