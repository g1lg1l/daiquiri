-- Daiq work model: projects, tasks, assignees, labels, relations, subscribers.
-- See docs/architecture/database-model.md §4.2.

create type public.project_status as enum ('planned', 'active', 'paused', 'completed', 'canceled');
create type public.relation_kind as enum ('blocks', 'related', 'duplicate');

-- ---------------------------------------------------------------------------
-- Fractional index keys, compatible with rocicorp/fractional-indexing (used by
-- @daiq/domain). Server-side inserts without a key go before/after the
-- current extremes by incrementing/decrementing the integer part.
-- ---------------------------------------------------------------------------

create function app.sort_key_integer_length(head text) returns integer
language plpgsql immutable set search_path = '' as $$
begin
  -- collate "C": locale collations interleave upper and lower case.
  if head collate "C" between 'a' and 'z' then return ascii(head) - ascii('a') + 2; end if;
  if head collate "C" between 'A' and 'Z' then return ascii('Z') - ascii(head) + 2; end if;
  raise exception 'Invalid sort key head: %', head using errcode = '22023';
end $$;

create function app.sort_key_increment(int_part text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  head text := left(int_part, 1);
  digs text := substr(int_part, 2);
  d integer;
begin
  for i in reverse length(digs)..1 loop
    d := strpos(digits, substr(digs, i, 1));
    if d = 62 then
      digs := overlay(digs placing '0' from i for 1);
    else
      return head || overlay(digs placing substr(digits, d + 1, 1) from i for 1);
    end if;
  end loop;
  if head = 'Z' then return 'a0'; end if;
  if head = 'z' then return null; end if;
  head := chr(ascii(head) + 1);
  return head || case when head collate "C" > 'a' then digs || '0' else substr(digs, 2) end;
end $$;

create function app.sort_key_decrement(int_part text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  head text := left(int_part, 1);
  digs text := substr(int_part, 2);
  d integer;
begin
  for i in reverse length(digs)..1 loop
    d := strpos(digits, substr(digs, i, 1));
    if d = 1 then
      digs := overlay(digs placing 'z' from i for 1);
    else
      return head || overlay(digs placing substr(digits, d - 1, 1) from i for 1);
    end if;
  end loop;
  if head = 'a' then return 'Zz'; end if;
  if head = 'A' then return null; end if;
  head := chr(ascii(head) - 1);
  return head || case when head collate "C" < 'Z' then digs || 'z' else substr(digs, 2) end;
end $$;

create function app.sort_key_after(key text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  result text;
begin
  if key is null then return 'a0'; end if;
  result := app.sort_key_increment(left(key, app.sort_key_integer_length(left(key, 1))));
  if result is null then raise exception 'Sort key space exhausted' using errcode = '22003'; end if;
  return result;
end $$;

create function app.sort_key_before(key text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  int_part text;
  result text;
begin
  if key is null then return 'a0'; end if;
  int_part := left(key, app.sort_key_integer_length(left(key, 1)));
  if int_part collate "C" < key collate "C" then return int_part; end if;
  result := app.sort_key_decrement(int_part);
  if result is null then raise exception 'Sort key space exhausted' using errcode = '22003'; end if;
  return result;
end $$;

-- Editor documents (ProseMirror JSON, ADR-0005): structural check + size cap.
create function app.is_document(doc jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select doc is null
    or (jsonb_typeof(doc) = 'object' and doc ->> 'type' = 'doc' and pg_column_size(doc) <= 262144)
$$;

-- Used by check constraints, which run with the caller's privileges.
grant execute on function app.is_document(jsonb) to authenticated;

-- Plain text of a document, for search and previews.
create function app.document_text(doc jsonb) returns text
language sql immutable set search_path = '' as $$
  select coalesce(string_agg(t #>> '{}', ' '), '')
  from jsonb_path_query(coalesce(doc, '{}'::jsonb), 'strict $.**.text') as t
  where jsonb_typeof(t) = 'string'
$$;

-- User ids mentioned in a document (mention nodes carry attrs.id).
create function app.document_mentions(doc jsonb) returns uuid[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct (m #>> '{}')::uuid), '{}')
  from jsonb_path_query(coalesce(doc, '{}'::jsonb), 'strict $.**?(@.type == "mention").attrs.id') as m
  where (m #>> '{}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  team_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description jsonb check (app.is_document(description)),
  status public.project_status not null default 'planned',
  lead_id uuid,
  start_date date,
  target_date date,
  sort_key text collate "C" not null default 'a0',
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_date is null or start_date is null or target_date >= start_date),
  unique (team_id, id),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade,
  foreign key (workspace_id, lead_id)
    references public.workspace_members (workspace_id, user_id) on delete set null (lead_id)
);

create index projects_team_idx on public.projects (team_id, sort_key) where archived_at is null;
create index projects_lead_idx on public.projects (lead_id) where lead_id is not null;

create trigger projects_updated_at before update on public.projects
  for each row execute function app.set_updated_at();

create function app.project_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  if new.sort_key is null or new.sort_key = 'a0' then
    new.sort_key := app.sort_key_after(
      (select max(p.sort_key) from public.projects p where p.team_id = new.team_id)
    );
  end if;
  return new;
end $$;

create trigger projects_defaults before insert on public.projects
  for each row execute function app.project_defaults();

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  team_id uuid not null,
  number integer not null,
  title text not null check (char_length(trim(title)) between 1 and 500),
  description jsonb check (app.is_document(description)),
  description_text text not null default '',
  status_id uuid not null,
  priority smallint not null default 0 check (priority between 0 and 4),
  project_id uuid,
  parent_id uuid,
  creator_id uuid references public.profiles (id) on delete set null,
  start_date date,
  due_date date,
  estimate smallint check (estimate between 0 and 100),
  sort_key text collate "C" not null,
  completed_at timestamptz,
  canceled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', title), 'A')
    || setweight(to_tsvector('simple', left(description_text, 100000)), 'B')
  ) stored,
  check (due_date is null or start_date is null or due_date >= start_date),
  unique (team_id, number),
  unique (team_id, id),
  unique (workspace_id, id),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade,
  foreign key (team_id, status_id) references public.statuses (team_id, id),
  foreign key (team_id, project_id)
    references public.projects (team_id, id) on delete set null (project_id),
  foreign key (team_id, parent_id) references public.tasks (team_id, id) on delete cascade
);

create index tasks_team_order_idx on public.tasks (team_id, sort_key) where deleted_at is null;
create index tasks_team_status_idx on public.tasks (team_id, status_id) where deleted_at is null;
create index tasks_project_idx on public.tasks (project_id, sort_key)
  where deleted_at is null and project_id is not null;
create index tasks_parent_idx on public.tasks (parent_id) where parent_id is not null;
create index tasks_due_idx on public.tasks (workspace_id, due_date)
  where due_date is not null and deleted_at is null;
create index tasks_creator_idx on public.tasks (creator_id);
create index tasks_deleted_idx on public.tasks (deleted_at) where deleted_at is not null;
create index tasks_status_fk_idx on public.tasks (status_id);
create index tasks_search_idx on public.tasks using gin (search);
create index tasks_title_trgm_idx on public.tasks using gin (title extensions.gin_trgm_ops);

create function app.status_category_of(p_status_id uuid) returns public.status_category
language sql stable security definer set search_path = '' as $$
  select s.category from public.statuses s where s.id = p_status_id
$$;

create function app.task_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  category public.status_category;
  ancestor uuid;
  depth integer := 1;
  subtree_height integer;
begin
  if tg_op = 'INSERT' then
    new.creator_id := coalesce(new.creator_id, auth.uid());
    update public.teams set task_seq = task_seq + 1 where id = new.team_id
      returning task_seq into new.number;
    if new.status_id is null then
      select s.id into new.status_id from public.statuses s
      where s.team_id = new.team_id and s.category in ('unstarted', 'backlog')
      order by s.category desc, s.position limit 1;
    end if;
    if new.sort_key is null then
      new.sort_key := app.sort_key_before(
        (select min(t.sort_key) from public.tasks t where t.team_id = new.team_id and t.deleted_at is null)
      );
    end if;
  else
    new.updated_at := now();
  end if;

  if tg_op = 'INSERT' or new.description is distinct from old.description then
    new.description_text := app.document_text(new.description);
  end if;

  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    category := app.status_category_of(new.status_id);
    new.completed_at := case when category = 'completed' then coalesce(new.completed_at, now()) end;
    new.canceled_at := case when category = 'canceled' then coalesce(new.canceled_at, now()) end;
  end if;

  -- Sub-tasks: no cycles, at most 3 levels including the task's own subtree.
  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    ancestor := new.parent_id;
    while ancestor is not null loop
      if ancestor = new.id then
        raise exception 'A task cannot be its own ancestor' using errcode = '23514';
      end if;
      select t.parent_id into ancestor from public.tasks t where t.id = ancestor;
      depth := depth + 1;
    end loop;

    with recursive subtree as (
      select t.id, 1 as level from public.tasks t where t.id = new.id
      union all
      select c.id, s.level + 1 from public.tasks c join subtree s on c.parent_id = s.id
    )
    select coalesce(max(level), 1) into subtree_height from subtree;

    if depth - 1 + subtree_height > 3 then
      raise exception 'Sub-tasks can be nested at most 3 levels deep' using errcode = '23514';
    end if;
  end if;

  return new;
end $$;

create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function app.task_before_write();

-- ---------------------------------------------------------------------------
-- Task children
-- ---------------------------------------------------------------------------

create table public.task_assignees (
  task_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id),
  foreign key (workspace_id, task_id) references public.tasks (workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id) on delete cascade
);

create index task_assignees_user_idx on public.task_assignees (user_id, task_id);

-- Assignees must be able to see the task's team (guests / private teams).
create function app.check_task_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.tasks t
    join public.teams tm on tm.id = t.team_id
    join public.workspace_members m on m.workspace_id = t.workspace_id and m.user_id = new.user_id
    where t.id = new.task_id
      and (
        (not tm.is_private and m.role <> 'guest')
        or exists (select 1 from public.team_members x where x.team_id = tm.id and x.user_id = new.user_id)
      )
  ) then
    raise exception 'This person cannot access the task''s team' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger task_assignees_check before insert on public.task_assignees
  for each row execute function app.check_task_assignee();

create table public.task_subscribers (
  task_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id),
  foreign key (workspace_id, task_id) references public.tasks (workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id) on delete cascade
);

create index task_subscribers_user_idx on public.task_subscribers (user_id);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  color text not null default 'gray'
    check (color in ('gray', 'red', 'orange', 'amber', 'lime', 'green', 'teal', 'blue', 'indigo', 'violet', 'pink')),
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create unique index labels_workspace_name_idx on public.labels (workspace_id, lower(name));

create table public.task_labels (
  task_id uuid not null,
  label_id uuid not null,
  workspace_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, label_id),
  foreign key (workspace_id, task_id) references public.tasks (workspace_id, id) on delete cascade,
  foreign key (workspace_id, label_id) references public.labels (workspace_id, id) on delete cascade
);

create index task_labels_label_idx on public.task_labels (label_id);

create table public.task_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  related_task_id uuid not null,
  kind public.relation_kind not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (task_id <> related_task_id),
  unique (task_id, related_task_id, kind),
  foreign key (workspace_id, task_id) references public.tasks (workspace_id, id) on delete cascade,
  foreign key (workspace_id, related_task_id) references public.tasks (workspace_id, id) on delete cascade
);

create index task_relations_related_idx on public.task_relations (related_task_id);

create function app.relation_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  -- "related" is symmetric: store one row per pair.
  if new.kind = 'related' and exists (
    select 1 from public.task_relations r
    where r.kind = 'related' and r.task_id = new.related_task_id and r.related_task_id = new.task_id
  ) then
    return null;
  end if;
  return new;
end $$;

create trigger task_relations_defaults before insert on public.task_relations
  for each row execute function app.relation_defaults();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_subscribers enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_relations enable row level security;
alter table public.projects force row level security;
alter table public.tasks force row level security;
alter table public.task_assignees force row level security;
alter table public.task_subscribers force row level security;
alter table public.labels force row level security;
alter table public.task_labels force row level security;
alter table public.task_relations force row level security;

create policy projects_select on public.projects for select to authenticated
  using (team_id in (select app.accessible_team_ids()));
create policy projects_insert on public.projects for insert to authenticated
  with check (
    team_id in (select app.accessible_team_ids())
    and workspace_id in (select app.full_member_workspace_ids())
  );
create policy projects_update on public.projects for update to authenticated
  using (team_id in (select app.accessible_team_ids()))
  with check (team_id in (select app.accessible_team_ids()));

create policy tasks_select on public.tasks for select to authenticated
  using (deleted_at is null and team_id in (select app.accessible_team_ids()));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (team_id in (select app.accessible_team_ids()));
create policy tasks_update on public.tasks for update to authenticated
  using (deleted_at is null and team_id in (select app.accessible_team_ids()))
  with check (team_id in (select app.accessible_team_ids()));

-- Children are visible and editable exactly when their task is (RLS on tasks
-- applies inside these subqueries).
create policy task_assignees_select on public.task_assignees for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_assignees_insert on public.task_assignees for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_assignees_delete on public.task_assignees for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_subscribers_select on public.task_subscribers for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_subscribers_insert on public.task_subscribers for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.tasks t where t.id = task_id));
create policy task_subscribers_delete on public.task_subscribers for delete to authenticated
  using (user_id = (select auth.uid()));

create policy labels_select on public.labels for select to authenticated
  using (workspace_id in (select app.member_workspace_ids()));
create policy labels_insert on public.labels for insert to authenticated
  with check (workspace_id in (select app.full_member_workspace_ids()));
create policy labels_update on public.labels for update to authenticated
  using (workspace_id in (select app.admin_workspace_ids()))
  with check (workspace_id in (select app.admin_workspace_ids()));
create policy labels_delete on public.labels for delete to authenticated
  using (workspace_id in (select app.admin_workspace_ids()));

create policy task_labels_select on public.task_labels for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_labels_insert on public.task_labels for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_labels_delete on public.task_labels for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_relations_select on public.task_relations for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id)
    and exists (select 1 from public.tasks t where t.id = related_task_id)
  );
create policy task_relations_insert on public.task_relations for insert to authenticated
  with check (
    exists (select 1 from public.tasks t where t.id = task_id)
    and exists (select 1 from public.tasks t where t.id = related_task_id)
  );
create policy task_relations_delete on public.task_relations for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

-- Column privileges: system-managed columns are never client-writable.
revoke insert, update on public.projects, public.tasks from authenticated;
grant insert (id, workspace_id, team_id, name, description, status, lead_id, start_date, target_date, sort_key)
  on public.projects to authenticated;
grant update (name, description, status, lead_id, start_date, target_date, sort_key, archived_at)
  on public.projects to authenticated;
grant insert (id, workspace_id, team_id, title, description, status_id, priority, project_id, parent_id,
              start_date, due_date, estimate, sort_key)
  on public.tasks to authenticated;
grant update (title, description, status_id, priority, project_id, parent_id, start_date, due_date,
              estimate, sort_key)
  on public.tasks to authenticated;
revoke update on public.task_assignees, public.task_subscribers, public.task_labels, public.task_relations
  from authenticated;
revoke insert on public.task_relations from authenticated;
grant insert (id, workspace_id, task_id, related_task_id, kind) on public.task_relations to authenticated;
revoke update on public.labels from authenticated;
grant update (name, color) on public.labels to authenticated;

-- ---------------------------------------------------------------------------
-- Soft delete and restore (with sub-tasks), undoable for 30 days
-- ---------------------------------------------------------------------------

create function public.delete_tasks(task_ids uuid[]) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  stamp timestamptz := clock_timestamp();
begin
  perform app.require_user();
  with recursive targets as (
    select t.id from public.tasks t
    where t.id = any (task_ids) and t.deleted_at is null
      and t.team_id in (select app.accessible_team_ids())
    union
    select c.id from public.tasks c join targets on c.parent_id = targets.id
    where c.deleted_at is null
  )
  update public.tasks t set deleted_at = stamp from targets where t.id = targets.id;
  return stamp;
end $$;

create function public.restore_tasks(task_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  restored integer;
begin
  perform app.require_user();
  -- Restores the given tasks and the sub-tasks deleted together with them.
  with roots as (
    select t.id, t.deleted_at from public.tasks t
    where t.id = any (task_ids) and t.deleted_at is not null
      and t.team_id in (select app.accessible_team_ids())
  ), targets as (
    with recursive tree as (
      select r.id, r.deleted_at from roots r
      union
      select c.id, tree.deleted_at from public.tasks c
      join tree on c.parent_id = tree.id and c.deleted_at = tree.deleted_at
    )
    select id from tree
  )
  update public.tasks t set deleted_at = null from targets where t.id = targets.id;
  get diagnostics restored = row_count;
  return restored;
end $$;

grant execute on function public.delete_tasks(uuid[]), public.restore_tasks(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: task and project changes go to the team topic
-- ---------------------------------------------------------------------------

create function app.broadcast_team_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_json jsonb := to_jsonb(coalesce(new, old));
  team uuid;
  entity_id uuid;
begin
  if tg_argv[0] = 'task' and tg_table_name <> 'tasks' then
    entity_id := (row_json ->> 'task_id')::uuid;
    select t.team_id into team from public.tasks t where t.id = entity_id;
  else
    entity_id := (row_json ->> 'id')::uuid;
    team := (row_json ->> 'team_id')::uuid;
  end if;
  if team is not null then
    perform app.broadcast('team:' || team, tg_argv[0], entity_id, tg_op);
  end if;
  return null;
end $$;

create trigger tasks_broadcast after insert or update or delete on public.tasks
  for each row execute function app.broadcast_team_change('task');
create trigger projects_broadcast after insert or update or delete on public.projects
  for each row execute function app.broadcast_team_change('project');
create trigger task_assignees_broadcast after insert or delete on public.task_assignees
  for each row execute function app.broadcast_team_change('task');
create trigger task_labels_broadcast after insert or delete on public.task_labels
  for each row execute function app.broadcast_team_change('task');
create trigger task_relations_broadcast after insert or delete on public.task_relations
  for each row execute function app.broadcast_team_change('task');
create trigger labels_broadcast after insert or update or delete on public.labels
  for each row execute function app.broadcast_workspace_change('label');
