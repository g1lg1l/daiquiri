-- Recurring tasks (feature spec §3.7, ADR-0009).
--
-- A series is one row pointing at its latest task. On a schedule (every N
-- days, weeks on chosen weekdays, or months, keeping the rhythm of an anchor
-- date) or N days/weeks/months after the latest task is completed, an hourly
-- job creates the next task from the latest one and moves the series to it.
-- History stays on each task.

create table public.task_recurrences (
  task_id uuid primary key,
  workspace_id uuid not null,
  unit text not null check (unit in ('day', 'week', 'month')),
  every integer not null default 1 check (every between 1 and 365),
  -- Weekly series: days of the week (0 = Sunday); empty means the anchor's weekday.
  weekdays smallint[] not null default '{}' check (weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  after_completion boolean not null default false,
  -- The rhythm's first date: the task's due date, else its start date, else
  -- the day it was set (filled in by the trigger below).
  anchor_on date not null default (now() at time zone 'utc')::date,
  -- Next scheduled task (null when the series waits for a completion).
  next_on date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, task_id) references public.tasks (workspace_id, id) on delete cascade
);
create index task_recurrences_next_idx on public.task_recurrences (next_on) where next_on is not null;

create function app.add_period(p_day date, p_unit text, p_count integer) returns date
language sql immutable set search_path = '' as $$
  select (p_day + case p_unit
    when 'day' then make_interval(days => p_count)
    when 'week' then make_interval(weeks => p_count)
    else make_interval(months => p_count)
  end)::date
$$;

/**
 * The first date after both p_after and the anchor that is on the series'
 * rhythm: every N days from the anchor; on the weekdays of every Nth week
 * (weeks start on Monday); or on the anchor's day of every Nth month, moved
 * to the month's last day when it is shorter.
 */
create function app.next_occurrence(
  p_anchor date, p_unit text, p_every integer, p_weekdays smallint[], p_after date
) returns date
language plpgsql immutable set search_path = '' as $$
declare
  d date := greatest(p_after, p_anchor) + 1;
  days smallint[] := case when cardinality(p_weekdays) > 0 then p_weekdays
                          else array[extract(dow from p_anchor)::smallint] end;
  anchor_week date := p_anchor - (extract(isodow from p_anchor)::integer - 1);
  month_end date;
begin
  for i in 1 .. p_every * 372 + 7 loop
    month_end := (date_trunc('month', d) + interval '1 month - 1 day')::date;
    if (case p_unit
      when 'day' then (d - p_anchor) % p_every = 0
      when 'week' then extract(dow from d)::smallint = any (days)
        and ((d - (extract(isodow from d)::integer - 1)) - anchor_week) / 7 % p_every = 0
      else ((extract(year from d) - extract(year from p_anchor)) * 12
            + extract(month from d) - extract(month from p_anchor))::integer % p_every = 0
        and extract(day from d) = least(extract(day from p_anchor), extract(day from month_end))
    end) then
      return d;
    end if;
    d := d + 1;
  end loop;
  return null;
end $$;

create function app.recurrence_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    select coalesce(t.due_date, t.start_date, today) into new.anchor_on
    from public.tasks t where t.id = new.task_id;
  end if;
  if tg_op = 'INSERT'
     or (new.unit, new.every, new.weekdays, new.after_completion)
        is distinct from (old.unit, old.every, old.weekdays, old.after_completion) then
    new.next_on := case when not new.after_completion
      then app.next_occurrence(new.anchor_on, new.unit, new.every, new.weekdays, today) end;
  end if;
  return new;
end $$;
create trigger task_recurrences_schedule before insert or update on public.task_recurrences
  for each row execute function app.recurrence_schedule();
create trigger task_recurrences_broadcast after insert or update or delete on public.task_recurrences
  for each row execute function app.broadcast_team_change('task');

/** Creates the next task of every due series (one per series per run). */
create function app.run_recurrences() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  r record;
  occurrence date;
  created public.tasks;
  made integer := 0;
begin
  for r in
    select rec.*, t.team_id, t.title, t.priority, t.project_id, t.parent_id, t.start_date,
           t.due_date, t.description, t.estimate, t.completed_at
    from public.task_recurrences rec
    join public.tasks t on t.id = rec.task_id
    where t.deleted_at is null
      and (case when rec.after_completion
             then t.completed_at is not null
                  and app.add_period((t.completed_at at time zone 'utc')::date, rec.unit, rec.every) <= today
             else rec.next_on <= today end)
    for update of rec skip locked
  loop
    occurrence := case when r.after_completion
      then app.add_period((r.completed_at at time zone 'utc')::date, r.unit, r.every)
      else r.next_on end;
    -- Dates keep their shape: the due date lands on the occurrence, the start
    -- date as far before it as on the latest task.
    created := public.create_task(
      gen_random_uuid(), r.team_id, r.title, null, r.priority, r.project_id, r.parent_id,
      case when r.start_date is null then null
           when r.due_date is null then occurrence
           else occurrence - (r.due_date - r.start_date) end,
      case when r.due_date is not null then occurrence end,
      r.description, null,
      array(select a.user_id from public.task_assignees a where a.task_id = r.task_id),
      array(select l.label_id from public.task_labels l where l.task_id = r.task_id),
      null, r.estimate);
    insert into public.task_field_values (task_id, field_id, workspace_id, value)
    select created.id, v.field_id, v.workspace_id, v.value
    from public.task_field_values v where v.task_id = r.task_id;

    update public.task_recurrences
    set task_id = created.id,
        next_on = case when not r.after_completion
          then app.next_occurrence(r.anchor_on, r.unit, r.every, r.weekdays, greatest(occurrence, today)) end
    where task_id = r.task_id;
    made := made + 1;
  end loop;
  return made;
end $$;

select cron.schedule('daiq-recurrences', '11 * * * *', 'select app.run_recurrences()');

alter table public.task_recurrences enable row level security;
alter table public.task_recurrences force row level security;

-- A series follows its task: whoever can see and edit the task can set it.
create policy task_recurrences_select on public.task_recurrences for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_recurrences_insert on public.task_recurrences for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_recurrences_update on public.task_recurrences for update to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id))
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_recurrences_delete on public.task_recurrences for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

revoke insert, update on public.task_recurrences from authenticated;
-- PostgREST upserts set every column they insert (see custom fields).
grant insert (task_id, workspace_id, unit, every, weekdays, after_completion) on public.task_recurrences to authenticated;
grant update (task_id, workspace_id, unit, every, weekdays, after_completion) on public.task_recurrences to authenticated;
