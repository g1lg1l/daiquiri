-- Daiq foundation: identity, workspaces, membership, invitations, teams, workflow.
-- See docs/architecture/database-model.md for the model and docs/adr/0003, 0006, 0007.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Private schema for helpers and trigger functions. Not exposed through PostgREST.
create schema if not exists app;
grant usage on schema app to authenticated, anon, service_role;
-- Privileges are opt-in. Supabase grants EXECUTE on new functions to anon and
-- authenticated (and PUBLIC globally); every function exposed to clients must
-- instead be granted explicitly (verified by supabase/tests/000_security_baseline).
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest');
create type public.status_category as enum (
  'triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'
);

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create function app.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create function app.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  return uid;
end $$;

create function app.is_anonymous_user() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- Realtime: thin events on private topics (ADR-0007). Never includes row contents.
create function app.broadcast(topic text, entity text, entity_id uuid, op text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('entity', entity, 'id', entity_id, 'op', lower(op), 'actor_id', auth.uid()),
    'change',
    topic,
    true
  );
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();

create function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Guest'
    ), 80)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- Workspaces and membership
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (char_length(slug) between 2 and 40 and slug ~ '^[a-z0-9](-?[a-z0-9])*$'),
  name text not null check (char_length(trim(name)) between 1 and 80),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function app.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- A workspace always keeps at least one owner.
-- security definer: the check must see the workspace even after the caller lost access to it.
create function app.ensure_owner_remains() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := old.workspace_id;
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.workspaces w where w.id = ws)
     and not exists (
       select 1 from public.workspace_members m
       where m.workspace_id = ws and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'A workspace must keep at least one owner' using errcode = '23514';
  end if;
  return null;
end $$;

create constraint trigger workspace_members_keep_owner
  after update or delete on public.workspace_members
  deferrable initially deferred
  for each row execute function app.ensure_owner_remains();

-- ---------------------------------------------------------------------------
-- Teams and workflow
-- ---------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[A-Z][A-Z0-9]{1,5}$'),
  name text not null check (char_length(trim(name)) between 1 and 60),
  description text check (char_length(description) <= 500),
  is_private boolean not null default false,
  task_seq integer not null default 0,
  cycles_enabled boolean not null default false,
  estimates_enabled boolean not null default false,
  triage_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key),
  unique (workspace_id, id)
);

create trigger teams_updated_at before update on public.teams
  for each row execute function app.set_updated_at();

create table public.team_members (
  team_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id) on delete cascade
);

create index team_members_user_idx on public.team_members (user_id);

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  team_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 40),
  category public.status_category not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (team_id, id),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade
);

create unique index statuses_team_name_idx on public.statuses (team_id, lower(name));

-- ---------------------------------------------------------------------------
-- Permission helpers (ADR-0006). Set-returning so policies evaluate them once
-- per statement. They return nothing for anonymous callers: fail closed.
-- ---------------------------------------------------------------------------

create function app.member_workspace_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
$$;

-- Workspaces where the caller is a full (non-guest) member.
create function app.full_member_workspace_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.workspace_id from public.workspace_members m
  where m.user_id = (select auth.uid()) and m.role <> 'guest'
$$;

create function app.admin_workspace_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.workspace_id from public.workspace_members m
  where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
$$;

-- Teams the caller can read: public teams of workspaces where they are a full
-- member, plus every team they belong to (the only access path for guests).
create function app.accessible_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select t.id
  from public.teams t
  join public.workspace_members m
    on m.workspace_id = t.workspace_id and m.user_id = (select auth.uid())
  where (not t.is_private and m.role <> 'guest')
     or exists (
       select 1 from public.team_members tm
       where tm.team_id = t.id and tm.user_id = (select auth.uid())
     )
$$;

-- Users the caller shares at least one team with (what guests may see of the directory).
create function app.teammate_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct tm.user_id
  from public.team_members tm
  where tm.team_id in (
    select mine.team_id from public.team_members mine where mine.user_id = (select auth.uid())
  )
$$;

create function app.workspace_role(ws uuid) returns public.workspace_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = (select auth.uid())
$$;

grant execute on function
  app.member_workspace_ids(), app.full_member_workspace_ids(), app.admin_workspace_ids(),
  app.accessible_team_ids(), app.teammate_ids(), app.workspace_role(uuid),
  app.require_user(), app.is_anonymous_user()
to authenticated;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  token_hash bytea not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index invitations_pending_email_idx on public.invitations (workspace_id, email)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.statuses enable row level security;
alter table public.invitations enable row level security;

alter table public.profiles force row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members force row level security;
alter table public.teams force row level security;
alter table public.team_members force row level security;
alter table public.statuses force row level security;
alter table public.invitations force row level security;

-- Membership rows: full members see their workspaces' directory; guests see
-- only themselves and their teammates.
create policy workspace_members_select on public.workspace_members for select to authenticated
  using (
    workspace_id in (select app.full_member_workspace_ids())
    or user_id = (select auth.uid())
    or (workspace_id in (select app.member_workspace_ids()) and user_id in (select app.teammate_ids()))
  );

-- Profiles are visible when their membership row is visible (RLS applies inside the subquery).
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select m.user_id from public.workspace_members m));

create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_select on public.workspaces for select to authenticated
  using (id in (select app.member_workspace_ids()));

create policy workspaces_update on public.workspaces for update to authenticated
  using (id in (select app.admin_workspace_ids()))
  with check (id in (select app.admin_workspace_ids()));

create policy teams_select on public.teams for select to authenticated
  using (id in (select app.accessible_team_ids()));

create policy teams_update on public.teams for update to authenticated
  using (
    workspace_id in (select app.admin_workspace_ids())
    or (id in (select app.accessible_team_ids()) and workspace_id in (select app.full_member_workspace_ids())
        and exists (select 1 from public.team_members tm where tm.team_id = teams.id and tm.user_id = (select auth.uid())))
  )
  with check (id in (select app.accessible_team_ids()));

create policy team_members_select on public.team_members for select to authenticated
  using (team_id in (select app.accessible_team_ids()));

-- Full members may join public teams themselves; admins may add anyone.
create policy team_members_insert on public.team_members for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and team_id in (select app.accessible_team_ids())
      and workspace_id in (select app.full_member_workspace_ids()))
    or workspace_id in (select app.admin_workspace_ids())
  );

create policy team_members_delete on public.team_members for delete to authenticated
  using (user_id = (select auth.uid()) or workspace_id in (select app.admin_workspace_ids()));

create policy statuses_select on public.statuses for select to authenticated
  using (team_id in (select app.accessible_team_ids()));

create policy invitations_select on public.invitations for select to authenticated
  using (workspace_id in (select app.admin_workspace_ids()));

-- Writes not covered by a policy (workspaces insert, membership changes,
-- invitations, statuses) go through the RPC functions below.

-- Column-level privileges: only user-editable columns are updatable.
revoke update on public.profiles, public.workspaces, public.teams from authenticated, anon;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant update (name) on public.workspaces to authenticated;
grant update (name, description, is_private, cycles_enabled, estimates_enabled, triage_enabled)
  on public.teams to authenticated;
revoke insert, update, delete on public.workspace_members, public.invitations, public.statuses
  from authenticated, anon;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Team creation with workflow templates
-- ---------------------------------------------------------------------------

create function app.create_team(
  p_workspace_id uuid,
  p_name text,
  p_key text,
  p_template text,
  p_creator uuid,
  p_is_private boolean default false
) returns public.teams
language plpgsql security definer set search_path = '' as $$
declare
  team public.teams;
  workflow jsonb := case p_template
    when 'software' then '[["Backlog","backlog"],["Todo","unstarted"],["In Progress","started"],["In Review","started"],["Done","completed"],["Canceled","canceled"]]'
    when 'marketing' then '[["Ideas","backlog"],["Planned","unstarted"],["In Progress","started"],["Review","started"],["Published","completed"],["Canceled","canceled"]]'
    when 'operations' then '[["Backlog","backlog"],["To Do","unstarted"],["Doing","started"],["Waiting","started"],["Done","completed"],["Canceled","canceled"]]'
    when 'generic' then '[["Backlog","backlog"],["Todo","unstarted"],["In Progress","started"],["Done","completed"],["Canceled","canceled"]]'
  end;
begin
  if workflow is null then
    raise exception 'Unknown team template: %', p_template using errcode = '22023';
  end if;

  insert into public.teams (workspace_id, name, key, is_private, estimates_enabled, cycles_enabled)
  values (p_workspace_id, trim(p_name), upper(p_key), p_is_private,
          p_template = 'software', p_template = 'software')
  returning * into team;

  insert into public.statuses (workspace_id, team_id, name, category, position)
  select p_workspace_id, team.id, s.value ->> 0, (s.value ->> 1)::public.status_category, s.ordinality::int
  from jsonb_array_elements(workflow) with ordinality as s;

  insert into public.team_members (team_id, workspace_id, user_id)
  values (team.id, p_workspace_id, p_creator);

  return team;
end $$;

create function public.create_team(
  workspace_id uuid,
  name text,
  key text,
  template text default 'generic',
  is_private boolean default false
) returns public.teams
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_user();
  ws uuid := workspace_id;
begin
  if app.workspace_role(ws) is null or app.workspace_role(ws) = 'guest' then
    raise exception 'Only workspace members can create teams' using errcode = '42501';
  end if;
  return app.create_team(ws, name, key, template, uid, is_private);
end $$;

grant execute on function public.create_team(uuid, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Workspace creation
-- ---------------------------------------------------------------------------

create function public.create_workspace(
  name text,
  slug text,
  team_name text default 'General',
  team_key text default 'GEN',
  template text default 'generic'
) returns public.workspaces
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_user();
  ws public.workspaces;
begin
  if app.is_anonymous_user() then
    raise exception 'Sign up to create a workspace' using errcode = '42501';
  end if;

  -- Abuse guard: at most 10 workspaces per user per day (threat T9).
  if (select count(*) from public.workspaces w
      where w.created_by = uid and w.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many workspaces created today' using errcode = '53400';
  end if;

  insert into public.workspaces (name, slug, created_by)
  values (trim(name), lower(slug), uid)
  returning * into ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws.id, uid, 'owner');
  perform app.create_team(ws.id, team_name, team_key, template, uid);
  return ws;
end $$;

grant execute on function public.create_workspace(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Invitations (threat T10): 256-bit token, only its hash is stored.
-- ---------------------------------------------------------------------------

create function public.create_invitation(
  workspace_id uuid,
  email text,
  role public.workspace_role default 'member'
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_user();
  ws uuid := workspace_id;
  token text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
begin
  if ws not in (select app.admin_workspace_ids()) then
    raise exception 'Only admins can invite members' using errcode = '42501';
  end if;
  if role = 'owner' then
    raise exception 'Owners cannot be invited' using errcode = '22023';
  end if;
  if (select count(*) from public.invitations i
      where i.workspace_id = ws and i.created_at > now() - interval '1 day') >= 50 then
    raise exception 'Too many invitations today' using errcode = '53400';
  end if;

  -- Re-inviting replaces a pending invitation for the same address.
  update public.invitations i set revoked_at = now()
  where i.workspace_id = ws and i.email = lower(trim(create_invitation.email))
    and i.accepted_at is null and i.revoked_at is null;

  insert into public.invitations (workspace_id, email, role, token_hash, invited_by)
  values (ws, lower(trim(create_invitation.email)), role, sha256(convert_to(token, 'UTF8')), uid);

  return token;
end $$;

grant execute on function public.create_invitation(uuid, text, public.workspace_role) to authenticated;

create function public.revoke_invitation(invitation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_user();
  update public.invitations i set revoked_at = now()
  where i.id = invitation_id
    and i.workspace_id in (select app.admin_workspace_ids())
    and i.accepted_at is null;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
end $$;

grant execute on function public.revoke_invitation(uuid) to authenticated;

-- Returns the workspace a valid invitation points to (for the accept screen).
-- Unknown, expired and revoked tokens are indistinguishable.
create function public.preview_invitation(token text)
returns table (workspace_name text, role public.workspace_role, email text)
language sql stable security definer set search_path = '' as $$
  select w.name, i.role, i.email::text
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = sha256(convert_to(token, 'UTF8'))
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
$$;

grant execute on function public.preview_invitation(text) to authenticated;

create function public.accept_invitation(token text) returns public.workspaces
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_user();
  invite public.invitations;
  user_email text;
  ws public.workspaces;
begin
  select * into invite from public.invitations i
  where i.token_hash = sha256(convert_to(token, 'UTF8'))
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  for update;

  if not found then
    raise exception 'This invitation is invalid or has expired' using errcode = 'P0002';
  end if;

  select u.email into user_email from auth.users u where u.id = uid;
  if user_email is null or lower(user_email) <> lower(invite.email::text) then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invite.workspace_id, uid, invite.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.invitations set accepted_at = now() where id = invite.id;
  select * into ws from public.workspaces where id = invite.workspace_id;
  return ws;
end $$;

grant execute on function public.accept_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Member management
-- ---------------------------------------------------------------------------

create function public.set_member_role(
  workspace_id uuid,
  user_id uuid,
  role public.workspace_role
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  caller_role public.workspace_role := app.workspace_role(workspace_id);
  target_role public.workspace_role;
begin
  perform app.require_user();
  select m.role into target_role from public.workspace_members m
  where m.workspace_id = set_member_role.workspace_id and m.user_id = set_member_role.user_id;

  if target_role is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if caller_role is distinct from 'owner'
     and (caller_role is distinct from 'admin' or target_role = 'owner' or role = 'owner') then
    raise exception 'You cannot change this member''s role' using errcode = '42501';
  end if;

  update public.workspace_members m set role = set_member_role.role
  where m.workspace_id = set_member_role.workspace_id and m.user_id = set_member_role.user_id;
end $$;

grant execute on function public.set_member_role(uuid, uuid, public.workspace_role) to authenticated;

create function public.remove_member(workspace_id uuid, user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_user();
  caller_role public.workspace_role := app.workspace_role(workspace_id);
  target_role public.workspace_role;
begin
  select m.role into target_role from public.workspace_members m
  where m.workspace_id = remove_member.workspace_id and m.user_id = remove_member.user_id;

  if target_role is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  -- Anyone may leave; admins remove non-owners; owners remove anyone.
  if remove_member.user_id <> uid
     and caller_role is distinct from 'owner'
     and (caller_role is distinct from 'admin' or target_role = 'owner') then
    raise exception 'You cannot remove this member' using errcode = '42501';
  end if;

  delete from public.workspace_members m
  where m.workspace_id = remove_member.workspace_id and m.user_id = remove_member.user_id;
end $$;

grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- Emails live in auth.users; only admins may read them, through this function.
create function public.workspace_member_emails(workspace_id uuid)
returns table (user_id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = workspace_member_emails.workspace_id
    and workspace_member_emails.workspace_id in (select app.admin_workspace_ids())
$$;

grant execute on function public.workspace_member_emails(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime fan-out for workspace-level entities
-- ---------------------------------------------------------------------------

-- tg_argv: [entity name, id column (default 'id')]
create function app.broadcast_workspace_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_json jsonb := to_jsonb(coalesce(new, old));
begin
  perform app.broadcast(
    'workspace:' || (row_json ->> 'workspace_id'),
    tg_argv[0],
    (row_json ->> coalesce(tg_argv[1], 'id'))::uuid,
    tg_op
  );
  return null;
end $$;

create trigger teams_broadcast after insert or update or delete on public.teams
  for each row execute function app.broadcast_workspace_change('team');
create trigger statuses_broadcast after insert or update or delete on public.statuses
  for each row execute function app.broadcast_workspace_change('status');
create trigger workspace_members_broadcast after insert or update or delete on public.workspace_members
  for each row execute function app.broadcast_workspace_change('workspace_member', 'user_id');

-- Topic authorisation (ADR-0007): receive only; clients cannot send.
create policy "daiq: receive workspace, team and user topics" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      (split_part(realtime.topic(), ':', 1) = 'workspace'
        and split_part(realtime.topic(), ':', 2) in (select id::text from app.member_workspace_ids() id))
      or (split_part(realtime.topic(), ':', 1) = 'team'
        and split_part(realtime.topic(), ':', 2) in (select id::text from app.accessible_team_ids() id))
      or realtime.topic() = 'user:' || (select auth.uid())::text
    )
  );
