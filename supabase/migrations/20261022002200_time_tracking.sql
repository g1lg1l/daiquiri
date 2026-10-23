-- Time tracking (feature spec §3.5): a timer per person and manual entries,
-- per task, for teams that turn the module on.

alter table public.teams add column time_tracking_enabled boolean not null default false;
grant update (time_tracking_enabled) on public.teams to authenticated;

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- clock_timestamp: a timer stopped later in the same transaction still has a length.
  started_at timestamptz not null default clock_timestamp(),
  -- Null while the timer runs.
  ended_at timestamptz,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  check (ended_at is null or (ended_at > started_at and ended_at - started_at <= interval '24 hours')),
  foreign key (workspace_id, task_id) references public.tasks (workspace_id, id) on delete cascade
);
-- One running timer per person.
create unique index time_entries_running_idx on public.time_entries (user_id) where ended_at is null;
create index time_entries_task_idx on public.time_entries (task_id, started_at desc);
create trigger time_entries_broadcast after insert or update or delete on public.time_entries
  for each row execute function app.broadcast_team_change('task');

alter table public.time_entries enable row level security;
alter table public.time_entries force row level security;

-- Everyone who sees the task sees its time; people log and change only their own.
create policy time_entries_select on public.time_entries for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy time_entries_insert on public.time_entries for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.tasks t where t.id = task_id));
create policy time_entries_update on public.time_entries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy time_entries_delete on public.time_entries for delete to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update on public.time_entries from authenticated;
grant insert (workspace_id, task_id, started_at, ended_at, note) on public.time_entries to authenticated;
grant update (started_at, ended_at, note) on public.time_entries to authenticated;

/** Stops the caller's running timer, if any (capped at 24 hours). */
create function public.stop_timer() returns public.time_entries
language sql security invoker set search_path = '' as $$
  update public.time_entries
  set ended_at = least(clock_timestamp(), started_at + interval '24 hours')
  where user_id = auth.uid() and ended_at is null
  returning *
$$;
grant execute on function public.stop_timer() to authenticated;

/** Starts a timer on a task, stopping the one already running. */
create function public.start_timer(task_id uuid) returns public.time_entries
language plpgsql security invoker set search_path = '' as $$
declare
  entry public.time_entries;
begin
  perform public.stop_timer();
  insert into public.time_entries (workspace_id, task_id)
  select t.workspace_id, t.id from public.tasks t where t.id = start_timer.task_id and t.deleted_at is null
  returning * into entry;
  if entry.id is null then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  return entry;
end $$;
grant execute on function public.start_timer(uuid) to authenticated;
