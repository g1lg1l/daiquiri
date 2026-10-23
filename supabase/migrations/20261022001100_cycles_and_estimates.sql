-- Estimates and cycles (feature spec §3.10 and §11, database-model §4.5).
--
-- Estimates: a team turns them on and picks a scale (story points or hours);
-- tasks.estimate already exists. Cycles: a team turns them on and picks a
-- length (1–4 weeks) and a start weekday. The database keeps the current cycle
-- and three upcoming ones, and every night moves unfinished work out of cycles
-- that ended into the next one. Clients never create or delete cycles.

alter table public.teams
  add column estimate_scale text not null default 'points' check (estimate_scale in ('points', 'hours')),
  add column cycle_weeks smallint not null default 2 check (cycle_weeks between 1 and 4),
  add column cycle_start_weekday smallint not null default 1 check (cycle_start_weekday between 0 and 6);
grant update (estimate_scale, cycle_weeks, cycle_start_weekday) on public.teams to authenticated;

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  team_id uuid not null,
  number integer not null check (number > 0),
  name text check (name is null or char_length(trim(name)) between 1 and 80),
  starts_on date not null,
  ends_on date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (team_id, number),
  unique (team_id, id),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade
);
create index cycles_team_dates_idx on public.cycles (team_id, starts_on);
create index cycles_workspace_idx on public.cycles (workspace_id);

-- A task's cycle belongs to the task's team (composite key); deleting a cycle keeps the task.
alter table public.tasks add column cycle_id uuid;
alter table public.tasks add constraint tasks_cycle_fk foreign key (team_id, cycle_id)
  references public.cycles (team_id, id) on delete set null (cycle_id);
create index tasks_cycle_idx on public.tasks (cycle_id) where cycle_id is not null;
grant insert (cycle_id), update (cycle_id) on public.tasks to authenticated;

alter table public.cycles enable row level security;
alter table public.cycles force row level security;
create policy cycles_select on public.cycles for select to authenticated
  using (team_id in (select app.accessible_team_ids()));
create policy cycles_update on public.cycles for update to authenticated
  using (team_id in (select app.accessible_team_ids()) and workspace_id in (select app.full_member_workspace_ids()))
  with check (team_id in (select app.accessible_team_ids()));
revoke insert, update, delete on public.cycles from authenticated;
grant update (name) on public.cycles to authenticated;

create trigger cycles_broadcast after insert or update or delete on public.cycles
  for each row execute function app.broadcast_team_change('cycle');

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------

/** Creates the current cycle and up to three upcoming ones for teams with cycles on. */
create function app.ensure_cycles(p_team uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  team record;
  today date := (now() at time zone 'utc')::date;
  next_start date;
  last_end date;
  length integer;
  upcoming integer;
  guard integer;
begin
  for team in
    select * from public.teams t where t.cycles_enabled and (p_team is null or t.id = p_team)
  loop
    length := team.cycle_weeks * 7;
    select max(c.ends_on) into last_end from public.cycles c where c.team_id = team.id;
    if last_end is null then
      -- The first cycle starts on the most recent start weekday.
      next_start := today - ((extract(dow from today)::integer - team.cycle_start_weekday + 7) % 7);
    else
      next_start := last_end + 1;
    end if;
    -- After a pause, never fill in cycles that are entirely in the past.
    while next_start + length - 1 < today loop
      next_start := next_start + length;
    end loop;
    select count(*) into upcoming from public.cycles c where c.team_id = team.id and c.starts_on > today;
    guard := 0;
    while upcoming < 3 and guard < 8 loop
      insert into public.cycles (workspace_id, team_id, number, starts_on, ends_on)
      values (
        team.workspace_id, team.id,
        coalesce((select max(c.number) from public.cycles c where c.team_id = team.id), 0) + 1,
        next_start, next_start + length - 1
      );
      if next_start > today then
        upcoming := upcoming + 1;
      end if;
      next_start := next_start + length;
      guard := guard + 1;
    end loop;
  end loop;
end $$;

/** Moves unfinished tasks of cycles that ended into the team's next cycle and closes them. */
create function app.rollover_cycles() returns void
language plpgsql security definer set search_path = '' as $$
declare
  ended record;
  today date := (now() at time zone 'utc')::date;
begin
  for ended in
    select * from public.cycles c where c.completed_at is null and c.ends_on < today
    order by c.team_id, c.number
  loop
    update public.tasks t
    set cycle_id = (
      select n.id from public.cycles n
      where n.team_id = ended.team_id and n.number > ended.number
      order by n.number limit 1
    )
    where t.cycle_id = ended.id and t.deleted_at is null
      and t.completed_at is null and t.canceled_at is null;
    update public.cycles set completed_at = now() where id = ended.id;
  end loop;
end $$;

create function app.maintain_cycles() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.ensure_cycles();
  perform app.rollover_cycles();
end $$;

select cron.schedule('daiq-cycles', '5 0 * * *', 'select app.maintain_cycles()');

-- Turning cycles on, or creating a team with them on (the software template),
-- schedules them right away.
create function app.team_cycles_enabled() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.ensure_cycles(new.id);
  return null;
end $$;
create trigger teams_cycles_enabled after update of cycles_enabled on public.teams
  for each row when (new.cycles_enabled and not old.cycles_enabled)
  execute function app.team_cycles_enabled();
create trigger teams_cycles_created after insert on public.teams
  for each row when (new.cycles_enabled)
  execute function app.team_cycles_enabled();

-- Teams that already had cycles on get theirs now.
select app.ensure_cycles();

-- ---------------------------------------------------------------------------
-- Activity and progress
-- ---------------------------------------------------------------------------

create function app.log_task_planning() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.estimate is distinct from old.estimate then
    perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id, 'task.estimate_changed',
      jsonb_build_object('from', old.estimate, 'to', new.estimate));
  end if;
  if new.cycle_id is distinct from old.cycle_id then
    perform app.log_activity(new.workspace_id, new.team_id, new.id, new.project_id, 'task.cycle_changed',
      jsonb_build_object(
        'from', (select c.number from public.cycles c where c.id = old.cycle_id),
        'to', (select c.number from public.cycles c where c.id = new.cycle_id)));
  end if;
  return null;
end $$;
create trigger tasks_planning_activity after update of estimate, cycle_id on public.tasks
  for each row execute function app.log_task_planning();

/**
 * Burn-up of a cycle, one row per day up to today: tasks (and estimate points)
 * in scope and completed by that day. Scope counts the cycle's current tasks
 * from the day they were created. security invoker: RLS applies.
 */
create function public.cycle_progress(cycle_id uuid)
returns table (day date, scope integer, completed integer, scope_points integer, completed_points integer)
language sql stable security invoker set search_path = '' as $$
  with cycle as (
    select c.id, c.starts_on, c.ends_on from public.cycles c where c.id = cycle_progress.cycle_id
  ),
  days as (
    select generate_series(
      cycle.starts_on, greatest(cycle.starts_on, least(cycle.ends_on, (now() at time zone 'utc')::date)),
      interval '1 day'
    )::date as day
    from cycle
  ),
  work as (
    select t.created_at::date as added, t.completed_at::date as done, coalesce(t.estimate, 0) as points
    from public.tasks t join cycle on t.cycle_id = cycle.id
    where t.deleted_at is null and t.canceled_at is null
  )
  select d.day,
    count(*) filter (where w.added <= d.day)::integer,
    count(*) filter (where w.done <= d.day)::integer,
    coalesce(sum(w.points) filter (where w.added <= d.day), 0)::integer,
    coalesce(sum(w.points) filter (where w.done <= d.day), 0)::integer
  from days d left join work w on true
  group by d.day
  order by d.day
$$;
grant execute on function public.cycle_progress(uuid) to authenticated;
