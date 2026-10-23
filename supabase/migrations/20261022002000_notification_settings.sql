-- Notification levels per team (feature spec §5): All, Participating, Mute.
--
-- One filter at the door of the notifications table covers every way a
-- notification is created (subscriptions, mentions, assignments, automations).

create table public.notification_settings (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workspace_id uuid not null,
  team_id uuid not null,
  level text not null check (level in ('all', 'participating', 'mute')),
  primary key (user_id, team_id),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade
);

/**
 * All: everything on tasks you follow. Participating: things addressed to you
 * (assignments, mentions, unblocked tasks, automations) and activity on tasks
 * you created or are assigned to. Mute: nothing from the team.
 */
create function app.wants_notification(p_user uuid, p_task uuid, p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case coalesce((
      select ns.level from public.notification_settings ns join public.tasks t on t.team_id = ns.team_id
      where ns.user_id = p_user and t.id = p_task), 'all')
    when 'mute' then false
    when 'participating' then
      p_kind in ('assigned', 'mention', 'unblocked', 'automation')
      or exists (select 1 from public.tasks t where t.id = p_task and t.creator_id = p_user)
      or exists (select 1 from public.task_assignees a where a.task_id = p_task and a.user_id = p_user)
    else true
  end
$$;

create function app.filter_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not app.wants_notification(new.user_id, new.task_id, new.kind) then
    return null;
  end if;
  return new;
end $$;
create trigger notifications_preferences before insert on public.notifications
  for each row execute function app.filter_notification();

alter table public.notification_settings enable row level security;
alter table public.notification_settings force row level security;

create policy notification_settings_select on public.notification_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_settings_insert on public.notification_settings for insert to authenticated
  with check (user_id = (select auth.uid()) and team_id in (select app.accessible_team_ids()));
create policy notification_settings_update on public.notification_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and team_id in (select app.accessible_team_ids()));
create policy notification_settings_delete on public.notification_settings for delete to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update on public.notification_settings from authenticated;
-- PostgREST upserts set every column they insert.
grant insert (workspace_id, team_id, level) on public.notification_settings to authenticated;
grant update (workspace_id, team_id, level) on public.notification_settings to authenticated;
