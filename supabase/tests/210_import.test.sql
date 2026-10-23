-- Importing tasks: batches as the caller, under RLS.
begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('alice');
select tests.create_user('eve');
select tests.authenticate_as('alice');
select public.create_workspace('Import', 't-import', 'General', 'GEN');
insert into public.labels (workspace_id, name, color)
select id, 'Imported', 'gray' from public.workspaces where slug = 't-import';
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id, (select id from public.labels where name = 'Imported') as label
  from public.teams t join public.workspaces w on w.id = t.workspace_id where w.slug = 't-import';
grant select on ctx to authenticated;

select is(
  public.import_tasks((select team_id from ctx), jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(), 'title', 'First', 'sort_key', 'a1', 'priority', 2,
                       'assignee_ids', jsonb_build_array(tests.uid('alice')),
                       'label_ids', jsonb_build_array((select label from ctx))),
    jsonb_build_object('id', gen_random_uuid(), 'title', 'Second', 'sort_key', 'a2', 'due_date', '2026-11-02'))),
  2, 'a batch of tasks is imported');
select is(
  (select array_agg(t.title || ':' || t.number order by t.sort_key) from public.tasks t
   where t.team_id = (select team_id from ctx)),
  array['First:1', 'Second:2'], 'with numbers in order');
select ok(
  exists (select 1 from public.task_assignees a join public.tasks t on t.id = a.task_id where t.title = 'First')
  and exists (select 1 from public.task_labels l join public.tasks t on t.id = l.task_id where t.title = 'First'),
  'and their assignees and labels');
select throws_ok(
  $$ select public.import_tasks((select team_id from ctx), (select jsonb_agg(jsonb_build_object('title', 'x')) from generate_series(1, 501))) $$,
  '23514', null, 'batches are capped at 500');

select tests.authenticate_as('eve');
select throws_ok(
  $$ select public.import_tasks((select team_id from ctx), '[{"title": "Sneaky", "sort_key": "a3"}]') $$,
  'P0002', null, 'nobody imports into a team they cannot see');

select * from finish();
rollback;
