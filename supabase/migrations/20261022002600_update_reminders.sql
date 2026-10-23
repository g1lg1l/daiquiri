-- Weekly reminders to post a project update (feature spec §3.10). A project
-- can remind its lead on a day of the week; a daily job sends the reminder
-- only if nobody posted an update in the last six days, at most once a week.

alter table public.projects add column update_reminder_day smallint
  check (update_reminder_day between 0 and 6);
comment on column public.projects.update_reminder_day is 'Day of the week (0 = Sunday) to remind the lead; null: off';
grant insert (update_reminder_day), update (update_reminder_day) on public.projects to authenticated;

-- Notifications can be about a project rather than a task.
alter table public.notifications add column project_id uuid references public.projects (id) on delete cascade;
create index notifications_project_idx on public.notifications (project_id) where project_id is not null;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('assigned', 'mention', 'comment', 'status', 'unblocked', 'automation', 'update_reminder'));

-- Notification levels apply to project notifications through the project's team.
create or replace function app.filter_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.task_id is null and new.project_id is not null then
    if exists (select 1 from public.notification_settings ns join public.projects p on p.team_id = ns.team_id
               where ns.user_id = new.user_id and p.id = new.project_id and ns.level = 'mute') then
      return null;
    end if;
    return new;
  end if;
  if not app.wants_notification(new.user_id, new.task_id, new.kind) then
    return null;
  end if;
  return new;
end $$;

create function app.send_update_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  sent integer;
begin
  with due as (
    insert into public.notifications (workspace_id, user_id, project_id, kind)
    select p.workspace_id, p.lead_id, p.id, 'update_reminder'
    from public.projects p
    join public.workspace_members m on m.workspace_id = p.workspace_id and m.user_id = p.lead_id
    where p.update_reminder_day = extract(dow from now() at time zone 'utc')
      and p.archived_at is null and p.status in ('planned', 'active')
      and not exists (select 1 from public.project_updates u
                      where u.project_id = p.id and u.created_at > now() - interval '6 days')
      and not exists (select 1 from public.notifications n
                      where n.project_id = p.id and n.kind = 'update_reminder'
                        and n.created_at > now() - interval '6 days')
    returning user_id, project_id
  )
  select count(*) into sent from (
    select app.broadcast('user:' || d.user_id, 'notification', d.project_id, 'insert') from due d
  ) x;
  return sent;
end $$;

select cron.schedule('daiq-update-reminders', '0 9 * * *', 'select app.send_update_reminders()');
