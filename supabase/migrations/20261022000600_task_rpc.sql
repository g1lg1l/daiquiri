-- Atomic multi-row task operations used by the client data layer.
-- security invoker: RLS and column privileges apply exactly as for direct writes.

create function public.create_task(
  id uuid,
  team_id uuid,
  title text,
  status_id uuid default null,
  priority smallint default 0,
  project_id uuid default null,
  parent_id uuid default null,
  start_date date default null,
  due_date date default null,
  description jsonb default null,
  sort_key text default null,
  assignee_ids uuid[] default '{}',
  label_ids uuid[] default '{}'
) returns public.tasks
language plpgsql security invoker set search_path = '' as $$
declare
  ws uuid;
  created public.tasks;
begin
  select tm.workspace_id into ws from public.teams tm where tm.id = create_task.team_id;
  if ws is null then
    raise exception 'Team not found' using errcode = 'P0002';
  end if;

  insert into public.tasks (id, workspace_id, team_id, title, status_id, priority, project_id, parent_id,
                            start_date, due_date, description, sort_key)
  values (coalesce(create_task.id, gen_random_uuid()), ws, create_task.team_id, create_task.title,
          create_task.status_id, coalesce(create_task.priority, 0), create_task.project_id, create_task.parent_id,
          create_task.start_date, create_task.due_date, create_task.description, create_task.sort_key)
  returning * into created;

  insert into public.task_assignees (task_id, workspace_id, user_id)
  select created.id, ws, u from unnest(coalesce(assignee_ids, '{}')) as u;
  insert into public.task_labels (task_id, label_id, workspace_id)
  select created.id, l, ws from unnest(coalesce(label_ids, '{}')) as l;

  return created;
end $$;

create function public.set_task_assignees(task_id uuid, user_ids uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  ws uuid;
begin
  select t.workspace_id into ws from public.tasks t where t.id = set_task_assignees.task_id;
  if ws is null then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  delete from public.task_assignees a
  where a.task_id = set_task_assignees.task_id and not a.user_id = any (coalesce(user_ids, '{}'));
  insert into public.task_assignees (task_id, workspace_id, user_id)
  select set_task_assignees.task_id, ws, u from unnest(coalesce(user_ids, '{}')) as u
  on conflict do nothing;
end $$;

create function public.set_task_labels(task_id uuid, label_ids uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  ws uuid;
begin
  select t.workspace_id into ws from public.tasks t where t.id = set_task_labels.task_id;
  if ws is null then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  delete from public.task_labels l
  where l.task_id = set_task_labels.task_id and not l.label_id = any (coalesce(label_ids, '{}'));
  insert into public.task_labels (task_id, label_id, workspace_id)
  select set_task_labels.task_id, l, ws from unnest(coalesce(label_ids, '{}')) as l
  on conflict do nothing;
end $$;

grant execute on function
  public.create_task(uuid, uuid, text, uuid, smallint, uuid, uuid, date, date, jsonb, text, uuid[], uuid[]),
  public.set_task_assignees(uuid, uuid[]),
  public.set_task_labels(uuid, uuid[])
to authenticated;
