-- Intake forms: triage status, who manages forms, and submissions from members and strangers.
begin;
\ir _helpers.psql
select plan(15);

select tests.create_user('alice');
select tests.create_user('gina');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Intake', 't-intake', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('gina'), 'guest'::public.workspace_role from public.workspaces where slug = 't-intake';
insert into public.team_members (team_id, workspace_id, user_id)
select t.id, t.workspace_id, tests.uid('gina') from public.teams t
join public.workspaces w on w.id = t.workspace_id and w.slug = 't-intake';
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-intake';
grant select on ctx to authenticated, anon;

-- Triage ------------------------------------------------------------------------
select tests.authenticate_as('alice');
update public.teams set triage_enabled = true where id = (select team_id from ctx);
select is((select name from public.statuses where team_id = (select team_id from ctx) and category = 'triage'),
  'Triage', 'turning Triage on adds a Triage status');

-- Managing forms -----------------------------------------------------------------
insert into public.forms (workspace_id, team_id, name, is_public, ask_priority)
select workspace_id, team_id, 'Report a bug', true, true from ctx;
insert into public.forms (workspace_id, team_id, name) select workspace_id, team_id, 'Internal request' from ctx;
create temp table slugs on commit drop as
  select (select slug from public.forms where name = 'Report a bug') as public_form,
         (select slug from public.forms where name = 'Internal request') as internal_form;
grant select on slugs to authenticated, anon;
select is((select count(*)::int from public.forms), 2, 'team members create forms');

select tests.authenticate_as('gina');
select throws_ok(
  $$ insert into public.forms (workspace_id, team_id, name) select workspace_id, team_id, 'Guest form' from ctx $$,
  '42501', null, 'guests cannot create forms');

-- Strangers ------------------------------------------------------------------------
select tests.authenticate_anon();
select is(public.form_by_slug((select public_form from slugs)) ->> 'name', 'Report a bug', 'anyone can open a public form');
select is(public.form_by_slug((select internal_form from slugs)), null, 'but not a workspace-only one');
select is(
  public.submit_form((select public_form from slugs), 'Checkout is broken', E'Steps:\n\nClick pay',
                     'Customer@Example.com', 1::smallint),
  'GEN-1', 'a submission becomes a task');
select throws_ok(
  $$ select public.submit_form((select public_form from slugs), 'No email') $$,
  '23514', null, 'strangers must leave an email');
select is(public.submit_form((select public_form from slugs), 'Bot', null, 'bot@spam.test', 0::smallint, '{}', 'http://spam'),
  null, 'the honeypot swallows bot submissions');
select throws_ok(
  $$ select public.submit_form((select internal_form from slugs), 'Sneaky', null, 'x@y.test') $$,
  'P0002', null, 'strangers cannot use workspace-only forms');

select tests.clear_authentication();
select is(
  (select s.category::text || ':' || t.priority from public.tasks t join public.statuses s on s.id = t.status_id
   where t.title = 'Checkout is broken'),
  'triage:1', 'it lands in Triage with the priority asked for');
select is(
  (select data ->> 'email' from public.activity a join public.tasks t on t.id = a.task_id
   where t.title = 'Checkout is broken' and a.kind = 'task.submitted'),
  'customer@example.com', 'and the submitter''s email in its activity');
select is((select count(*)::int from public.tasks where title = 'Bot'), 0, 'bots leave nothing behind');

-- Rate limit: five submissions per client in ten minutes.
select tests.authenticate_anon();
select public.submit_form((select public_form from slugs), 'Again ' || n, null, 'customer@example.com')
from generate_series(1, 4) n;
select throws_ok(
  $$ select public.submit_form((select public_form from slugs), 'One too many', null, 'customer@example.com') $$,
  'PT429', null, 'too many submissions are refused');

-- Members ------------------------------------------------------------------------------
select tests.authenticate_as('alice');
select is(left(public.submit_form((select internal_form from slugs), 'Need a laptop'), 4), 'GEN-',
  'members use workspace-only forms, signed in');
select tests.authenticate_as('eve');
select is((select count(*)::int from public.form_submissions), 0, 'outsiders see no submissions');

select * from finish();
rollback;
