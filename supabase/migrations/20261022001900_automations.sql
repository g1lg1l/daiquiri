-- Automations (feature spec §12, ADR-0009): When <trigger> If <conditions>
-- Then <1-3 actions>, per team.
--
-- Row triggers put events in a queue table, only for teams with an enabled
-- automation for that kind of event. A pg_cron job drains the queue every ten
-- seconds and runs matching automations as the Automation actor, each in its
-- own subtransaction so a failing action rolls back that run alone and is
-- logged with its reason. Changes made by an automation can trigger others, up
-- to a chain of three, and never the same automation twice in one chain.
-- Automations do not notify anyone unless their action is "notify".

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  team_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  trigger jsonb not null check (
    jsonb_typeof(trigger) = 'object'
    and trigger ->> 'kind' in ('task_created', 'status_changed', 'priority_changed', 'assignee_added',
                               'moved_to_project', 'comment_added', 'due_approaching')),
  conditions jsonb not null default '{}' check (jsonb_typeof(conditions) = 'object'),
  actions jsonb not null check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) between 1 and 3),
  enabled boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade
);
create index automations_team_idx on public.automations (team_id, (trigger ->> 'kind')) where enabled;
create trigger automations_updated_at before update on public.automations
  for each row execute function app.set_updated_at();
create trigger automations_broadcast after insert or update or delete on public.automations
  for each row execute function app.broadcast_team_change('automation');

-- The queue: written by triggers, read by the runner, never by clients.
create table public.automation_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  team_id uuid not null,
  task_id uuid not null,
  kind text not null,
  data jsonb not null default '{}',
  depth integer not null default 0,
  chain uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.automation_runs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  automation_id uuid not null,
  task_id uuid references public.tasks (id) on delete set null,
  event text not null,
  -- One run per automation, task and due date for date triggers.
  event_key text,
  status text not null check (status in ('succeeded', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, automation_id) references public.automations (workspace_id, id) on delete cascade
);
create index automation_runs_automation_idx on public.automation_runs (automation_id, id desc);
create unique index automation_runs_event_key_idx on public.automation_runs (automation_id, task_id, event_key)
  where event_key is not null;
create index automation_runs_task_idx on public.automation_runs (task_id);
create trigger automation_runs_broadcast after insert on public.automation_runs
  for each row execute function app.broadcast_workspace_change('automation_run', 'automation_id');

-- Validation -----------------------------------------------------------------------

/** Ids in an automation must belong to its team or workspace (security definer: guests' visibility does not matter). */
create function app.validate_automation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  action jsonb;
  ids jsonb;
begin
  if new.trigger ? 'status_id' and not exists (
       select 1 from public.statuses s where s.id = (new.trigger ->> 'status_id')::uuid and s.team_id = new.team_id)
     or new.trigger ? 'project_id' and not exists (
       select 1 from public.projects p where p.id = (new.trigger ->> 'project_id')::uuid and p.team_id = new.team_id)
     or new.trigger ? 'user_id' and not exists (
       select 1 from public.workspace_members m where m.workspace_id = new.workspace_id
         and m.user_id = (new.trigger ->> 'user_id')::uuid)
     or coalesce((new.trigger ->> 'days')::integer, 0) not between 0 and 30 then
    raise exception 'The trigger refers to something outside this team' using errcode = '23514';
  end if;

  ids := coalesce(new.conditions -> 'label_ids', '[]');
  if exists (select 1 from jsonb_array_elements_text(ids) x
             where not exists (select 1 from public.labels l where l.id::text = x and l.workspace_id = new.workspace_id))
     or exists (select 1 from jsonb_array_elements_text(coalesce(new.conditions -> 'project_ids', '[]')) x
                where x <> 'none' and not exists (
                  select 1 from public.projects p where p.id::text = x and p.team_id = new.team_id)) then
    raise exception 'The conditions refer to something outside this team' using errcode = '23514';
  end if;

  for action in select * from jsonb_array_elements(new.actions) loop
    if not (case action ->> 'kind'
      when 'set_status' then exists (select 1 from public.statuses s
        where s.id = (action ->> 'status_id')::uuid and s.team_id = new.team_id)
      when 'set_priority' then (action ->> 'priority')::integer between 0 and 4
      when 'assign' then exists (select 1 from public.workspace_members m
        where m.workspace_id = new.workspace_id and m.user_id = (action ->> 'user_id')::uuid)
      when 'unassign' then true
      when 'add_label' then exists (select 1 from public.labels l
        where l.id = (action ->> 'label_id')::uuid and l.workspace_id = new.workspace_id)
      when 'remove_label' then exists (select 1 from public.labels l
        where l.id = (action ->> 'label_id')::uuid and l.workspace_id = new.workspace_id)
      when 'set_project' then action ->> 'project_id' is null or exists (select 1 from public.projects p
        where p.id = (action ->> 'project_id')::uuid and p.team_id = new.team_id)
      when 'set_due_date' then (action ->> 'days')::integer between 0 and 365
      when 'create_subtask' then exists (select 1 from public.templates t
        where t.id = (action ->> 'template_id')::uuid and t.team_id = new.team_id and t.kind = 'task')
      when 'notify' then jsonb_array_length(action -> 'user_ids') between 1 and 20
        and not exists (select 1 from jsonb_array_elements_text(action -> 'user_ids') x
          where not exists (select 1 from public.workspace_members m
            where m.workspace_id = new.workspace_id and m.user_id::text = x))
      else false
    end) then
      raise exception 'Invalid % action', coalesce(action ->> 'kind', 'unknown') using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;
create trigger automations_validate before insert or update on public.automations
  for each row execute function app.validate_automation();

-- Capturing events ------------------------------------------------------------------

create function app.automation_depth() returns integer
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('daiq.automation_depth', true), '')::integer, 0)
$$;

/** Queues an event when the team has an enabled automation for it and the chain is not too deep. */
create function app.enqueue_automation_event(
  p_workspace uuid, p_team uuid, p_task uuid, p_kind text, p_data jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.automation_depth() >= 3 or not exists (
    select 1 from public.automations a where a.team_id = p_team and a.enabled and a.trigger ->> 'kind' = p_kind
  ) then
    return;
  end if;
  insert into public.automation_events (workspace_id, team_id, task_id, kind, data, depth, chain)
  values (p_workspace, p_team, p_task, p_kind, p_data, app.automation_depth(),
          coalesce(string_to_array(nullif(current_setting('daiq.automation_chain', true), ''), ',')::uuid[], '{}'));
end $$;

create function app.task_automation_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform app.enqueue_automation_event(new.workspace_id, new.team_id, new.id, 'task_created', '{}');
  elsif new.deleted_at is null then
    if new.status_id is distinct from old.status_id then
      perform app.enqueue_automation_event(new.workspace_id, new.team_id, new.id, 'status_changed',
        jsonb_build_object('status_id', new.status_id));
    end if;
    if new.priority is distinct from old.priority then
      perform app.enqueue_automation_event(new.workspace_id, new.team_id, new.id, 'priority_changed',
        jsonb_build_object('priority', new.priority));
    end if;
    if new.project_id is distinct from old.project_id and new.project_id is not null then
      perform app.enqueue_automation_event(new.workspace_id, new.team_id, new.id, 'moved_to_project',
        jsonb_build_object('project_id', new.project_id));
    end if;
  end if;
  return null;
end $$;
create trigger tasks_automation_events after insert or update of status_id, priority, project_id on public.tasks
  for each row execute function app.task_automation_events();

create function app.child_automation_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.enqueue_automation_event(t.workspace_id, t.team_id, t.id,
    case tg_table_name when 'task_assignees' then 'assignee_added' else 'comment_added' end,
    -- Through jsonb: the two tables have different columns.
    case tg_table_name when 'task_assignees' then jsonb_build_object('user_id', to_jsonb(new) ->> 'user_id')
                       else jsonb_build_object('comment_id', to_jsonb(new) ->> 'id') end)
  from public.tasks t where t.id = new.task_id and t.deleted_at is null;
  return null;
end $$;
create trigger task_assignees_automation_events after insert on public.task_assignees
  for each row execute function app.child_automation_events();
create trigger comments_automation_events after insert on public.comments
  for each row execute function app.child_automation_events();

-- Running ---------------------------------------------------------------------------

create function app.automation_trigger_matches(p_trigger jsonb, p_data jsonb, t public.tasks) returns boolean
language sql stable set search_path = '' as $$
  select case p_trigger ->> 'kind'
    when 'status_changed' then
      (p_trigger ->> 'status_id' is null or p_trigger ->> 'status_id' = p_data ->> 'status_id')
      and (p_trigger ->> 'category' is null or p_trigger ->> 'category' =
           (select s.category::text from public.statuses s where s.id = (p_data ->> 'status_id')::uuid))
    when 'priority_changed' then p_trigger ->> 'priority' is null or p_trigger ->> 'priority' = p_data ->> 'priority'
    when 'assignee_added' then p_trigger ->> 'user_id' is null or p_trigger ->> 'user_id' = p_data ->> 'user_id'
    when 'moved_to_project' then p_trigger ->> 'project_id' is null or p_trigger ->> 'project_id' = p_data ->> 'project_id'
    else true
  end
$$;

/** Filters on the task as it is now: priorities, status categories, labels, projects, assignment. */
create function app.automation_conditions_match(c jsonb, t public.tasks) returns boolean
language sql stable set search_path = '' as $$
  select (coalesce(jsonb_array_length(c -> 'priorities'), 0) = 0 or c -> 'priorities' @> jsonb_build_array(t.priority))
     and (coalesce(jsonb_array_length(c -> 'categories'), 0) = 0 or c -> 'categories' ? (
           select s.category::text from public.statuses s where s.id = t.status_id))
     and (coalesce(jsonb_array_length(c -> 'label_ids'), 0) = 0 or exists (
           select 1 from public.task_labels l where l.task_id = t.id and c -> 'label_ids' ? l.label_id::text))
     and (coalesce(jsonb_array_length(c -> 'project_ids'), 0) = 0
          or c -> 'project_ids' ? coalesce(t.project_id::text, 'none'))
     and (c ->> 'assignee' is null
          or (c ->> 'assignee' = 'none') = not exists (select 1 from public.task_assignees a where a.task_id = t.id))
$$;

/** The action registry: one branch per kind (and a matching schema in @daiq/domain). */
create function app.automation_action(p_task uuid, p_action jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks;
  tpl public.templates;
begin
  select * into t from public.tasks x where x.id = p_task;
  case p_action ->> 'kind'
    when 'set_status' then
      update public.tasks set status_id = s.id
      from public.statuses s
      where tasks.id = t.id and s.id = (p_action ->> 'status_id')::uuid and s.team_id = t.team_id;
      if not found then raise exception 'The status no longer exists'; end if;
    when 'set_priority' then
      update public.tasks set priority = (p_action ->> 'priority')::smallint where id = t.id;
    when 'assign' then
      insert into public.task_assignees (task_id, workspace_id, user_id)
      select t.id, t.workspace_id, m.user_id from public.workspace_members m
      where m.workspace_id = t.workspace_id and m.user_id = (p_action ->> 'user_id')::uuid
      on conflict do nothing;
    when 'unassign' then
      delete from public.task_assignees where task_id = t.id;
    when 'add_label' then
      insert into public.task_labels (task_id, label_id, workspace_id)
      select t.id, l.id, t.workspace_id from public.labels l
      where l.id = (p_action ->> 'label_id')::uuid and l.workspace_id = t.workspace_id
      on conflict do nothing;
    when 'remove_label' then
      delete from public.task_labels where task_id = t.id and label_id = (p_action ->> 'label_id')::uuid;
    when 'set_project' then
      if p_action ->> 'project_id' is not null and not exists (
        select 1 from public.projects p where p.id = (p_action ->> 'project_id')::uuid and p.team_id = t.team_id) then
        raise exception 'The project no longer exists';
      end if;
      update public.tasks set project_id = (p_action ->> 'project_id')::uuid, milestone_id = null where id = t.id;
    when 'set_due_date' then
      update public.tasks set due_date = (now() at time zone 'utc')::date + (p_action ->> 'days')::integer
      where id = t.id;
    when 'create_subtask' then
      select * into tpl from public.templates x
      where x.id = (p_action ->> 'template_id')::uuid and x.team_id = t.team_id and x.kind = 'task';
      if not found then raise exception 'The template no longer exists'; end if;
      perform app.create_task_from_payload(t.team_id, tpl.payload, t.project_id, t.id, (now() at time zone 'utc')::date);
    when 'notify' then
      insert into public.notifications (workspace_id, user_id, task_id, kind)
      select t.workspace_id, m.user_id, t.id, 'automation' from public.workspace_members m
      where m.workspace_id = t.workspace_id
        and m.user_id::text in (select jsonb_array_elements_text(p_action -> 'user_ids'))
        and app.user_can_access_task(m.user_id, t.id);
      perform app.broadcast('user:' || x, 'notification', t.id, 'insert')
      from jsonb_array_elements_text(p_action -> 'user_ids') x;
    else
      raise exception 'Unknown action %', p_action ->> 'kind';
  end case;
end $$;

/** Runs one automation on one task and logs the outcome; failures roll back that run alone. */
create function app.run_automation(
  a public.automations, p_task uuid, p_event text, p_depth integer, p_chain uuid[], p_event_key text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  action jsonb;
begin
  perform set_config('daiq.automation', a.name, true);
  perform set_config('daiq.automation_depth', (p_depth + 1)::text, true);
  perform set_config('daiq.automation_chain', array_to_string(p_chain || a.id, ','), true);
  begin
    for action in select * from jsonb_array_elements(a.actions) loop
      perform app.automation_action(p_task, action);
    end loop;
    insert into public.automation_runs (workspace_id, automation_id, task_id, event, event_key, status)
    values (a.workspace_id, a.id, p_task, p_event, p_event_key, 'succeeded')
    on conflict do nothing;
  exception when others then
    insert into public.automation_runs (workspace_id, automation_id, task_id, event, event_key, status, error)
    values (a.workspace_id, a.id, p_task, p_event, p_event_key, 'failed', left(sqlerrm, 500))
    on conflict do nothing;
  end;
  perform set_config('daiq.automation', '', true);
  perform set_config('daiq.automation_depth', '', true);
  perform set_config('daiq.automation_chain', '', true);

  -- Keep the last 100 runs.
  delete from public.automation_runs r
  where r.automation_id = a.id
    and r.id <= (select x.id from public.automation_runs x where x.automation_id = a.id
                 order by x.id desc offset 100 limit 1);
end $$;

/** Drains the queue. Several passes, so a chain started by one change finishes in one go. */
create function app.run_automations() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  ev record;
  a public.automations;
  t public.tasks;
  ran integer := 0;
  drained integer;
begin
  for pass in 1 .. 4 loop
    drained := 0;
    for ev in
      with picked as (
        delete from public.automation_events
        where id in (select e.id from public.automation_events e order by e.id limit 500 for update skip locked)
        returning *
      )
      select * from picked order by id
    loop
      drained := drained + 1;
      select * into t from public.tasks x where x.id = ev.task_id and x.deleted_at is null;
      continue when not found;
      for a in
        select * from public.automations x
        where x.team_id = ev.team_id and x.enabled and x.trigger ->> 'kind' = ev.kind and not (x.id = any (ev.chain))
        order by x.created_at, x.id
      loop
        select * into t from public.tasks x where x.id = ev.task_id;
        if app.automation_trigger_matches(a.trigger, ev.data, t) and app.automation_conditions_match(a.conditions, t) then
          perform app.run_automation(a, t.id, ev.kind, ev.depth, ev.chain, null);
          ran := ran + 1;
        end if;
      end loop;
    end loop;
    exit when drained = 0;
  end loop;
  return ran;
end $$;

/** "Due date approaching": open tasks due in N days, once per task and due date. */
create function app.run_date_automations() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  ran integer := 0;
begin
  for r in
    select a, t.id as task_id, t.due_date
    from public.automations a
    join public.tasks t on t.team_id = a.team_id and t.deleted_at is null
      and t.completed_at is null and t.canceled_at is null
      and t.due_date = (now() at time zone 'utc')::date + coalesce((a.trigger ->> 'days')::integer, 0)
    where a.enabled and a.trigger ->> 'kind' = 'due_approaching'
      and app.automation_conditions_match(a.conditions, t)
      and not exists (select 1 from public.automation_runs x
                      where x.automation_id = a.id and x.task_id = t.id and x.event_key = 'due:' || t.due_date)
  loop
    perform app.run_automation(r.a, r.task_id, 'due_approaching', 0, '{}', 'due:' || r.due_date);
    ran := ran + 1;
  end loop;
  return ran;
end $$;

select cron.schedule('daiq-automations', '10 seconds', 'select app.run_automations()');
select cron.schedule('daiq-date-automations', '3 * * * *', 'select app.run_date_automations()');

-- The Automation actor -----------------------------------------------------------------

-- Activity written during a run names the automation.
create or replace function app.log_activity(
  p_workspace uuid, p_team uuid, p_task uuid, p_project uuid, p_kind text, p_data jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  new_id bigint;
  automation text := nullif(current_setting('daiq.automation', true), '');
begin
  insert into public.activity (workspace_id, team_id, task_id, project_id, actor_id, kind, data)
  values (p_workspace, p_team, p_task, p_project, auth.uid(), p_kind,
          coalesce(p_data, '{}') || case when automation is not null
                                         then jsonb_build_object('automation', automation) else '{}' end)
  returning id into new_id;
  return new_id;
end $$;

-- Automations never notify by themselves: only their "notify" action does.
create or replace function app.notify(
  p_user uuid, p_task uuid, p_kind text, p_comment uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.notifications;
begin
  if p_user is null or p_user = actor or not app.user_can_access_task(p_user, p_task)
     or nullif(current_setting('daiq.automation', true), '') is not null then
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

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('assigned', 'mention', 'comment', 'status', 'unblocked', 'automation'));

-- Access ----------------------------------------------------------------------------

alter table public.automations enable row level security;
alter table public.automations force row level security;
alter table public.automation_events enable row level security;
alter table public.automation_events force row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_runs force row level security;

-- The team sees its automations and their runs; admins and the team's members manage them.
create policy automations_select on public.automations for select to authenticated
  using (team_id in (select app.accessible_team_ids()));
create policy automations_insert on public.automations for insert to authenticated
  with check (app.can_manage_team(team_id));
create policy automations_update on public.automations for update to authenticated
  using (app.can_manage_team(team_id)) with check (app.can_manage_team(team_id));
create policy automations_delete on public.automations for delete to authenticated
  using (app.can_manage_team(team_id));
create policy automation_runs_select on public.automation_runs for select to authenticated
  using (automation_id in (select a.id from public.automations a));
-- automation_events: no policies, no grants.

revoke all on public.automation_events from anon, authenticated;
revoke insert, update, delete on public.automation_runs from anon, authenticated;
revoke insert, update on public.automations from authenticated;
grant insert (workspace_id, team_id, name, trigger, conditions, actions, enabled) on public.automations to authenticated;
grant update (name, trigger, conditions, actions, enabled) on public.automations to authenticated;
