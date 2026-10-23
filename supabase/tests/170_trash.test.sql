-- Trash: deleted tasks are listed for the team, restorable, and purged only by admins.
begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Bin', 't-bin', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-bin';
insert into public.team_members (team_id, workspace_id, user_id)
select t.id, t.workspace_id, tests.uid('bob') from public.teams t
join public.workspaces w on w.id = t.workspace_id and w.slug = 't-bin';
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-bin';
grant select on ctx to authenticated;

select tests.authenticate_as('bob');
select public.create_task(null, (select team_id from ctx), 'Old plan');
select public.create_task(null, (select team_id from ctx), 'Step one',
  parent_id => (select id from public.tasks where title = 'Old plan'));
select public.create_task(null, (select team_id from ctx), 'Draft');
create temp table ids on commit drop as
  select (select id from public.tasks where title = 'Old plan') as plan,
         (select id from public.tasks where title = 'Draft') as draft;
grant select on ids to authenticated;
select public.delete_tasks(array[(select plan from ids)]);
select public.delete_tasks(array[(select draft from ids)]);

select is(
  (select array_agg(title || ':' || subtasks order by title) from public.trashed_tasks((select workspace_id from ctx))),
  array['Draft:0', 'Old plan:1'], 'the trash lists deleted tasks, with the sub-tasks deleted alongside');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.trashed_tasks((select workspace_id from ctx))), 0,
  'outsiders see an empty trash');

select tests.authenticate_as('bob');
select is(public.restore_tasks(array[(select plan from ids)]), 2, 'restoring brings the sub-task back too');
select throws_ok($$ select public.purge_tasks(array[(select draft from ids)]) $$,
  '42501', null, 'members cannot delete for good');

select tests.authenticate_as('alice');
select throws_ok($$ select public.purge_tasks(array[(select plan from ids)]) $$,
  '42501', null, 'only tasks in the trash can be deleted for good');
select is(public.purge_tasks(array[(select draft from ids)]), 1, 'admins delete trashed tasks for good');
select tests.clear_authentication();
select is((select count(*)::int from public.tasks where id = (select draft from ids)), 0, 'and they are gone');

select * from finish();
rollback;
