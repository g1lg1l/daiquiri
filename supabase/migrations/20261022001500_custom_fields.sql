-- Custom fields (feature spec §3.9, database-model §4.5).
--
-- Fields are defined per workspace by admins and turned on per team (at most
-- 12). A task's values live in task_field_values, one row per field, and a
-- trigger checks every value against its field's kind and the task's team.

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  kind text not null check (kind in ('text', 'number', 'date', 'select', 'multi_select', 'person', 'checkbox', 'url')),
  -- select / multi_select: [{"id": "…", "name": "…", "color": "…"}]
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 50),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, name)
);
create trigger custom_fields_updated_at before update on public.custom_fields
  for each row execute function app.set_updated_at();

create table public.team_custom_fields (
  workspace_id uuid not null,
  team_id uuid not null,
  field_id uuid not null,
  position integer not null default 0,
  primary key (team_id, field_id),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade,
  foreign key (workspace_id, field_id) references public.custom_fields (workspace_id, id) on delete cascade
);
create index team_custom_fields_field_idx on public.team_custom_fields (field_id);

create function app.team_fields_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.team_custom_fields f where f.team_id = new.team_id) >= 12 then
    raise exception 'A team can use at most 12 custom fields' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger team_custom_fields_limit before insert on public.team_custom_fields
  for each row execute function app.team_fields_limit();

create table public.task_field_values (
  task_id uuid not null,
  field_id uuid not null,
  workspace_id uuid not null,
  value jsonb not null check (pg_column_size(value) <= 8192),
  updated_at timestamptz not null default now(),
  primary key (task_id, field_id),
  foreign key (workspace_id, task_id) references public.tasks (workspace_id, id) on delete cascade,
  foreign key (workspace_id, field_id) references public.custom_fields (workspace_id, id) on delete cascade
);
create index task_field_values_field_idx on public.task_field_values (field_id);

/**
 * Rejects values that do not fit the field's kind, or fields the task's team
 * has not turned on. security definer so a person value can be any member
 * (guests cannot list members); the composite keys already pin the task and
 * field to the row's workspace.
 */
create function app.validate_field_value() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  field public.custom_fields;
  v jsonb := new.value;
  option_ids jsonb;
  ok boolean;
begin
  select * into field from public.custom_fields f where f.id = new.field_id;
  if not exists (
    select 1 from public.team_custom_fields tf join public.tasks t on t.team_id = tf.team_id
    where t.id = new.task_id and tf.field_id = new.field_id
  ) then
    raise exception 'This field is not used by the task''s team' using errcode = '23514';
  end if;
  option_ids := coalesce((select jsonb_agg(o -> 'id') from jsonb_array_elements(field.options) o), '[]');
  ok := case field.kind
    when 'text' then jsonb_typeof(v) = 'string' and char_length(v #>> '{}') <= 2000
    when 'number' then jsonb_typeof(v) = 'number'
    when 'date' then jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
    when 'checkbox' then jsonb_typeof(v) = 'boolean'
    when 'url' then jsonb_typeof(v) = 'string' and (v #>> '{}') ~* '^https?://' and char_length(v #>> '{}') <= 2048
    when 'select' then jsonb_typeof(v) = 'string' and option_ids @> jsonb_build_array(v)
    when 'multi_select' then jsonb_typeof(v) = 'array' and option_ids @> v
    when 'person' then jsonb_typeof(v) = 'string' and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = new.workspace_id and m.user_id::text = (v #>> '{}'))
    else false
  end;
  if not coalesce(ok, false) then
    raise exception 'Invalid value for the % field "%"', field.kind, field.name using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger task_field_values_validate before insert or update on public.task_field_values
  for each row execute function app.validate_field_value();

-- A changed value is a change of its task; a changed definition, of the workspace.
create trigger task_field_values_broadcast after insert or update or delete on public.task_field_values
  for each row execute function app.broadcast_team_change('task');
create trigger custom_fields_broadcast after insert or update or delete on public.custom_fields
  for each row execute function app.broadcast_workspace_change('custom_field');
create trigger team_custom_fields_broadcast after insert or delete on public.team_custom_fields
  for each row execute function app.broadcast_workspace_change('custom_field', 'field_id');

alter table public.custom_fields enable row level security;
alter table public.custom_fields force row level security;
alter table public.team_custom_fields enable row level security;
alter table public.team_custom_fields force row level security;
alter table public.task_field_values enable row level security;
alter table public.task_field_values force row level security;

create policy custom_fields_select on public.custom_fields for select to authenticated
  using (workspace_id in (select app.member_workspace_ids()));
create policy custom_fields_insert on public.custom_fields for insert to authenticated
  with check (workspace_id in (select app.admin_workspace_ids()));
create policy custom_fields_update on public.custom_fields for update to authenticated
  using (workspace_id in (select app.admin_workspace_ids()))
  with check (workspace_id in (select app.admin_workspace_ids()));
create policy custom_fields_delete on public.custom_fields for delete to authenticated
  using (workspace_id in (select app.admin_workspace_ids()));

/** Who may change a team's settings: workspace admins and the team's own (non-guest) members. */
create function app.can_manage_team(p_team uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team
      and (t.workspace_id in (select app.admin_workspace_ids())
           or (t.workspace_id in (select app.full_member_workspace_ids())
               and exists (select 1 from public.team_members tm
                           where tm.team_id = t.id and tm.user_id = (select auth.uid()))))
  )
$$;
grant execute on function app.can_manage_team(uuid) to authenticated;

create policy team_custom_fields_select on public.team_custom_fields for select to authenticated
  using (team_id in (select app.accessible_team_ids()));
create policy team_custom_fields_insert on public.team_custom_fields for insert to authenticated
  with check (app.can_manage_team(team_id));
create policy team_custom_fields_update on public.team_custom_fields for update to authenticated
  using (app.can_manage_team(team_id)) with check (app.can_manage_team(team_id));
create policy team_custom_fields_delete on public.team_custom_fields for delete to authenticated
  using (app.can_manage_team(team_id));

-- Values follow the task: whoever can see and edit it can set its fields.
create policy task_field_values_select on public.task_field_values for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_field_values_insert on public.task_field_values for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_field_values_update on public.task_field_values for update to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id))
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_field_values_delete on public.task_field_values for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

revoke update on public.custom_fields, public.team_custom_fields, public.task_field_values from authenticated;
grant update (name, options, position) on public.custom_fields to authenticated;
grant update (position) on public.team_custom_fields to authenticated;
-- PostgREST upserts set every column they insert; the composite keys, RLS and
-- the validator keep a moved value inside tasks the caller can already edit.
grant update (task_id, field_id, workspace_id, value) on public.task_field_values to authenticated;
