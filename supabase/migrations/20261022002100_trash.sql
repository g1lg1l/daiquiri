-- Trash (feature spec §3.6): deleted tasks stay restorable for 30 days.
--
-- RLS hides deleted tasks, so the trash is read through a function that
-- applies the same team access. Sub-tasks deleted together with their parent
-- are restored with it and are counted rather than listed.

create function public.trashed_tasks(workspace_id uuid)
returns table (id uuid, team_id uuid, number integer, title text, deleted_at timestamptz, subtasks integer)
language sql stable security definer set search_path = '' as $$
  select t.id, t.team_id, t.number, t.title, t.deleted_at,
         (select count(*)::integer from public.tasks c where c.parent_id = t.id and c.deleted_at = t.deleted_at)
  from public.tasks t
  left join public.tasks p on p.id = t.parent_id
  where t.workspace_id = trashed_tasks.workspace_id
    and t.deleted_at is not null
    and t.team_id in (select app.accessible_team_ids())
    -- Roots only: a sub-task deleted with its parent goes back with it.
    and (p.id is null or p.deleted_at is distinct from t.deleted_at)
  order by t.deleted_at desc, t.number desc
  limit 500
$$;
grant execute on function public.trashed_tasks(uuid) to authenticated;

/** Deletes trashed tasks (and their sub-tasks) for good. Admins only. */
create function public.purge_tasks(task_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  purged integer;
begin
  perform app.require_user();
  delete from public.tasks t
  where t.id = any (purge_tasks.task_ids)
    and t.deleted_at is not null
    and t.workspace_id in (select app.admin_workspace_ids());
  get diagnostics purged = row_count;
  if purged < cardinality(purge_tasks.task_ids) then
    raise exception 'Only admins can delete tasks for good, and only from the trash' using errcode = '42501';
  end if;
  return purged;
end $$;
grant execute on function public.purge_tasks(uuid[]) to authenticated;
