-- Templates (feature spec §3.8): a task with its sub-tasks, or a project with
-- its milestones and tasks, saved for reuse. Dates are stored as day offsets
-- from the task's creation or the project's start, and land relative to the
-- day the template is used. Every function runs as the caller, so RLS decides
-- what can be saved and created.

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  team_id uuid not null,
  kind text not null check (kind in ('task', 'project')),
  name text not null check (char_length(trim(name)) between 1 and 80),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 262144),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade
);
create index templates_team_idx on public.templates (team_id);
create trigger templates_updated_at before update on public.templates
  for each row execute function app.set_updated_at();
create trigger templates_broadcast after insert or update or delete on public.templates
  for each row execute function app.broadcast_workspace_change('template');

alter table public.templates enable row level security;
alter table public.templates force row level security;

-- Anyone on the team uses its templates; members (not guests) save them;
-- their author or an admin renames and deletes them.
create policy templates_select on public.templates for select to authenticated
  using (team_id in (select app.accessible_team_ids()));
create policy templates_insert on public.templates for insert to authenticated
  with check (team_id in (select app.accessible_team_ids())
              and workspace_id in (select app.full_member_workspace_ids())
              and created_by = (select auth.uid()));
create policy templates_update on public.templates for update to authenticated
  using (team_id in (select app.accessible_team_ids())
         and (created_by = (select auth.uid()) or workspace_id in (select app.admin_workspace_ids())))
  with check (team_id in (select app.accessible_team_ids()));
create policy templates_delete on public.templates for delete to authenticated
  using (team_id in (select app.accessible_team_ids())
         and (created_by = (select auth.uid()) or workspace_id in (select app.admin_workspace_ids())));

revoke insert, update on public.templates from authenticated;
grant insert (workspace_id, team_id, kind, name, payload) on public.templates to authenticated;
grant update (name) on public.templates to authenticated;

-- Saving --------------------------------------------------------------------------

/** One task as template data; dates become offsets from p_base. */
create function app.task_template_payload(t public.tasks, p_base date) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'title', t.title,
    'description', t.description,
    'priority', t.priority,
    'estimate', t.estimate,
    'start_offset', t.start_date - p_base,
    'due_offset', t.due_date - p_base,
    'assignee_ids', (select coalesce(jsonb_agg(a.user_id), '[]') from public.task_assignees a where a.task_id = t.id),
    'label_ids', (select coalesce(jsonb_agg(l.label_id), '[]') from public.task_labels l where l.task_id = t.id),
    'fields', (select coalesce(jsonb_object_agg(v.field_id, v.value), '{}') from public.task_field_values v where v.task_id = t.id),
    'subtasks', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'title', s.title, 'priority', s.priority, 'estimate', s.estimate,
               'start_offset', s.start_date - p_base, 'due_offset', s.due_date - p_base,
               'assignee_ids', (select coalesce(jsonb_agg(a.user_id), '[]') from public.task_assignees a where a.task_id = s.id),
               'label_ids', (select coalesce(jsonb_agg(l.label_id), '[]') from public.task_labels l where l.task_id = s.id)
             ) order by s.sort_key, s.id), '[]')
      from public.tasks s where s.parent_id = t.id and s.deleted_at is null and s.canceled_at is null
    )
  )
$$;
grant execute on function app.task_template_payload(public.tasks, date) to authenticated;

create function public.save_task_template(task_id uuid, name text) returns public.templates
language plpgsql security invoker set search_path = '' as $$
declare
  t public.tasks;
  saved public.templates;
begin
  select * into t from public.tasks x where x.id = save_task_template.task_id and x.deleted_at is null;
  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  insert into public.templates (workspace_id, team_id, kind, name, payload)
  values (t.workspace_id, t.team_id, 'task', trim(save_task_template.name),
          app.task_template_payload(t, (t.created_at at time zone 'utc')::date))
  returning * into saved;
  return saved;
end $$;
grant execute on function public.save_task_template(uuid, text) to authenticated;

create function public.save_project_template(project_id uuid, name text) returns public.templates
language plpgsql security invoker set search_path = '' as $$
declare
  p public.projects;
  base date;
  saved public.templates;
begin
  select * into p from public.projects x where x.id = save_project_template.project_id;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
  base := coalesce(p.start_date, (p.created_at at time zone 'utc')::date);
  insert into public.templates (workspace_id, team_id, kind, name, payload)
  values (p.workspace_id, p.team_id, 'project', trim(save_project_template.name), jsonb_build_object(
    'description', p.description,
    'target_offset', p.target_date - base,
    'milestones', (
      select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'target_offset', m.target_date - base)
                                order by m.sort_key, m.id), '[]')
      from public.milestones m where m.project_id = p.id),
    'tasks', (
      select coalesce(jsonb_agg(app.task_template_payload(t, base) || jsonb_build_object('milestone_id', t.milestone_id)
                                order by t.sort_key, t.id), '[]')
      from public.tasks t
      where t.project_id = p.id and t.parent_id is null and t.deleted_at is null and t.canceled_at is null)
  ))
  returning * into saved;
  return saved;
end $$;
grant execute on function public.save_project_template(uuid, text) to authenticated;

-- Using ---------------------------------------------------------------------------

-- Pure helpers, for ordering what a template creates.
grant execute on function app.sort_key_after(text), app.sort_key_increment(text),
  app.sort_key_integer_length(text) to authenticated;

/**
 * Creates one task (and its sub-tasks) from template data. People who left
 * the workspace, deleted labels, fields the team no longer uses and values
 * that no longer fit their field are dropped rather than failing the task.
 */
create function app.create_task_from_payload(
  p_team uuid, p jsonb, p_project uuid, p_parent uuid, p_base date
) returns public.tasks
language plpgsql security invoker set search_path = '' as $$
declare
  ws uuid;
  created public.tasks;
  field record;
  sub jsonb;
begin
  select tm.workspace_id into ws from public.teams tm where tm.id = p_team;
  created := public.create_task(
    null, p_team, p ->> 'title', null, coalesce((p ->> 'priority')::smallint, 0::smallint), p_project, p_parent,
    p_base + (p ->> 'start_offset')::integer, p_base + (p ->> 'due_offset')::integer,
    case when jsonb_typeof(p -> 'description') = 'object' then p -> 'description' end, null,
    array(select m.user_id from public.workspace_members m
          where m.workspace_id = ws
            and m.user_id::text in (select jsonb_array_elements_text(coalesce(p -> 'assignee_ids', '[]')))),
    array(select l.id from public.labels l
          where l.workspace_id = ws
            and l.id::text in (select jsonb_array_elements_text(coalesce(p -> 'label_ids', '[]')))),
    null, (p ->> 'estimate')::smallint);

  for field in
    select f.key::uuid as field_id, f.value
    from jsonb_each(case when jsonb_typeof(p -> 'fields') = 'object' then p -> 'fields' else '{}' end) f
    join public.team_custom_fields tf on tf.team_id = p_team and tf.field_id::text = f.key
  loop
    begin
      insert into public.task_field_values (task_id, field_id, workspace_id, value)
      values (created.id, field.field_id, ws, field.value);
    exception when check_violation then
      null;
    end;
  end loop;

  -- New tasks go on top, so the last one first keeps the template's order.
  for sub in
    select s.value from jsonb_array_elements(coalesce(p -> 'subtasks', '[]')) with ordinality s
    order by s.ordinality desc
  loop
    perform app.create_task_from_payload(p_team, sub, p_project, created.id, p_base);
  end loop;
  return created;
end $$;
grant execute on function app.create_task_from_payload(uuid, jsonb, uuid, uuid, date) to authenticated;

create function public.create_task_from_template(template_id uuid, project_id uuid default null)
returns public.tasks
language plpgsql security invoker set search_path = '' as $$
declare
  tpl public.templates;
begin
  select * into tpl from public.templates x where x.id = create_task_from_template.template_id and x.kind = 'task';
  if not found then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;
  return app.create_task_from_payload(tpl.team_id, tpl.payload, create_task_from_template.project_id, null,
                                      (now() at time zone 'utc')::date);
end $$;
grant execute on function public.create_task_from_template(uuid, uuid) to authenticated;

create function public.create_project_from_template(template_id uuid, name text, start_date date default null)
returns public.projects
language plpgsql security invoker set search_path = '' as $$
declare
  tpl public.templates;
  start date := coalesce(create_project_from_template.start_date, (now() at time zone 'utc')::date);
  project public.projects;
  milestone jsonb;
  milestone_ids jsonb := '{}';
  new_milestone uuid;
  milestone_key text := 'a0';
  task jsonb;
  created public.tasks;
begin
  select * into tpl from public.templates x where x.id = create_project_from_template.template_id and x.kind = 'project';
  if not found then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;

  insert into public.projects (workspace_id, team_id, name, description, lead_id, start_date, target_date)
  values (tpl.workspace_id, tpl.team_id, trim(create_project_from_template.name),
          case when jsonb_typeof(tpl.payload -> 'description') = 'object' then tpl.payload -> 'description' end,
          auth.uid(), start, start + (tpl.payload ->> 'target_offset')::integer)
  returning * into project;

  for milestone in select * from jsonb_array_elements(coalesce(tpl.payload -> 'milestones', '[]')) loop
    insert into public.milestones (project_id, name, target_date, sort_key)
    values (project.id, milestone ->> 'name', start + (milestone ->> 'target_offset')::integer,
            milestone_key)
    returning id into new_milestone;
    milestone_key := app.sort_key_after(milestone_key);
    milestone_ids := milestone_ids || jsonb_build_object(coalesce(milestone ->> 'id', new_milestone::text), new_milestone);
  end loop;

  for task in
    select t.value from jsonb_array_elements(coalesce(tpl.payload -> 'tasks', '[]')) with ordinality t
    order by t.ordinality desc
  loop
    created := app.create_task_from_payload(tpl.team_id, task, project.id, null, start);
    if milestone_ids ? (task ->> 'milestone_id') then
      update public.tasks set milestone_id = (milestone_ids ->> (task ->> 'milestone_id'))::uuid
      where id = created.id;
    end if;
  end loop;
  return project;
end $$;
grant execute on function public.create_project_from_template(uuid, text, date) to authenticated;
