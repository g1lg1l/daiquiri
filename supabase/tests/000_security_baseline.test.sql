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
  array[]::text[],
  'anon cannot execute any Daiq function'
);

select is(
  array(
    select p.proname::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')
    order by 1
  ),
  array[
    'accept_invitation', 'create_invitation', 'create_team', 'create_workspace',
    'preview_invitation', 'remove_member', 'revoke_invitation', 'set_member_role',
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
