-- Project update reminders: on the chosen day, only when no update is recent, once a week.
begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.authenticate_as('alice');
select public.create_workspace('Remind', 't-remind', 'General', 'GEN');
insert into public.projects (workspace_id, team_id, name, status, lead_id, update_reminder_day)
select t.workspace_id, t.id, x.name, 'active', tests.uid('alice'), extract(dow from now() at time zone 'utc')::smallint
from public.teams t join public.workspaces w on w.id = t.workspace_id and w.slug = 't-remind',
(values ('Quiet project'), ('Busy project')) as x(name);
select tests.clear_authentication();
insert into public.project_updates (project_id, author_id, health, body)
select id, tests.uid('alice'), 'on_track', app.doc('All good') from public.projects where name = 'Busy project';
-- Only this test's projects.
update public.projects set update_reminder_day = null where name not in ('Quiet project', 'Busy project');

select is(app.send_update_reminders(), 1, 'leads of projects without a recent update are reminded');
select is(
  (select p.name from public.notifications n join public.projects p on p.id = n.project_id
   where n.kind = 'update_reminder' and n.user_id = tests.uid('alice')),
  'Quiet project', 'about the right project');
select is(app.send_update_reminders(), 0, 'once a week');

select tests.authenticate_as('alice');
select is((select count(*)::int from public.notifications where kind = 'update_reminder'), 1,
  'the lead sees the reminder in the inbox');
select tests.authenticate_as('bob');
select is((select count(*)::int from public.notifications where kind = 'update_reminder'), 0, 'nobody else does');

select * from finish();
rollback;
