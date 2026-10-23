-- Templates: save a task or a project, use it later with dates moved, within RLS.
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('gina');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Templates', 't-tpl', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-tpl'
union all
select id, tests.uid('gina'), 'guest'::public.workspace_role from public.workspaces where slug = 't-tpl';
insert into public.team_members (team_id, workspace_id, user_id)
select t.id, t.workspace_id, u.id from public.teams t
join public.workspaces w on w.id = t.workspace_id and w.slug = 't-tpl',
(values (tests.uid('bob')), (tests.uid('gina'))) as u(id);
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-tpl';
grant select on ctx to authenticated;

-- A task with sub-tasks ------------------------------------------------------------
select tests.authenticate_as('alice');
insert into public.labels (workspace_id, name, color) select workspace_id, 'Customer', 'green' from ctx;
create temp table src on commit drop as
  select (public.create_task(null, (select team_id from ctx), 'Onboard a customer', priority => 2::smallint,
            due_date => current_date + 5, assignee_ids => array[tests.uid('bob')],
            label_ids => array(select id from public.labels where name = 'Customer'))).id;
grant select on src to authenticated;
select public.create_task(null, (select team_id from ctx), 'Send the welcome pack', parent_id => (select id from src));
select public.create_task(null, (select team_id from ctx), 'Kickoff call', parent_id => (select id from src));

select tests.authenticate_as('bob');
select public.save_task_template((select id from src), 'Onboarding');
select is(
  (select jsonb_array_length(payload -> 'subtasks') from public.templates where name = 'Onboarding'), 2,
  'saving a task keeps its sub-tasks');
select is((select (payload ->> 'due_offset')::int from public.templates where name = 'Onboarding'), 5,
  'and its dates as offsets');

select tests.authenticate_as('gina');
select throws_ok($$ select public.save_task_template((select id from src), 'Guest copy') $$,
  '42501', null, 'guests cannot save templates');
select is((select count(*)::int from public.templates), 1, 'but can see the team''s templates');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.templates), 0, 'outsiders see none');
select throws_ok(
  $$ select public.create_task_from_template((select id from public.templates limit 1)) $$,
  'P0002', null, 'nor can they use one');

select tests.authenticate_as('bob');
create temp table made on commit drop as
  select (public.create_task_from_template((select id from public.templates where name = 'Onboarding'))).*;
grant select on made to authenticated;
select is((select array[due_date - current_date, priority] from made), array[5, 2],
  'a task from a template gets its fields, with dates from today');
select ok(
  exists (select 1 from public.task_assignees a join made on made.id = a.task_id where a.user_id = tests.uid('bob'))
  and exists (select 1 from public.task_labels l join made on made.id = l.task_id),
  'its assignees and labels');
select is(
  (select array_agg(title order by sort_key) from public.tasks where parent_id = (select id from made)),
  (select array_agg(title order by sort_key) from public.tasks where parent_id = (select id from src)),
  'and its sub-tasks, in the same order');

-- Who manages a template.
select tests.authenticate_as('gina');
delete from public.templates;
select is((select count(*)::int from public.templates), 1, 'guests cannot delete templates');
select tests.authenticate_as('alice');
update public.templates set name = 'Customer onboarding';
select is((select name from public.templates), 'Customer onboarding', 'admins can rename any template');

-- A project with milestones ---------------------------------------------------------
insert into public.projects (workspace_id, team_id, name, start_date)
select workspace_id, team_id, 'Launch', current_date from ctx;
insert into public.milestones (project_id, name, target_date)
select id, 'Beta', current_date + 10 from public.projects where name = 'Launch';
select public.create_task(null, (select team_id from ctx), 'Write the docs',
  project_id => (select id from public.projects where name = 'Launch'), due_date => current_date + 7);
update public.tasks set milestone_id = (select id from public.milestones where name = 'Beta')
where title = 'Write the docs';
select public.save_project_template((select id from public.projects where name = 'Launch'), 'Launch plan');

create temp table launch on commit drop as
  select (public.create_project_from_template(
    (select id from public.templates where name = 'Launch plan'), 'Launch 2', current_date + 30)).*;
grant select on launch to authenticated;
select is(
  (select target_date - current_date from public.milestones where project_id = (select id from launch)), 40,
  'a project from a template gets its milestones, moved to the new start');
select is(
  (select t.due_date - current_date from public.tasks t where t.project_id = (select id from launch)), 37,
  'and its tasks');
select ok(
  (select t.milestone_id = m.id from public.tasks t join public.milestones m on m.project_id = t.project_id
   where t.project_id = (select id from launch)),
  'in the new project''s milestones');

select * from finish();
rollback;
