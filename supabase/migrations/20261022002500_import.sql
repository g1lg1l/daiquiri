-- Importing tasks (CSV from Linear, Asana, ClickUp or a spreadsheet): one call
-- per batch of up to 500 rows, as the caller under RLS, so a batch lands
-- whole or not at all and numbers, default statuses and history come from the
-- usual triggers.

create function public.import_tasks(team_id uuid, rows jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  ws uuid;
  inserted integer;
begin
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 500 then
    raise exception 'Import at most 500 tasks per request' using errcode = '23514';
  end if;
  select t.workspace_id into ws from public.teams t where t.id = import_tasks.team_id;
  if ws is null then
    raise exception 'Team not found' using errcode = 'P0002';
  end if;

  insert into public.tasks (id, workspace_id, team_id, title, description, status_id, priority,
                            project_id, due_date, start_date, estimate, sort_key)
  select r.id, ws, import_tasks.team_id, r.title, r.description, r.status_id, coalesce(r.priority, 0),
         r.project_id, r.due_date, r.start_date, r.estimate, r.sort_key
  from jsonb_to_recordset(rows) as r(id uuid, title text, description jsonb, status_id uuid, priority smallint,
                                     project_id uuid, due_date date, start_date date, estimate smallint,
                                     sort_key text);
  get diagnostics inserted = row_count;

  insert into public.task_assignees (task_id, workspace_id, user_id)
  select (r ->> 'id')::uuid, ws, a::uuid
  from jsonb_array_elements(rows) r, jsonb_array_elements_text(coalesce(r -> 'assignee_ids', '[]')) a;
  insert into public.task_labels (task_id, label_id, workspace_id)
  select (r ->> 'id')::uuid, l::uuid, ws
  from jsonb_array_elements(rows) r, jsonb_array_elements_text(coalesce(r -> 'label_ids', '[]')) l;
  return inserted;
end $$;
grant execute on function public.import_tasks(uuid, jsonb) to authenticated;
