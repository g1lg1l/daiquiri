-- Milestones and project updates: scoped to the project's team, consistent with tasks, authored honestly.
begin;
\ir _helpers.psql
select plan(15);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Projects', 't-projects', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-projects';
create temp table gen on commit drop as
  select t.id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-projects';
grant select on gen to authenticated;

select tests.authenticate_as('alice');
insert into public.projects (workspace_id, team_id, name) select workspace_id, id, 'Launch' from gen;
insert into public.projects (workspace_id, team_id, name) select workspace_id, id, 'Docs' from gen;

-- Milestones -----------------------------------------------------------------
insert into public.milestones (project_id, name, target_date)
select id, 'Beta', current_date + 14 from public.projects where name = 'Launch';
select is(
  (select m.team_id from public.milestones m where m.name = 'Beta'), (select id from gen),
  'a milestone takes its team from the project');

select tests.authenticate_as('bob');
select lives_ok(
  $$ insert into public.milestones (project_id, name) select id, 'GA' from public.projects where name = 'Launch' $$,
  'workspace members add milestones to visible projects');
insert into public.milestones (project_id, team_id, workspace_id, name)
select id, gen_random_uuid(), gen_random_uuid(), 'Forged' from public.projects where name = 'Launch';
select is(
  (select m.team_id from public.milestones m where m.name = 'Forged'), (select id from gen),
  'a team_id sent by the client is replaced by the project''s');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.milestones), 0, 'outsiders see no milestones');

-- Tasks and milestones stay consistent.
select tests.authenticate_as('alice');
insert into public.tasks (team_id, workspace_id, title, project_id, milestone_id)
select gen.id, gen.workspace_id, 'Beta task', p.id, (select m.id from public.milestones m where m.name = 'Beta')
from gen, public.projects p where p.name = 'Launch';
select is(
  (select m.name from public.tasks t join public.milestones m on m.id = t.milestone_id where t.title = 'Beta task'),
  'Beta', 'a task joins a milestone of its project');
select throws_ok(
  $$ insert into public.tasks (team_id, workspace_id, title, project_id, milestone_id)
     select gen.id, gen.workspace_id, 'Wrong project', p.id, (select m.id from public.milestones m where m.name = 'Beta')
     from gen, public.projects p where p.name = 'Docs' $$,
  '23503', null, 'but not a milestone of another project');
select throws_ok(
  $$ insert into public.tasks (team_id, workspace_id, title, milestone_id)
     select gen.id, gen.workspace_id, 'No project', (select m.id from public.milestones m where m.name = 'Beta') from gen $$,
  '23514', null, 'nor a milestone without a project');

update public.tasks set project_id = (select id from public.projects where name = 'Docs') where title = 'Beta task';
select is((select milestone_id from public.tasks where title = 'Beta task'), null,
  'moving a task to another project drops its milestone');

update public.tasks set project_id = (select id from public.projects where name = 'Launch'),
  milestone_id = (select id from public.milestones where name = 'Beta') where title = 'Beta task';
delete from public.milestones where name = 'Beta';
select is((select milestone_id from public.tasks where title = 'Beta task'), null,
  'deleting a milestone keeps its tasks');

-- Project updates --------------------------------------------------------------
insert into public.project_updates (project_id, health, body)
select id, 'at_risk', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Slipping"}]}]}'
from public.projects where name = 'Launch';
select is((select author_id from public.project_updates), tests.uid('alice'), 'the author is always the caller');
select throws_ok(
  $$ insert into public.project_updates (project_id, health) select id, 'great' from public.projects where name = 'Launch' $$,
  '23514', null, 'health is one of on_track, at_risk, off_track');

select tests.authenticate_as('bob');
update public.project_updates set health = 'on_track';
select is((select health from public.project_updates), 'at_risk', 'only the author edits an update');
insert into public.project_updates (project_id, health) select id, 'on_track' from public.projects where name = 'Launch';
select is(
  (select health from public.project_latest_updates
   where project_id = (select id from public.projects where name = 'Launch')),
  'on_track', 'the latest update view shows the newest update');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.project_updates), 0, 'outsiders see no updates');
select is((select count(*)::int from public.project_latest_updates), 0, 'nor through the view');

select * from finish();
rollback;
