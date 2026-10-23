-- Intake forms (feature spec §13) and the Triage module they feed.
--
-- A form belongs to a team. Workspace-only forms take submissions from
-- members; public forms from anyone with the link, by email. Each submission
-- becomes a task in the team's Triage status (or a status the form chooses),
-- and the submitter's email is recorded in the task's activity, visible to
-- the team only. Submissions go through one security-definer function with
-- size checks, a honeypot and rate limits per client and per form.

-- Triage -------------------------------------------------------------------------

/** Turning Triage on gives the team a Triage status (kept if it is turned off again). */
create function app.ensure_triage_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.statuses s where s.team_id = new.id and s.category = 'triage') then
    insert into public.statuses (workspace_id, team_id, name, category, position)
    values (new.workspace_id, new.id, 'Triage', 'triage', 0);
  end if;
  return null;
end $$;
create trigger teams_triage after insert or update of triage_enabled on public.teams
  for each row when (new.triage_enabled) execute function app.ensure_triage_status();

-- Forms ----------------------------------------------------------------------------

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  team_id uuid not null,
  -- The link: /f/<slug>. Unguessable, so a workspace-only form's link reveals nothing.
  slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text check (char_length(description) <= 1000),
  is_public boolean not null default false,
  ask_priority boolean not null default false,
  -- Custom fields the form asks for, in order.
  field_ids uuid[] not null default '{}' check (cardinality(field_ids) <= 12),
  -- Where submissions land; null: the team's Triage status, else its default.
  status_id uuid,
  enabled boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade,
  foreign key (team_id, status_id) references public.statuses (team_id, id) on delete set null (status_id)
);
create index forms_team_idx on public.forms (team_id);
create trigger forms_updated_at before update on public.forms
  for each row execute function app.set_updated_at();
create trigger forms_broadcast after insert or update or delete on public.forms
  for each row execute function app.broadcast_team_change('form');

/** Fields a form asks for must be used by its team, and public forms cannot ask for people. */
create function app.validate_form() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(new.field_ids) f
    where not exists (select 1 from public.team_custom_fields tf where tf.team_id = new.team_id and tf.field_id = f)
       or (new.is_public and exists (select 1 from public.custom_fields c where c.id = f and c.kind = 'person'))
  ) then
    raise exception 'A form can only ask for fields its team uses (and no person fields when public)'
      using errcode = '23514';
  end if;
  -- The public demo must not become a relay for strangers' submissions.
  if new.is_public and exists (select 1 from public.workspaces w where w.id = new.workspace_id and w.is_demo) then
    raise exception 'Demo workspaces cannot publish forms' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger forms_validate before insert or update on public.forms
  for each row execute function app.validate_form();

create table public.form_submissions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  form_id uuid not null references public.forms (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  email text,
  -- sha256 of the client address and the form: enough to rate-limit, not to identify.
  client_hash text not null,
  created_at timestamptz not null default now()
);
create index form_submissions_form_idx on public.form_submissions (form_id, created_at desc);
create index form_submissions_client_idx on public.form_submissions (client_hash, created_at desc);
create index form_submissions_task_idx on public.form_submissions (task_id);

alter table public.forms enable row level security;
alter table public.forms force row level security;
alter table public.form_submissions enable row level security;
alter table public.form_submissions force row level security;

create policy forms_select on public.forms for select to authenticated
  using (team_id in (select app.accessible_team_ids()));
create policy forms_insert on public.forms for insert to authenticated
  with check (app.can_manage_team(team_id));
create policy forms_update on public.forms for update to authenticated
  using (app.can_manage_team(team_id)) with check (app.can_manage_team(team_id));
create policy forms_delete on public.forms for delete to authenticated
  using (app.can_manage_team(team_id));
create policy form_submissions_select on public.form_submissions for select to authenticated
  using (form_id in (select f.id from public.forms f));

revoke all on public.form_submissions from anon;
revoke insert, update, delete on public.form_submissions from authenticated;
revoke insert, update on public.forms from authenticated;
grant insert (workspace_id, team_id, name, description, is_public, ask_priority, field_ids, status_id, enabled)
  on public.forms to authenticated;
grant update (name, description, is_public, ask_priority, field_ids, status_id, enabled)
  on public.forms to authenticated;

-- Filling in a form ----------------------------------------------------------------

/** What a form shows: public forms to anyone, workspace-only forms to members. */
create function public.form_by_slug(slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', f.name,
    'description', f.description,
    'team', t.name,
    'workspace', w.name,
    'is_public', f.is_public,
    'ask_priority', f.ask_priority,
    'signed_in', auth.uid() is not null,
    'fields', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'options', c.options)
                                order by array_position(f.field_ids, c.id)), '[]')
      from public.custom_fields c
      join public.team_custom_fields tf on tf.field_id = c.id and tf.team_id = f.team_id
      where c.id = any (f.field_ids)))
  from public.forms f
  join public.teams t on t.id = f.team_id
  join public.workspaces w on w.id = f.workspace_id
  where f.slug = form_by_slug.slug and f.enabled
    and (f.is_public or f.workspace_id in (select app.member_workspace_ids()))
$$;

/**
 * Turns a submission into a task. Returns the task's identifier, or null for
 * submissions caught by the honeypot (which bots fill and people never see).
 */
create function public.submit_form(
  slug text, title text, details text default null, email text default null,
  priority smallint default 0, fields jsonb default '{}', website text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  f public.forms;
  uid uuid := auth.uid();
  sender text := lower(trim(coalesce(email, '')));
  client text;
  paragraphs text[];
  created public.tasks;
  field record;
begin
  select * into f from public.forms x
  where x.slug = submit_form.slug and x.enabled
    and (x.is_public or x.workspace_id in (select app.member_workspace_ids()));
  if not found then
    raise exception 'Form not found' using errcode = 'P0002';
  end if;
  if coalesce(website, '') <> '' then
    return null;
  end if;

  title := trim(coalesce(title, ''));
  if char_length(title) not between 1 and 200 or char_length(coalesce(details, '')) > 5000 then
    raise exception 'Give a title of up to 200 characters and details of up to 5,000' using errcode = '23514';
  end if;
  if sender = '' and uid is not null then
    select u.email into sender from auth.users u where u.id = uid;
  end if;
  if uid is null and (sender !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(sender) > 254) then
    raise exception 'Enter a valid email address' using errcode = '23514';
  end if;

  client := encode(sha256(convert_to(
    coalesce(nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), ''),
             uid::text, 'unknown') || ':' || f.id, 'UTF8')), 'hex');
  if (select count(*) from public.form_submissions s
      where s.client_hash = client and s.created_at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.form_submissions s
         where s.form_id = f.id and s.created_at > now() - interval '1 hour') >= 200 then
    -- PostgREST answers PTnnn errors with HTTP nnn.
    raise exception 'Too many submissions. Try again in a few minutes.' using errcode = 'PT429';
  end if;

  paragraphs := array(select trim(l) from unnest(string_to_array(coalesce(details, ''), E'\n')) l
                      where trim(l) <> '');
  insert into public.tasks (workspace_id, team_id, title, status_id, priority, description)
  values (f.workspace_id, f.team_id, title,
          coalesce(f.status_id, (select s.id from public.statuses s where s.team_id = f.team_id and s.category = 'triage'
                                 order by s.position limit 1)),
          case when f.ask_priority and submit_form.priority between 0 and 4 then submit_form.priority else 0 end,
          case when cardinality(paragraphs) > 0 then app.doc(variadic paragraphs) end)
  returning * into created;

  for field in
    select x.key::uuid as field_id, x.value from jsonb_each(coalesce(submit_form.fields, '{}')) x
    where x.key::uuid = any (f.field_ids)
  loop
    insert into public.task_field_values (task_id, field_id, workspace_id, value)
    values (created.id, field.field_id, f.workspace_id, field.value);
  end loop;

  insert into public.form_submissions (workspace_id, form_id, task_id, email, client_hash)
  values (f.workspace_id, f.id, created.id, nullif(sender, ''), client);
  perform app.log_activity(f.workspace_id, f.team_id, created.id, null, 'task.submitted',
    jsonb_build_object('form', f.name, 'email', nullif(sender, '')));
  -- The form's author follows what comes in.
  perform app.subscribe(created.id, f.created_by);

  return (select t.key from public.teams t where t.id = f.team_id) || '-' || created.number;
end $$;

grant execute on function public.form_by_slug(text) to anon, authenticated;
grant execute on function public.submit_form(text, text, text, text, smallint, jsonb, text) to anon, authenticated;
