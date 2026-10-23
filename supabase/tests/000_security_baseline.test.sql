-- Fail-closed baseline (threat model T1, T5): every public table has forced RLS,
-- anon can execute nothing, and authenticated can execute only an explicit allow-list.
begin;
\ir _helpers.psql
select plan(4);

select is(
  array(
    select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and not (c.relrowsecurity and c.relforcerowsecurity)
    order by 1
  ),
  array[]::text[],
  'every public table has RLS enabled and forced'
);

select is(
  array(
    select p.oid::regprocedure::text from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'app'::regnamespace)
      and has_function_privilege('anon', p.oid, 'execute')
    order by 1
  ),
  array['form_by_slug(text)', 'submit_form(text,text,text,text,smallint,jsonb,text)']::text[],
  'anon can execute only the public form functions'
);

select is(
  array(
    select p.proname::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')
    order by 1
  ),
  array[
    'accept_invitation', 'create_demo_workspace', 'create_invitation', 'create_project_from_template',
    'create_task', 'create_task_from_template', 'create_team', 'create_workspace', 'cycle_progress',
    'delete_tasks', 'form_by_slug', 'preview_invitation', 'purge_tasks', 'remove_member', 'restore_tasks', 'revoke_invitation',
    'save_project_template', 'save_task_template', 'search', 'set_member_role', 'set_task_assignees',
    'set_task_labels', 'start_timer', 'status_flow', 'stop_timer', 'submit_form', 'trashed_tasks',
    'workspace_member_emails'
  ]::text[],
  'authenticated can execute exactly the public RPC allow-list'
);

select is(
  array(
    select distinct table_name::text from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'
    order by 1
  ),
  array[]::text[],
  'anon has no table privileges in public'
);

select * from finish();
rollback;
