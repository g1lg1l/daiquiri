-- Daiq collaboration: comments, reactions, activity history, subscriptions, notifications.
-- See docs/architecture/database-model.md §4.2–4.3.

-- Can an arbitrary user (not the caller) access a task? Used when fanning out
-- notifications and subscriptions so nobody is notified about what they cannot read.
create function app.user_can_access_task(p_user uuid, p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tasks t
    join public.teams tm on tm.id = t.team_id
    join public.workspace_members m on m.workspace_id = t.workspace_id and m.user_id = p_user
    where t.id = p_task
      and t.deleted_at is null
      and (
        (not tm.is_private and m.role <> 'guest')
        or exists (select 1 from public.team_members x where x.team_id = tm.id and x.user_id = p_user)
      )
  )
$$;

create function app.subscribe(p_task uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is not null and app.user_can_access_task(p_user, p_task) then
    insert into public.task_subscribers (task_id, workspace_id, user_id)
    select t.id, t.workspace_id, p_user from public.tasks t where t.id = p_task
    on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Comments and reactions
-- ---------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body jsonb not null check (app.is_document(body)),
  body_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  foreign key (workspace_id, task_id) references public.tasks (workspace_id, id) on delete cascade
);

create index comments_task_idx on public.comments (task_id, created_at);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index comments_author_idx on public.comments (author_id);

create function app.comment_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := coalesce(new.author_id, auth.uid());
    if new.parent_id is not null and not exists (
      select 1 from public.comments p
      where p.id = new.parent_id and p.task_id = new.task_id and p.parent_id is null
    ) then
      raise exception 'Replies must belong to a top-level comment on the same task' using errcode = '23514';
    end if;
  else
    new.updated_at := now();
    if new.body is distinct from old.body then new.edited_at := now(); end if;
  end if;

  if new.deleted_at is not null then
    new.body := '{"type":"doc","content":[]}'::jsonb;
  end if;
  new.body_text := app.document_text(new.body);
  return new;
end $$;

create trigger comments_before_write before insert or update on public.comments
  for each row execute function app.comment_before_write();

create table public.comment_reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

create index comment_reactions_user_idx on public.comment_reactions (user_id);

-- ---------------------------------------------------------------------------
-- Activity (append-only history, written only by triggers)
-- ---------------------------------------------------------------------------

create table public.activity (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_task_idx on public.activity (task_id, id desc) where task_id is not null;
create index activity_project_idx on public.activity (project_id, id desc) where project_id is not null;
create index activity_workspace_idx on public.activity (workspace_id, id desc);
create index activity_team_idx on public.activity (team_id);
create index activity_actor_idx on public.activity (actor_id);

create function app.log_activity(
  p_workspace uuid, p_team uuid, p_task uuid, p_project uuid, p_kind text, p_data jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  new_id bigint;
begin
  insert into public.activity (workspace_id, team_id, task_id, project_id, actor_id, kind, data)
  values (p_workspace, p_team, p_task, p_project, auth.uid(), p_kind, coalesce(p_data, '{}'))
  returning id into new_id;
  return new_id;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  task_id uuid references public.tasks (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('assigned', 'mention', 'comment', 'status', 'unblocked')),
  event_count integer not null default 1,
  read_at timestamptz,
  snoozed_until timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id) on delete cascade
);

create index notifications_inbox_idx on public.notifications (user_id, created_at desc)
  where archived_at is null;
create index notifications_task_idx on public.notifications (task_id);
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_comment_idx on public.notifications (comment_id);

-- Importance used when coalescing several events on the same task.
create function app.notification_rank(kind text) returns integer
language sql immutable set search_path = '' as $$
  select case kind when 'mention' then 5 when 'assigned' then 4 when 'unblocked' then 3
                   when 'comment' then 2 else 1 end
$$;

-- Creates (or coalesces into a recent unread) notification. Never notifies the
-- actor, and never notifies someone who cannot read the task.
create function app.notify(
  p_user uuid, p_task uuid, p_kind text, p_comment uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.notifications;
begin
  if p_user is null or p_user = actor or not app.user_can_access_task(p_user, p_task) then
    return;
  end if;

  select * into existing from public.notifications n
  where n.user_id = p_user and n.task_id = p_task
    and n.read_at is null and n.archived_at is null
    and n.created_at > now() - interval '2 minutes'
  order by n.created_at desc limit 1
  for update;

  if found then
    update public.notifications n set
      event_count = n.event_count + 1,
      actor_id = actor,
      created_at = now(),
      kind = case when app.notification_rank(p_kind) >= app.notification_rank(n.kind) then p_kind else n.kind end,
      comment_id = coalesce(p_comment, n.comment_id)
    where n.id = existing.id;
  else
    insert into public.notifications (workspace_id, user_id, task_id, comment_id, actor_id, kind)
    select t.workspace_id, p_user, p_task, p_comment, actor, p_kind from public.tasks t where t.id = p_task;
  end if;

  perform app.broadcast('user:' || p_user, 'notification', p_task, 'insert');
end $$;

create function app.notify_subscribers(p_task uuid, p_kind text, p_comment uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  subscriber uuid;
begin
  for subscriber in select s.user_id from public.task_subscribers s where s.task_id = p_task loop
    perform app.notify(subscriber, p_task, p_kind, p_comment);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Task history + notification triggers
-- ---------------------------------------------------------------------------

create function app.task_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  -- Linear-style folding: the creator's edits in the first 3 minutes are part of creation.
  folded boolean := tg_op = 'UPDATE' and actor is not null and actor = new.creator_id
                    and new.created_at > now() - interval '3 minutes';
  old_status public.statuses;
  new_status public.statuses;
  mentioned uuid;
  blocked record;
begin
  if tg_op = 'INSERT' then
    perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id, 'task.created',
      jsonb_build_object('title', new.title));
    perform app.subscribe(new.id, new.creator_id);
    foreach mentioned in array app.document_mentions(new.description) loop
      perform app.subscribe(new.id, mentioned);
      perform app.notify(mentioned, new.id, 'mention');
    end loop;
    return null;
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id,
      case when new.deleted_at is null then 'task.restored' else 'task.deleted' end, '{}');
    return null;
  end if;

  if new.status_id is distinct from old.status_id then
    select * into old_status from public.statuses where id = old.status_id;
    select * into new_status from public.statuses where id = new.status_id;
    if not folded then
      perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id, 'task.status_changed',
        jsonb_build_object('from', old_status.name, 'to', new_status.name,
                           'from_category', old_status.category, 'to_category', new_status.category));
    end if;
    perform app.notify_subscribers(new.id, 'status');

    -- Unblock: notify assignees of tasks whose last open blocker just closed.
    if new_status.category in ('completed', 'canceled') then
      for blocked in
        select r.related_task_id as task_id from public.task_relations r
        where r.task_id = new.id and r.kind = 'blocks'
          and not exists (
            select 1 from public.task_relations other
            join public.tasks bt on bt.id = other.task_id
            where other.related_task_id = r.related_task_id and other.kind = 'blocks'
              and other.task_id <> new.id and bt.completed_at is null and bt.canceled_at is null
              and bt.deleted_at is null
          )
      loop
        perform app.notify(a.user_id, blocked.task_id, 'unblocked')
        from public.task_assignees a where a.task_id = blocked.task_id;
      end loop;
    end if;
  end if;

  if not folded then
    if new.priority is distinct from old.priority then
      perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id, 'task.priority_changed',
        jsonb_build_object('from', old.priority, 'to', new.priority));
    end if;
    if new.title is distinct from old.title then
      perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id, 'task.renamed',
        jsonb_build_object('from', old.title, 'to', new.title));
    end if;
    if new.project_id is distinct from old.project_id then
      perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id, 'task.project_changed',
        jsonb_build_object(
          'from', (select p.name from public.projects p where p.id = old.project_id),
          'to', (select p.name from public.projects p where p.id = new.project_id)));
    end if;
    if new.due_date is distinct from old.due_date then
      perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id, 'task.due_date_changed',
        jsonb_build_object('from', old.due_date, 'to', new.due_date));
    end if;
    if new.parent_id is distinct from old.parent_id then
      perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id, 'task.parent_changed',
        jsonb_build_object('from', old.parent_id, 'to', new.parent_id));
    end if;
    -- Description edits by the same person within 10 minutes collapse into one entry.
    if new.description is distinct from old.description and not exists (
      select 1 from public.activity a
      where a.task_id = new.id and a.kind = 'task.description_changed' and a.actor_id = actor
        and a.created_at > now() - interval '10 minutes'
    ) then
      perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id,
        'task.description_changed', '{}');
    end if;
  end if;

  if new.description is distinct from old.description then
    foreach mentioned in array app.document_mentions(new.description) loop
      if not mentioned = any (app.document_mentions(old.description)) then
        perform app.subscribe(new.id, mentioned);
        perform app.notify(mentioned, new.id, 'mention');
      end if;
    end loop;
  end if;

  return null;
end $$;

create trigger tasks_after_write after insert or update on public.tasks
  for each row execute function app.task_after_write();

create function app.assignee_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec public.task_assignees := coalesce(new, old);
  t public.tasks;
begin
  select * into t from public.tasks where id = rec.task_id;
  if not found then return null; end if;

  perform app.log_activity(t.workspace_id, t.team_id, t.id, t.project_id,
    case when tg_op = 'INSERT' then 'task.assignee_added' else 'task.assignee_removed' end,
    jsonb_build_object('user_id', rec.user_id));

  if tg_op = 'INSERT' then
    perform app.subscribe(t.id, rec.user_id);
    perform app.notify(rec.user_id, t.id, 'assigned');
  end if;
  return null;
end $$;

create trigger task_assignees_after_write after insert or delete on public.task_assignees
  for each row execute function app.assignee_after_write();

create function app.comment_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks;
  mentioned uuid;
  mentions uuid[] := app.document_mentions(new.body);
begin
  select * into t from public.tasks where id = new.task_id;
  perform app.log_activity(t.workspace_id, t.team_id, t.id, t.project_id, 'comment.created',
    jsonb_build_object('comment_id', new.id));
  perform app.subscribe(t.id, new.author_id);
  foreach mentioned in array mentions loop
    perform app.subscribe(t.id, mentioned);
    perform app.notify(mentioned, t.id, 'mention', new.id);
  end loop;
  perform app.notify(s.user_id, t.id, 'comment', new.id)
  from public.task_subscribers s
  where s.task_id = t.id and not s.user_id = any (mentions);
  return null;
end $$;

create trigger comments_after_insert after insert on public.comments
  for each row execute function app.comment_after_insert();

-- Realtime for comments and reactions: entity "comment" on the team topic.
create function app.broadcast_comment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_json jsonb := to_jsonb(coalesce(new, old));
  comment uuid := coalesce((row_json ->> 'comment_id')::uuid, (row_json ->> 'id')::uuid);
  team uuid;
begin
  select t.team_id into team
  from public.comments c join public.tasks t on t.id = c.task_id
  where c.id = comment;
  if team is not null then
    perform app.broadcast('team:' || team, 'comment', comment, tg_op);
  end if;
  return null;
end $$;

create trigger comments_broadcast after insert or update on public.comments
  for each row execute function app.broadcast_comment_change();
create trigger comment_reactions_broadcast after insert or delete on public.comment_reactions
  for each row execute function app.broadcast_comment_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.comments enable row level security;
alter table public.comment_reactions enable row level security;
alter table public.activity enable row level security;
alter table public.notifications enable row level security;
alter table public.comments force row level security;
alter table public.comment_reactions force row level security;
alter table public.activity force row level security;
alter table public.notifications force row level security;

create policy comments_select on public.comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.tasks t where t.id = task_id));
create policy comments_update on public.comments for update to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_id)
    and (author_id = (select auth.uid()) or workspace_id in (select app.admin_workspace_ids()))
  )
  with check (exists (select 1 from public.tasks t where t.id = task_id));

create policy comment_reactions_select on public.comment_reactions for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));
create policy comment_reactions_insert on public.comment_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.comments c where c.id = comment_id));
create policy comment_reactions_delete on public.comment_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy activity_select on public.activity for select to authenticated
  using (
    case
      when task_id is not null then exists (select 1 from public.tasks t where t.id = task_id)
      when project_id is not null then exists (select 1 from public.projects p where p.id = project_id)
      else workspace_id in (select app.admin_workspace_ids())
    end
  );

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke insert, update, delete on public.activity, public.notifications from authenticated;
grant update (read_at, snoozed_until, archived_at) on public.notifications to authenticated;
revoke update on public.comments, public.comment_reactions from authenticated;
grant update (body, deleted_at) on public.comments to authenticated;
revoke insert on public.comments from authenticated;
grant insert (id, workspace_id, task_id, parent_id, body) on public.comments to authenticated;
