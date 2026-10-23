-- Custom fields: admins define them, teams turn them on (max 12), values are type-checked.
begin;
\ir _helpers.psql
select plan(15);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('gina');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Fields', 't-fields', 'General', 'GEN');
select public.create_team((select id from public.workspaces where slug = 't-fields'), 'Other', 'OTH');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-fields'
union all
select id, tests.uid('gina'), 'guest'::public.workspace_role from public.workspaces where slug = 't-fields';
insert into public.team_members (team_id, workspace_id, user_id)
select t.id, t.workspace_id, u.id from public.teams t
join public.workspaces w on w.id = t.workspace_id and w.slug = 't-fields',
(values (tests.uid('bob')), (tests.uid('gina'))) as u(id) where t.key = 'GEN';
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-fields' and t.key = 'GEN';
grant select on ctx to authenticated;

-- Definitions -----------------------------------------------------------------
select tests.authenticate_as('alice');
insert into public.custom_fields (workspace_id, name, kind, options)
select workspace_id, 'Severity', 'select', '[{"id":"s1","name":"Minor"},{"id":"s2","name":"Major"}]' from ctx;
insert into public.custom_fields (workspace_id, name, kind) select workspace_id, 'Revenue', 'number' from ctx;
insert into public.custom_fields (workspace_id, name, kind) select workspace_id, 'Reviewer', 'person' from ctx;
select is((select count(*)::int from public.custom_fields), 3, 'admins define workspace fields');

select tests.authenticate_as('bob');
select throws_ok(
  $$ insert into public.custom_fields (workspace_id, name, kind) select workspace_id, 'Sneaky', 'text' from ctx $$,
  '42501', null, 'members cannot define fields');

-- Team enablement -------------------------------------------------------------
insert into public.team_custom_fields (workspace_id, team_id, field_id)
select ctx.workspace_id, ctx.team_id, f.id from ctx, public.custom_fields f where f.name in ('Severity', 'Revenue', 'Reviewer');
select is((select count(*)::int from public.team_custom_fields), 3, 'team members turn fields on for their team');

select tests.authenticate_as('gina');
delete from public.team_custom_fields;
select is((select count(*)::int from public.team_custom_fields), 3, 'guests cannot turn them off');

-- Values -------------------------------------------------------------------------
select tests.authenticate_as('bob');
insert into public.tasks (team_id, workspace_id, title) select team_id, workspace_id, 'Bug' from ctx;
create temp table ids on commit drop as
  select (select id from public.tasks where title = 'Bug') as task_id,
         (select id from public.custom_fields where name = 'Severity') as severity,
         (select id from public.custom_fields where name = 'Revenue') as revenue,
         (select id from public.custom_fields where name = 'Reviewer') as reviewer;
grant select on ids to authenticated;

select lives_ok(
  $$ insert into public.task_field_values (task_id, field_id, workspace_id, value)
     select task_id, severity, (select workspace_id from ctx), '"s2"' from ids $$,
  'a select field takes one of its options');
select lives_ok(
  $$ insert into public.task_field_values (task_id, field_id, workspace_id, value)
     select task_id, severity, (select workspace_id from ctx), '"s1"' from ids
     on conflict (task_id, field_id) do update
       set task_id = excluded.task_id, field_id = excluded.field_id,
           workspace_id = excluded.workspace_id, value = excluded.value $$,
  'clients upsert values the way PostgREST does');
select throws_ok(
  $$ update public.task_field_values set value = '"s9"' where field_id = (select severity from ids) $$,
  '23514', null, 'but not an unknown option');
select throws_ok(
  $$ insert into public.task_field_values (task_id, field_id, workspace_id, value)
     select task_id, revenue, (select workspace_id from ctx), '"lots"' from ids $$,
  '23514', null, 'a number field takes numbers only');
select throws_ok(
  $$ insert into public.task_field_values (task_id, field_id, workspace_id, value)
     select task_id, reviewer, (select workspace_id from ctx), to_jsonb(gen_random_uuid()::text) from ids $$,
  '23514', null, 'a person field takes workspace members only');

select tests.authenticate_as('gina');
select lives_ok(
  $$ insert into public.task_field_values (task_id, field_id, workspace_id, value)
     select task_id, reviewer, (select workspace_id from ctx), to_jsonb(tests.uid('bob')::text) from ids $$,
  'guests on the team can pick any member, even ones they cannot list');

select tests.authenticate_as('alice');
insert into public.tasks (team_id, workspace_id, title)
select t.id, t.workspace_id, 'Elsewhere' from public.teams t where t.key = 'OTH'
  and t.workspace_id = (select workspace_id from ctx);
select throws_ok(
  $$ insert into public.task_field_values (task_id, field_id, workspace_id, value)
     select (select id from public.tasks where title = 'Elsewhere'), severity, (select workspace_id from ctx), '"s1"' from ids $$,
  '23514', null, 'a field only applies to teams that turned it on');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.task_field_values), 0, 'outsiders see no values');
select is((select count(*)::int from public.custom_fields), 0, 'nor field definitions');

-- At most 12 fields per team.
select tests.authenticate_as('alice');
insert into public.custom_fields (workspace_id, name, kind)
select workspace_id, 'Extra ' || n, 'text' from ctx, generate_series(1, 10) n;
select throws_ok(
  $$ insert into public.team_custom_fields (workspace_id, team_id, field_id)
     select ctx.workspace_id, ctx.team_id, f.id from ctx, public.custom_fields f where f.name like 'Extra %' $$,
  '23514', null, 'a team uses at most 12 custom fields');

-- Deleting a field removes its values.
delete from public.custom_fields where name = 'Severity';
select is((select count(*)::int from public.task_field_values where field_id = (select severity from ids)), 0,
  'deleting a field removes its values');

select * from finish();
rollback;
