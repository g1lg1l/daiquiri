-- Automations: who manages them, what they may refer to, and the runner.
begin;
\ir _helpers.psql
select plan(18);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('gina');
select tests.create_user('eve');

select tests.authenticate_as('eve');
select public.create_workspace('Elsewhere', 't-auto-eve', 'General', 'EVE');
insert into public.labels (workspace_id, name, color)
select id, 'Foreign', 'red' from public.workspaces where slug = 't-auto-eve';

select tests.authenticate_as('alice');
select public.create_workspace('Automate', 't-auto', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-auto'
union all
select id, tests.uid('gina'), 'guest'::public.workspace_role from public.workspaces where slug = 't-auto';
insert into public.team_members (team_id, workspace_id, user_id)
select t.id, t.workspace_id, u.id from public.teams t
join public.workspaces w on w.id = t.workspace_id and w.slug = 't-auto',
(values (tests.uid('bob')), (tests.uid('gina'))) as u(id);
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id,
         (select s.id from public.statuses s where s.team_id = t.id and s.name = 'In Progress') as doing
  from public.teams t join public.workspaces w on w.id = t.workspace_id where w.slug = 't-auto';
grant select on ctx to authenticated;

select tests.authenticate_as('alice');
insert into public.labels (workspace_id, name, color) select workspace_id, 'Bug', 'red' from ctx;
create temp table labels on commit drop as
  select (select id from public.labels where name = 'Bug') as bug,
         (select id from public.labels where name = 'Foreign') as foreign_label;
grant select on labels to authenticated;

-- Who manages automations, and what they may refer to ------------------------------
select tests.authenticate_as('gina');
select throws_ok(
  $$ insert into public.automations (workspace_id, team_id, name, trigger, actions)
     select workspace_id, team_id, 'Guest rule', '{"kind": "task_created"}', '[{"kind": "unassign"}]' from ctx $$,
  '42501', null, 'guests cannot create automations');

select tests.authenticate_as('bob');
select throws_ok(
  $$ insert into public.automations (workspace_id, team_id, name, trigger, actions)
     select workspace_id, team_id, 'Sneaky', '{"kind": "task_created"}',
            jsonb_build_array(jsonb_build_object('kind', 'add_label', 'label_id', (select foreign_label from labels)))
     from ctx $$,
  '23514', null, 'actions cannot refer to another workspace''s labels');

-- Urgent new tasks get the Bug label and go to Bob.
insert into public.automations (workspace_id, team_id, name, trigger, conditions, actions)
select workspace_id, team_id, 'Triage urgent', '{"kind": "task_created"}', '{"priorities": [1]}',
       jsonb_build_array(jsonb_build_object('kind', 'add_label', 'label_id', (select bug from labels)),
                         jsonb_build_object('kind', 'assign', 'user_id', tests.uid('bob')))
from ctx;
-- Starting work raises the priority: a chain from the next rule.
insert into public.automations (workspace_id, team_id, name, trigger, actions)
select workspace_id, team_id, 'Started is high', '{"kind": "status_changed", "category": "started"}',
       '[{"kind": "set_priority", "priority": 2}]'
from ctx;
select is((select count(*)::int from public.automations), 2, 'team members create automations');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.automations), 0, 'outsiders see none');

-- Events and runs ---------------------------------------------------------------------
select tests.authenticate_as('alice');
select public.create_task(null, (select team_id from ctx), 'Checkout is down', priority => 1::smallint);
select public.create_task(null, (select team_id from ctx), 'Polish the footer', priority => 4::smallint);
select throws_ok($$ select count(*) from public.automation_events $$, '42501', null, 'clients cannot read the queue');
select tests.clear_authentication();
select is((select count(*)::int from public.automation_events where kind = 'task_created'), 2,
  'creating tasks queues events for teams with automations');

delete from public.automation_events where team_id <> (select team_id from ctx);
select is(app.run_automations(), 1, 'only the task matching the conditions runs');
select ok(
  exists (select 1 from public.task_labels l join public.tasks t on t.id = l.task_id
          where t.title = 'Checkout is down' and l.label_id = (select bug from labels))
  and exists (select 1 from public.task_assignees a join public.tasks t on t.id = a.task_id
              where t.title = 'Checkout is down' and a.user_id = tests.uid('bob')),
  'its actions applied');
select is(
  (select count(*)::int from public.notifications where user_id = tests.uid('bob') and kind = 'assigned'), 0,
  'without notifying anyone by itself');
select ok(
  exists (select 1 from public.activity a join public.tasks t on t.id = a.task_id
          where t.title = 'Checkout is down' and a.data ->> 'automation' = 'Triage urgent'),
  'and the activity names the automation');

-- A chain: the status change made by one automation triggers the next one.
insert into public.automations (workspace_id, team_id, name, trigger, actions)
select workspace_id, team_id, 'Assigned means started', '{"kind": "assignee_added"}',
       jsonb_build_array(jsonb_build_object('kind', 'set_status', 'status_id', doing))
from ctx;
select tests.authenticate_as('alice');
insert into public.task_assignees (task_id, workspace_id, user_id)
select t.id, t.workspace_id, tests.uid('alice') from public.tasks t where t.title = 'Polish the footer';
select tests.clear_authentication();
delete from public.automation_events where team_id <> (select team_id from ctx);
select is(app.run_automations(), 2, 'a change made by an automation can trigger another');
select is((select priority from public.tasks where title = 'Polish the footer'), 2::smallint,
  'down the chain');

-- Loop protection: an automation never re-triggers itself within its chain.
insert into public.automations (workspace_id, team_id, name, trigger, actions)
select workspace_id, team_id, 'Ping-pong', '{"kind": "priority_changed"}', '[{"kind": "set_priority", "priority": 3}]'
from ctx;
update public.tasks set priority = 1 where title = 'Polish the footer';
delete from public.automation_events where team_id <> (select team_id from ctx);
select app.run_automations();
select is(
  (select count(*)::int from public.automation_runs r join public.automations a on a.id = r.automation_id
   where a.name = 'Ping-pong'), 1, 'an automation does not loop on its own changes');

-- Failures are logged with their reason and change nothing.
insert into public.templates (workspace_id, team_id, kind, name, payload, created_by)
select workspace_id, team_id, 'task', 'Gone soon', '{"title": "Checklist"}', tests.uid('alice') from ctx;
insert into public.automations (workspace_id, team_id, name, trigger, actions)
select workspace_id, team_id, 'Checklist', '{"kind": "comment_added"}',
       jsonb_build_array(jsonb_build_object('kind', 'set_priority', 'priority', 4),
                         jsonb_build_object('kind', 'create_subtask', 'template_id',
                                            (select id from public.templates where name = 'Gone soon')))
from ctx;
delete from public.templates where name = 'Gone soon';
insert into public.comments (workspace_id, task_id, author_id, body)
select t.workspace_id, t.id, tests.uid('alice'), app.doc('Any update?') from public.tasks t where t.title = 'Checkout is down';
delete from public.automation_events where team_id <> (select team_id from ctx);
select app.run_automations();
select is(
  (select r.status || ': ' || r.error from public.automation_runs r join public.automations a on a.id = r.automation_id
   where a.name = 'Checklist'),
  'failed: The template no longer exists', 'a failing run is logged with its reason');
select is((select priority from public.tasks where title = 'Checkout is down'), 1::smallint,
  'and rolls back its other actions');

-- Date triggers run once per task and due date, and notify when asked to.
insert into public.automations (workspace_id, team_id, name, trigger, actions)
select workspace_id, team_id, 'Due tomorrow', '{"kind": "due_approaching", "days": 1}',
       jsonb_build_array(jsonb_build_object('kind', 'notify', 'user_ids', jsonb_build_array(tests.uid('bob'))))
from ctx;
update public.tasks set due_date = current_date + 1 where title = 'Checkout is down';
select app.run_date_automations();
select app.run_date_automations();
select is(
  (select count(*)::int from public.automation_runs r join public.automations a on a.id = r.automation_id
   where a.name = 'Due tomorrow'), 1, 'a due date fires once');
select is((select count(*)::int from public.notifications where user_id = tests.uid('bob') and kind = 'automation'), 1,
  'and the notify action reaches its people');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.automation_runs), 0, 'outsiders see no runs');

select * from finish();
rollback;
