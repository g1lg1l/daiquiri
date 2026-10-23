-- Recurring tasks: the rhythm, who can set a series, and the job that creates the next task.
begin;
\ir _helpers.psql
select plan(15);

-- Rhythm ----------------------------------------------------------------------
select is(app.next_occurrence('2026-10-01', 'day', 3, '{}', '2026-10-05'), '2026-10-07'::date,
  'every 3 days counts from the anchor');
select is(app.next_occurrence('2026-10-19', 'week', 2, '{1,4}', '2026-10-19'), '2026-10-22'::date,
  'weekly series land on the chosen weekdays');
select is(app.next_occurrence('2026-10-19', 'week', 2, '{1,4}', '2026-10-22'), '2026-11-02'::date,
  'and skip the weeks in between');
select is(app.next_occurrence('2026-01-31', 'month', 1, '{}', '2026-02-01'), '2026-02-28'::date,
  'monthly series move to the end of shorter months');
select is(app.next_occurrence('2026-01-31', 'month', 1, '{}', '2026-02-28'), '2026-03-31'::date,
  'without drifting from the anchor day');

-- Setup ---------------------------------------------------------------------
select tests.create_user('alice');
select tests.create_user('eve');
select tests.authenticate_as('alice');
select public.create_workspace('Repeat', 't-repeat', 'General', 'GEN');
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-repeat';
grant select on ctx to authenticated;
insert into public.labels (workspace_id, name, color) select workspace_id, 'Ops', 'blue' from ctx;
select public.create_task(null, (select team_id from ctx), 'Water the plants',
  start_date => current_date + 1, due_date => current_date + 3,
  assignee_ids => array[tests.uid('alice')],
  label_ids => array(select id from public.labels where name = 'Ops'));
create temp table ids on commit drop as select id from public.tasks where title = 'Water the plants';
grant select on ids to authenticated;

-- Who can set a series ----------------------------------------------------------
insert into public.task_recurrences (task_id, workspace_id, unit, every)
select id, (select workspace_id from ctx), 'week', 1 from ids;
select is((select anchor_on from public.task_recurrences), current_date + 3,
  'a series keeps the rhythm of its task''s due date');
select is((select next_on from public.task_recurrences), current_date + 10,
  'and schedules the next task a week later');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.task_recurrences), 0, 'outsiders see no series');
select throws_ok(
  $$ insert into public.task_recurrences (task_id, workspace_id, unit) select id, (select workspace_id from ctx), 'day' from ids $$,
  '42501', null, 'nor set one on a task they cannot see');

-- The job ------------------------------------------------------------------------
select tests.clear_authentication();
-- The job is global: leave only this test's series in the (rolled back) transaction.
delete from public.task_recurrences where task_id <> (select id from ids);
update public.task_recurrences set next_on = current_date;
select is(app.run_recurrences(), 1, 'a due series creates one task');
select is(
  (select array[t.due_date - current_date, t.start_date - current_date] from public.tasks t
   where t.title = 'Water the plants' and t.id <> (select id from ids)),
  array[0, -2], 'due on the scheduled day, starting as far before it as the original');
select ok(
  (select exists (select 1 from public.task_assignees a join public.task_labels l using (task_id)
                  where a.task_id = r.task_id)
   from public.task_recurrences r),
  'with the same assignees and labels, and the series moves to it');
select ok((select next_on > current_date from public.task_recurrences), 'the next one is in the future');
select is(app.run_recurrences(), 0, 'nothing is due twice');

-- After completion: two days after the latest task is done.
update public.task_recurrences set after_completion = true, unit = 'day', every = 2;
update public.tasks set completed_at = now() - interval '3 days'
where id = (select task_id from public.task_recurrences);
select is(app.run_recurrences(), 1, 'a completed task brings the next one N days later');

select * from finish();
rollback;
