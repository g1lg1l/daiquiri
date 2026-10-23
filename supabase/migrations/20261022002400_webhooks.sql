-- Outbound webhooks (feature spec §16, ADR-0009, threat model T11).
--
-- Workspace admins register https endpoints for task and comment events.
-- Row triggers queue deliveries; a pg_cron job signs each one (HMAC-SHA256
-- with a secret kept in Vault), posts it with pg_net, records the outcome and
-- retries failures with exponential backoff (six attempts).
--
-- SSRF: Postgres cannot resolve DNS, so the URL is held to https on port 443
-- with a DNS hostname (no IP literals, no localhost or internal-only names),
-- checked when saved and again when sent. pg_net verifies certificates, so a
-- request only completes against a server with a valid certificate for that
-- hostname: a name re-pointed at an internal address fails the TLS handshake.
-- Responses are never stored, only their status code.

create extension if not exists pg_net with schema extensions;

/** https://<dns name>[:443]/path, and nothing that points at the inside. */
create function app.is_safe_webhook_url(url text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    char_length(url) <= 2000
    and lower(url) ~ '^https://[a-z0-9-]+(\.[a-z0-9-]+)+(:443)?(/[^\s]*)?$'
    and lower(substring(url from '^https://([^/:]+)')) !~ '^[0-9.]+$'
    and lower(substring(url from '^https://([^/:]+)'))
        !~ '(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp|test|invalid|example|arpa)$',
    false)
$$;
-- Pure, and evaluated by the CHECK below as whoever writes the row.
grant execute on function app.is_safe_webhook_url(text) to authenticated;

create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  url text not null check (app.is_safe_webhook_url(url)),
  events text[] not null check (
    cardinality(events) between 1 and 4
    and events <@ array['task.created', 'task.updated', 'task.deleted', 'comment.created']),
  -- The signing secret lives in Vault.
  secret_id uuid not null,
  enabled boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index webhooks_workspace_idx on public.webhooks (workspace_id) where enabled;
create trigger webhooks_updated_at before update on public.webhooks
  for each row execute function app.set_updated_at();

create function app.drop_webhook_secret() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return null;
end $$;
create trigger webhooks_secret after delete on public.webhooks
  for each row execute function app.drop_webhook_secret();

create table public.webhook_deliveries (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  webhook_id uuid not null,
  event text not null,
  payload jsonb not null check (pg_column_size(payload) <= 65536),
  status text not null default 'pending' check (status in ('pending', 'sending', 'succeeded', 'failed')),
  attempts integer not null default 0,
  response_status integer,
  error text,
  request_id bigint,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  foreign key (workspace_id, webhook_id) references public.webhooks (workspace_id, id) on delete cascade
);
create index webhook_deliveries_due_idx on public.webhook_deliveries (next_attempt_at)
  where status in ('pending', 'sending');
create index webhook_deliveries_webhook_idx on public.webhook_deliveries (webhook_id, id desc);
create index webhook_deliveries_created_idx on public.webhook_deliveries (created_at);

alter table public.webhooks enable row level security;
alter table public.webhooks force row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.webhook_deliveries force row level security;

-- Admins only: webhooks see every team's tasks.
create policy webhooks_select on public.webhooks for select to authenticated
  using (workspace_id in (select app.admin_workspace_ids()));
create policy webhooks_update on public.webhooks for update to authenticated
  using (workspace_id in (select app.admin_workspace_ids()))
  with check (workspace_id in (select app.admin_workspace_ids()));
create policy webhooks_delete on public.webhooks for delete to authenticated
  using (workspace_id in (select app.admin_workspace_ids()));
create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated
  using (workspace_id in (select app.admin_workspace_ids()));

revoke insert, update on public.webhooks from authenticated;
revoke insert, update, delete on public.webhook_deliveries from authenticated;
revoke all on public.webhooks, public.webhook_deliveries from anon;
grant update (name, url, events, enabled) on public.webhooks to authenticated;

/** Creates a webhook and returns its signing secret, shown this once. */
create function public.create_webhook(workspace_id uuid, name text, url text, events text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hook_id uuid := gen_random_uuid();
  secret text := 'whsec_' || encode(extensions.gen_random_bytes(32), 'hex');
begin
  if create_webhook.workspace_id not in (select app.admin_workspace_ids()) then
    raise exception 'Only admins can add webhooks' using errcode = '42501';
  end if;
  -- The public demo must not send requests to arbitrary sites for strangers.
  if exists (select 1 from public.workspaces w where w.id = create_webhook.workspace_id and w.is_demo) then
    raise exception 'Demo workspaces cannot add webhooks' using errcode = '23514';
  end if;
  insert into public.webhooks (id, workspace_id, name, url, events, secret_id)
  values (hook_id, create_webhook.workspace_id, trim(create_webhook.name), trim(create_webhook.url),
          create_webhook.events, vault.create_secret(secret, 'daiq-webhook-' || hook_id));
  return jsonb_build_object('id', hook_id, 'secret', secret);
end $$;

/** Replaces a webhook's signing secret and returns the new one, shown this once. */
create function public.rotate_webhook_secret(webhook_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  hook public.webhooks;
  secret text := 'whsec_' || encode(extensions.gen_random_bytes(32), 'hex');
begin
  select * into hook from public.webhooks w
  where w.id = rotate_webhook_secret.webhook_id and w.workspace_id in (select app.admin_workspace_ids());
  if not found then
    raise exception 'Webhook not found' using errcode = 'P0002';
  end if;
  perform vault.update_secret(hook.secret_id, secret);
  return secret;
end $$;

-- Capturing events ------------------------------------------------------------------

/** The task fields a webhook sees. */
create function app.webhook_task(t public.tasks) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'identifier', tm.key || '-' || t.number, 'title', t.title,
    'team_id', t.team_id, 'status_id', t.status_id, 'status', s.name, 'priority', t.priority,
    'project_id', t.project_id, 'parent_id', t.parent_id, 'cycle_id', t.cycle_id,
    'start_date', t.start_date, 'due_date', t.due_date, 'estimate', t.estimate,
    'completed_at', t.completed_at, 'canceled_at', t.canceled_at,
    'created_at', t.created_at, 'updated_at', t.updated_at)
  from public.teams tm, public.statuses s
  where tm.id = t.team_id and s.id = t.status_id
$$;

create function app.enqueue_webhooks(p_workspace uuid, p_event text, p_payload jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.webhook_deliveries (workspace_id, webhook_id, event, payload)
  select w.workspace_id, w.id, p_event, p_payload from public.webhooks w
  where w.workspace_id = p_workspace and w.enabled and p_event = any (w.events)
$$;

create function app.task_webhook_events() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  current jsonb;
  previous jsonb;
begin
  if not exists (select 1 from public.webhooks w where w.workspace_id = new.workspace_id and w.enabled) then
    return null;
  end if;
  current := app.webhook_task(new);
  if tg_op = 'INSERT' then
    perform app.enqueue_webhooks(new.workspace_id, 'task.created', jsonb_build_object('task', current));
  elsif old.deleted_at is null and new.deleted_at is not null then
    perform app.enqueue_webhooks(new.workspace_id, 'task.deleted', jsonb_build_object('task', current));
  elsif new.deleted_at is null then
    -- Previous values of the fields that changed.
    select jsonb_object_agg(key, value) into previous
    from jsonb_each(app.webhook_task(old)) o
    where o.value is distinct from current -> o.key and o.key <> 'updated_at';
    if previous is not null then
      perform app.enqueue_webhooks(new.workspace_id, 'task.updated',
        jsonb_build_object('task', current, 'previous', previous));
    end if;
  end if;
  return null;
end $$;
create trigger tasks_webhook_events after insert or update on public.tasks
  for each row execute function app.task_webhook_events();

create function app.comment_webhook_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.webhooks w where w.workspace_id = new.workspace_id and w.enabled) then
    perform app.enqueue_webhooks(new.workspace_id, 'comment.created', jsonb_build_object('comment',
      jsonb_build_object('id', new.id, 'task_id', new.task_id, 'author_id', new.author_id,
                         'text', left(app.document_text(new.body), 10000), 'created_at', new.created_at)));
  end if;
  return null;
end $$;
create trigger comments_webhook_events after insert on public.comments
  for each row execute function app.comment_webhook_events();

/** Queues a test delivery ("ping"), whatever events the webhook listens to. */
create function public.ping_webhook(webhook_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.webhook_deliveries (workspace_id, webhook_id, event, payload)
  select w.workspace_id, w.id, 'ping', jsonb_build_object('message', 'Hello from Daiquiri')
  from public.webhooks w
  where w.id = ping_webhook.webhook_id and w.workspace_id in (select app.admin_workspace_ids());
  if not found then
    raise exception 'Webhook not found' using errcode = 'P0002';
  end if;
end $$;

grant execute on function public.create_webhook(uuid, text, text, text[]),
  public.rotate_webhook_secret(uuid), public.ping_webhook(uuid) to authenticated;

-- Sending ---------------------------------------------------------------------------

/**
 * Records finished requests, then signs and sends what is due. Signature:
 * Daiquiri-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>.
 */
create function app.run_webhooks() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  d record;
  stamp text;
  body jsonb;
  sent integer := 0;
begin
  -- Outcomes of earlier sends. A request without an answer after two minutes failed.
  for d in
    select x.id, x.attempts, r.status_code, r.error_msg, r.timed_out, x.request_id
    from public.webhook_deliveries x
    left join net._http_response r on r.id = x.request_id
    where x.status = 'sending'
      and (r.id is not null or x.next_attempt_at < now() - interval '2 minutes')
    for update of x skip locked
  loop
    if d.status_code between 200 and 299 then
      update public.webhook_deliveries
      set status = 'succeeded', response_status = d.status_code, error = null, delivered_at = now()
      where id = d.id;
    else
      update public.webhook_deliveries
      set status = case when d.attempts >= 6 then 'failed' else 'pending' end,
          response_status = d.status_code,
          error = left(coalesce(case when d.timed_out then 'Timed out' end, d.error_msg,
                                case when d.status_code is not null then 'HTTP ' || d.status_code end,
                                'No response'), 300),
          next_attempt_at = now() + make_interval(mins => power(2, d.attempts)::integer)
      where id = d.id;
    end if;
  end loop;

  for d in
    select x.id, x.event, x.payload, x.created_at, w.url, w.secret_id
    from public.webhook_deliveries x
    join public.webhooks w on w.id = x.webhook_id and w.enabled
    where x.status = 'pending' and x.next_attempt_at <= now()
    order by x.id
    limit 100
    for update of x skip locked
  loop
    if not app.is_safe_webhook_url(d.url) then
      update public.webhook_deliveries set status = 'failed', error = 'The URL is not allowed' where id = d.id;
      continue;
    end if;
    stamp := extract(epoch from now())::bigint::text;
    body := jsonb_build_object('id', d.id, 'event', d.event, 'created_at', d.created_at, 'data', d.payload);
    update public.webhook_deliveries
    set status = 'sending', attempts = attempts + 1, next_attempt_at = now(),
        request_id = net.http_post(
          d.url, body, '{}'::jsonb,
          jsonb_build_object(
            'Content-Type', 'application/json',
            'User-Agent', 'Daiquiri-Webhooks/1',
            'Daiquiri-Event', d.event,
            'Daiquiri-Delivery', d.id::text,
            -- pg_net sends body::text, so this is the exact byte string that is signed.
            'Daiquiri-Signature', 't=' || stamp || ',v1=' || encode(extensions.hmac(
              stamp || '.' || body::text,
              (select s.decrypted_secret from vault.decrypted_secrets s where s.id = d.secret_id),
              'sha256'), 'hex')),
          5000)
    where id = d.id;
    sent := sent + 1;
  end loop;

  -- Two weeks of history is enough to debug an endpoint.
  delete from public.webhook_deliveries where created_at < now() - interval '14 days';
  return sent;
end $$;

select cron.schedule('daiq-webhooks', '10 seconds', 'select app.run_webhooks()');

-- Automations can call a webhook ------------------------------------------------------

create function app.automation_webhook(p_task uuid, p_webhook uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks x where x.id = p_task;
  insert into public.webhook_deliveries (workspace_id, webhook_id, event, payload)
  select w.workspace_id, w.id, 'automation',
         jsonb_build_object('automation', nullif(current_setting('daiq.automation', true), ''),
                            'task', app.webhook_task(t))
  from public.webhooks w where w.id = p_webhook and w.workspace_id = t.workspace_id and w.enabled;
  if not found then
    raise exception 'The webhook no longer exists or is turned off';
  end if;
end $$;


-- The automation registry gains "call webhook" (validated against the workspace).
create or replace function app.validate_automation() returns trigger
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
      when 'call_webhook' then exists (select 1 from public.webhooks w
        where w.id = (action ->> 'webhook_id')::uuid and w.workspace_id = new.workspace_id)
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

create or replace function app.automation_action(p_task uuid, p_action jsonb) returns void
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
    when 'call_webhook' then
      perform app.automation_webhook(t.id, (p_action ->> 'webhook_id')::uuid);
    else
      raise exception 'Unknown action %', p_action ->> 'kind';
  end case;
end $$;
