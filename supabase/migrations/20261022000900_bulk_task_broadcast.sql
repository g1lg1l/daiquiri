-- Task change events per statement instead of per row (ADR-0007). A normal edit
-- still sends one event per task, so clients patch exactly those tasks; an
-- import or bulk edit that touches more than 50 tasks of a team sends a single
-- `task_bulk` event and clients refetch that list once, instead of flooding
-- Realtime (and every connected client) with thousands of messages.
create function app.broadcast_task_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  batch record;
  task_id uuid;
begin
  for batch in select team_id, array_agg(id) as ids from changed_rows group by team_id loop
    if cardinality(batch.ids) > 50 then
      perform app.broadcast('team:' || batch.team_id, 'task_bulk', batch.team_id, tg_op);
    else
      foreach task_id in array batch.ids loop
        perform app.broadcast('team:' || batch.team_id, 'task', task_id, tg_op);
      end loop;
    end if;
  end loop;
  return null;
end $$;

drop trigger tasks_broadcast on public.tasks;
-- Transition tables allow one event per trigger, hence three triggers.
create trigger tasks_broadcast_insert after insert on public.tasks
  referencing new table as changed_rows
  for each statement execute function app.broadcast_task_rows();
create trigger tasks_broadcast_update after update on public.tasks
  referencing new table as changed_rows
  for each statement execute function app.broadcast_task_rows();
create trigger tasks_broadcast_delete after delete on public.tasks
  referencing old table as changed_rows
  for each statement execute function app.broadcast_task_rows();
