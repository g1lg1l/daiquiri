-- Fix: create_demo_workspace() called the seeding function inside a WHERE clause.
-- A volatile function there runs once per scanned row: zero times on an empty
-- table (returning null) and once per existing workspace otherwise.

create or replace function public.create_demo_workspace() returns public.workspaces
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_user();
  ws public.workspaces;
  new_id uuid;
begin
  select w.* into ws from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id and m.user_id = uid
  where w.is_demo limit 1;
  if found then return ws; end if;

  if (select count(*) from public.workspaces w
      where w.is_demo and w.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'The demo is very busy right now, please try again in a few minutes'
      using errcode = '53400';
  end if;

  if app.is_anonymous_user() then
    update public.profiles set display_name = 'You (demo)' where id = uid;
  end if;

  new_id := app.seed_demo_workspace(
    uid, 'demo-' || left(replace(gen_random_uuid()::text, '-', ''), 10), 'Daiquiri Demo Co.'
  );
  select * into ws from public.workspaces where id = new_id;
  return ws;
end $$;
