-- Demo content, per-visitor demo sandboxes, and maintenance jobs (ADR-0006, ADR-0009, ADR-0012).
-- app.seed_demo_workspace() is the single source of demo data: used by local seed.sql,
-- the self-hosted DAIQ_SEED_DEMO option, and create_demo_workspace() for anonymous visitors.

create extension if not exists pg_cron;

create function app.doc(variadic paragraphs text[]) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('type', 'doc', 'content', coalesce(jsonb_agg(
    jsonb_build_object('type', 'paragraph', 'content',
      jsonb_build_array(jsonb_build_object('type', 'text', 'text', p)))
  ), '[]'::jsonb))
  from unnest(paragraphs) as p
$$;

-- Fictional teammates shared by all demo workspaces. They have no password and
-- an unroutable email, so nobody can sign in as them.
create function app.ensure_demo_personas() returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  personas uuid[] := array[
    '00000000-0000-4000-a000-00000000da01', '00000000-0000-4000-a000-00000000da02',
    '00000000-0000-4000-a000-00000000da03', '00000000-0000-4000-a000-00000000da04',
    '00000000-0000-4000-a000-00000000da05'
  ]::uuid[];
  names text[] := array['Ana Ruiz', 'Marco Bianchi', 'Priya Shah', 'Tomás Silva', 'Lea Novak'];
begin
  for i in 1..5 loop
    -- Token columns are '' rather than NULL: GoTrue cannot scan NULL strings.
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data,
                            banned_until, created_at, updated_at, confirmation_token, recovery_token,
                            email_change_token_new, email_change, email_change_token_current,
                            phone_change, phone_change_token, reauthentication_token)
    values (personas[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            lower(split_part(names[i], ' ', 1)) || '@personas.daiq.invalid',
            jsonb_build_object('display_name', names[i]), 'infinity', now(), now(),
            '', '', '', '', '', '', '', '')
    on conflict (id) do nothing;
  end loop;
  return personas;
end $$;

create function app.seed_demo_workspace(
  p_owner uuid, p_slug text, p_name text, p_is_demo boolean default true
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  people uuid[];
  ws uuid;
  eng uuid; mkt uuid; ops uuid;
  v_key text := 'a0';
  v_task uuid;
  rec record;
  ids jsonb := '{}'::jsonb;
begin
  people := array[p_owner] || app.ensure_demo_personas();  -- 1 owner, 2 Ana, 3 Marco, 4 Priya, 5 Tomás, 6 Lea

  insert into public.workspaces (name, slug, is_demo, created_by)
  values (p_name, p_slug, p_is_demo, p_owner) returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  select ws, u, case when u = p_owner then 'owner' when u = people[2] then 'admin' else 'member' end::public.workspace_role
  from unnest(people) as u;

  eng := (app.create_team(ws, 'Engineering', 'ENG', 'software', p_owner)).id;
  mkt := (app.create_team(ws, 'Marketing', 'MKT', 'marketing', p_owner)).id;
  ops := (app.create_team(ws, 'Operations', 'OPS', 'operations', p_owner)).id;

  insert into public.team_members (team_id, workspace_id, user_id)
  select t, ws, u from (values
    (eng, people[2]), (eng, people[3]), (eng, people[4]),
    (mkt, people[2]), (mkt, people[5]), (mkt, people[6]),
    (ops, people[4]), (ops, people[6])
  ) as v(t, u);

  insert into public.labels (workspace_id, name, color) values
    (ws, 'Bug', 'red'), (ws, 'Feature', 'indigo'), (ws, 'Improvement', 'blue'), (ws, 'Design', 'violet'),
    (ws, 'Docs', 'teal'), (ws, 'Customer', 'amber'), (ws, 'Infra', 'gray'), (ws, 'Content', 'pink');

  insert into public.projects (workspace_id, team_id, name, status, lead_id, start_date, target_date, created_by, description)
  values
    (ws, eng, 'Mobile app 2.0', 'active', people[3], current_date - 21, current_date + 30, people[3],
      app.doc('A faster, offline-capable mobile app with push notifications.', 'Ship to TestFlight by the end of the month.')),
    (ws, eng, 'Realtime sync', 'active', people[4], current_date - 14, current_date + 12, people[4],
      app.doc('Make every change appear on every screen within a second, and survive flaky connections.')),
    (ws, eng, 'Accessibility audit', 'planned', people[2], current_date + 7, current_date + 40, people[2],
      app.doc('WCAG 2.2 AA across the board, list and task views.')),
    (ws, mkt, 'Autumn launch campaign', 'active', people[5], current_date - 10, current_date + 10, people[5],
      app.doc('Launch week plan: blog post, Product Hunt, customer stories, social clips.')),
    (ws, mkt, 'Website refresh', 'planned', people[6], current_date + 14, current_date + 60, people[6], null),
    (ws, ops, 'Office move', 'active', people[6], current_date - 5, current_date + 21, people[6],
      app.doc('Move the team to the new office on the 3rd floor with zero downtime.')),
    (ws, ops, 'Vendor onboarding', 'paused', people[6], null, null, people[6], null);

  for rec in
    select * from (values
      -- team, title, status, priority, assignee (index in people, 0 = none), labels, project, due (days), description
      ('ENG', 'Offline mode for the task list', 'In Progress', 2, 4, '{Feature}', 'Realtime sync', 5,
        'Keep the last synced data available offline and replay edits on reconnect.'),
      ('ENG', 'Reconnect loses unsent comments', 'Todo', 1, 3, '{Bug}', 'Realtime sync', 1,
        'Steps: write a comment, toggle airplane mode, send. The comment disappears after reconnecting.'),
      ('ENG', 'Coalesce realtime events per entity', 'In Review', 3, 4, '{Improvement,Infra}', 'Realtime sync', null, null),
      ('ENG', 'Push notifications on iOS', 'Todo', 2, 3, '{Feature}', 'Mobile app 2.0', 12, null),
      ('ENG', 'Crash when opening a task from a widget', 'In Progress', 1, 3, '{Bug,Customer}', 'Mobile app 2.0', 0,
        'Reported by Northwind Logistics. Happens only after the task moved to another team.'),
      ('ENG', 'Dark mode contrast for status icons', 'Todo', 3, 2, '{Design}', 'Accessibility audit', 20, null),
      ('ENG', 'Keyboard focus lost after closing the task drawer', 'Backlog', 2, 1, '{Bug}', 'Accessibility audit', null, null),
      ('ENG', 'Screen reader labels for board columns', 'Backlog', 3, 2, '{Improvement}', 'Accessibility audit', null, null),
      ('ENG', 'Upgrade Postgres to 17.6', 'Done', 3, 4, '{Infra}', null, null, null),
      ('ENG', 'Rate limit invitation emails', 'Done', 2, 3, '{Infra}', null, null, null),
      ('ENG', 'Command palette: search people', 'In Progress', 3, 1, '{Feature}', null, 3, null),
      ('ENG', 'Flaky end-to-end test: board drag', 'Todo', 4, 4, '{Bug}', null, null, null),
      ('ENG', 'Document the self-hosting upgrade path', 'Backlog', 4, 2, '{Docs}', null, null, null),
      ('ENG', 'Remove legacy filter syntax', 'Canceled', 4, 3, '{Improvement}', null, null, null),
      ('ENG', 'Onboarding checklist for new workspaces', 'Backlog', 0, 0, '{Feature}', null, null, null),
      ('ENG', 'Bulk edit: set due date', 'Todo', 3, 1, '{Feature}', null, 8, null),
      ('MKT', 'Launch announcement blog post', 'In Progress', 2, 5, '{Content}', 'Autumn launch campaign', 4,
        'Angle: everything your team needs, nothing it doesn''t. Keep it under 900 words.'),
      ('MKT', 'Product Hunt launch page', 'Planned', 2, 6, '{Content}', 'Autumn launch campaign', 9, null),
      ('MKT', 'Customer story: Northwind Logistics', 'Review', 3, 5, '{Content,Customer}', 'Autumn launch campaign', 2, null),
      ('MKT', 'Pricing page copy review', 'Ideas', 3, 2, '{Content}', 'Website refresh', null, null),
      ('MKT', 'New homepage hero illustration', 'In Progress', 3, 2, '{Design}', 'Website refresh', 14, null),
      ('MKT', 'Newsletter: October roundup', 'Published', 4, 5, '{Content}', null, null, null),
      ('MKT', 'Webinar: moving from ClickUp in a day', 'Planned', 3, 1, '{Content}', null, 18, null),
      ('MKT', 'Social clips for launch week', 'Ideas', 0, 0, '{Content,Design}', 'Autumn launch campaign', null, null),
      ('MKT', 'SEO audit for the docs site', 'Canceled', 4, 6, '{}', null, null, null),
      ('OPS', 'Sign the lease for the new office', 'Waiting', 1, 6, '{}', 'Office move', 3,
        'Waiting on the landlord''s countersignature and our insurance certificate.'),
      ('OPS', 'Order standing desks', 'To Do', 3, 6, '{}', 'Office move', 10, null),
      ('OPS', 'Plan the moving day schedule', 'Doing', 2, 1, '{}', 'Office move', 6, null),
      ('OPS', 'Set up Wi-Fi and access control', 'Backlog', 2, 4, '{Infra}', 'Office move', 16, null),
      ('OPS', 'Security questionnaire for Contoso', 'Doing', 2, 6, '{Customer}', 'Vendor onboarding', 1, null),
      ('OPS', 'Renew design tool licenses', 'Done', 4, 6, '{}', null, null, null),
      ('OPS', 'Quarterly access review', 'To Do', 3, 1, '{Infra}', null, -2, null),
      ('OPS', 'Expense policy update', 'Backlog', 4, 0, '{Docs}', null, null, null)
    ) as t(team, title, status, priority, assignee, labels, project, due, description)
  loop
    v_key := app.sort_key_after(v_key);
    insert into public.tasks (workspace_id, team_id, title, status_id, priority, project_id, due_date,
                              description, sort_key, creator_id)
    select ws, tm.id, rec.title, s.id, rec.priority, p.id, current_date + rec.due,
           case when rec.description is not null then app.doc(rec.description) end,
           v_key, people[case when rec.assignee = 0 then 2 else rec.assignee end]
    from public.teams tm
    join public.statuses s on s.team_id = tm.id and s.name = rec.status
    left join public.projects p on p.team_id = tm.id and p.name = rec.project
    where tm.workspace_id = ws and tm.key = rec.team
    returning id into v_task;

    ids := ids || jsonb_build_object(rec.title, v_task);

    if rec.assignee > 0 then
      insert into public.task_assignees (task_id, workspace_id, user_id) values (v_task, ws, people[rec.assignee]);
    end if;
    insert into public.task_labels (task_id, label_id, workspace_id)
    select v_task, l.id, ws from public.labels l where l.workspace_id = ws and l.name = any (rec.labels::text[]);
  end loop;

  -- Sub-tasks
  for rec in
    select * from (values
      ('Plan the moving day schedule', 'OPS', 'Book movers', 'Done', 6),
      ('Plan the moving day schedule', 'OPS', 'Pack IT equipment', 'To Do', 4),
      ('Plan the moving day schedule', 'OPS', 'Send the moving-day email', 'To Do', 1),
      ('Offline mode for the task list', 'ENG', 'Persist the query cache in IndexedDB', 'Done', 4),
      ('Offline mode for the task list', 'ENG', 'Queue mutations while offline', 'In Progress', 4)
    ) as t(parent, team, title, status, assignee)
  loop
    v_key := app.sort_key_after(v_key);
    insert into public.tasks (workspace_id, team_id, title, status_id, parent_id, sort_key, creator_id)
    select ws, tm.id, rec.title, s.id, (ids ->> rec.parent)::uuid, v_key, people[rec.assignee]
    from public.teams tm join public.statuses s on s.team_id = tm.id and s.name = rec.status
    where tm.workspace_id = ws and tm.key = rec.team
    returning id into v_task;
    insert into public.task_assignees (task_id, workspace_id, user_id) values (v_task, ws, people[rec.assignee]);
  end loop;

  insert into public.task_relations (workspace_id, task_id, related_task_id, kind, created_by)
  select ws, (ids ->> a)::uuid, (ids ->> b)::uuid, k::public.relation_kind, people[2]
  from (values
    ('Reconnect loses unsent comments', 'Offline mode for the task list', 'blocks'),
    ('Sign the lease for the new office', 'Order standing desks', 'blocks'),
    ('Sign the lease for the new office', 'Set up Wi-Fi and access control', 'blocks'),
    ('Launch announcement blog post', 'Product Hunt launch page', 'related')
  ) as r(a, b, k);

  insert into public.comments (workspace_id, task_id, author_id, body, created_at)
  select ws, (ids ->> t)::uuid, people[a], app.doc(body), now() - make_interval(mins => m)
  from (values
    ('Crash when opening a task from a widget', 3, 'Reproduced on iOS 19.1: the widget keeps a stale task id after a team move.', 180),
    ('Crash when opening a task from a widget', 2, 'Northwind escalated this twice. Can we ship a fix before Friday?', 95),
    ('Launch announcement blog post', 5, 'First draft is in the description. Lea, can you review the headline options?', 240),
    ('Launch announcement blog post', 6, 'Option B reads best. Let''s avoid "revolutionary".', 200),
    ('Sign the lease for the new office', 6, 'The landlord is waiting on our insurance certificate.', 60),
    ('Offline mode for the task list', 4, 'Cache persistence is merged; the mutation queue is next.', 30)
  ) as c(t, a, body, m);

  -- A lived-in inbox for the workspace owner.
  insert into public.notifications (workspace_id, user_id, task_id, actor_id, kind, read_at, created_at)
  select ws, p_owner, (ids ->> t)::uuid, people[a], k, case when r then now() end, now() - make_interval(mins => m)
  from (values
    ('Command palette: search people', 2, 'assigned', false, 12),
    ('Plan the moving day schedule', 6, 'comment', false, 45),
    ('Quarterly access review', 4, 'status', false, 130),
    ('Customer story: Northwind Logistics', 5, 'mention', true, 600),
    ('Bulk edit: set due date', 3, 'assigned', true, 1440)
  ) as n(t, a, k, r, m);

  insert into public.task_subscribers (task_id, workspace_id, user_id)
  select (ids ->> t)::uuid, ws, p_owner
  from unnest(array['Crash when opening a task from a widget', 'Launch announcement blog post']) as t
  on conflict do nothing;

  return ws;
end $$;

-- One sandbox per visitor; anonymous sign-in is the expected caller (ADR-0006).
create function public.create_demo_workspace() returns public.workspaces
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_user();
  ws public.workspaces;
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

  select * into ws from public.workspaces
  where id = app.seed_demo_workspace(
    uid, 'demo-' || left(replace(gen_random_uuid()::text, '-', ''), 10), 'Daiquiri Demo Co.'
  );
  return ws;
end $$;

grant execute on function public.create_demo_workspace() to authenticated;

-- ---------------------------------------------------------------------------
-- Maintenance jobs
-- ---------------------------------------------------------------------------

create function app.cleanup_demo() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.workspaces where is_demo and created_at < now() - interval '24 hours';
  delete from auth.users u
  where u.is_anonymous and u.created_at < now() - interval '24 hours'
    and not exists (
      select 1 from public.workspace_members m
      join public.workspaces w on w.id = m.workspace_id
      where m.user_id = u.id and not w.is_demo
    );
end $$;

create function app.purge_trash() returns void
language sql security definer set search_path = '' as $$
  delete from public.tasks where deleted_at < now() - interval '30 days'
$$;

select cron.schedule('daiq-demo-cleanup', '7 * * * *', 'select app.cleanup_demo()');
select cron.schedule('daiq-purge-trash', '17 3 * * *', 'select app.purge_trash()');
