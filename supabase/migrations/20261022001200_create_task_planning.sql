-- create_task also takes the cycle and estimate, so a task created from a
-- cycle page is in that cycle from its first write (one atomic insert).
drop function public.create_task(uuid, uuid, text, uuid, smallint, uuid, uuid, date, date, jsonb, text, uuid[], uuid[]);

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
  label_ids uuid[] default '{}',
  cycle_id uuid default null,
  estimate smallint default null
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
                            start_date, due_date, description, sort_key, cycle_id, estimate)
  values (coalesce(create_task.id, gen_random_uuid()), ws, create_task.team_id, create_task.title,
          create_task.status_id, coalesce(create_task.priority, 0), create_task.project_id, create_task.parent_id,
          create_task.start_date, create_task.due_date, create_task.description, create_task.sort_key,
          create_task.cycle_id, create_task.estimate)
  returning * into created;

  insert into public.task_assignees (task_id, workspace_id, user_id)
  select created.id, ws, u from unnest(coalesce(assignee_ids, '{}')) as u;
  insert into public.task_labels (task_id, label_id, workspace_id)
  select created.id, l, ws from unnest(coalesce(label_ids, '{}')) as l;

  return created;
end $$;
grant execute on function public.create_task(uuid, uuid, text, uuid, smallint, uuid, uuid, date, date, jsonb, text, uuid[], uuid[], uuid, smallint) to authenticated;
