-- Project milestones and status updates (feature spec §2, database-model §4.5).

-- ---------------------------------------------------------------------------
-- Milestones: ordered checkpoints of a project; a task belongs to at most one.
-- ---------------------------------------------------------------------------

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  team_id uuid not null,
  project_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  target_date date,
  sort_key text collate "C" not null default 'a0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (team_id, project_id) references public.projects (team_id, id) on delete cascade,
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade
);
create index milestones_project_idx on public.milestones (project_id, sort_key);
create index milestones_team_idx on public.milestones (team_id);
create trigger milestones_updated_at before update on public.milestones
  for each row execute function app.set_updated_at();

/**
 * team_id and workspace_id always come from the project, whatever the client
 * sent (invoker: RLS hides other projects). Updates are authored by the caller.
 */
create function app.project_child_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  select p.team_id, p.workspace_id into new.team_id, new.workspace_id
  from public.projects p where p.id = new.project_id;
  if tg_table_name = 'project_updates' then
    new.author_id := auth.uid();
  end if;
  return new;
end $$;
create trigger milestones_defaults before insert on public.milestones
  for each row execute function app.project_child_defaults();

alter table public.tasks add column milestone_id uuid;
alter table public.tasks add constraint tasks_milestone_has_project
  check (milestone_id is null or project_id is not null);
alter table public.tasks add constraint tasks_milestone_fk foreign key (project_id, milestone_id)
  references public.milestones (project_id, id) on delete set null (milestone_id);
create index tasks_milestone_idx on public.tasks (milestone_id) where milestone_id is not null;
grant insert (milestone_id), update (milestone_id) on public.tasks to authenticated;

-- Moving a task to another project (or out of one) drops its milestone,
-- unless the same update also picks a milestone of the new project.
create function app.task_milestone_follows_project() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.project_id is distinct from old.project_id
     and new.milestone_id is not distinct from old.milestone_id then
    new.milestone_id := null;
  end if;
  return new;
end $$;
create trigger tasks_milestone_project before update of project_id on public.tasks
  for each row execute function app.task_milestone_follows_project();

alter table public.milestones enable row level security;
alter table public.milestones force row level security;
create policy milestones_select on public.milestones for select to authenticated
  using (team_id in (select app.accessible_team_ids()));
create policy milestones_insert on public.milestones for insert to authenticated
  with check (team_id in (select app.accessible_team_ids())
              and workspace_id in (select app.full_member_workspace_ids()));
create policy milestones_update on public.milestones for update to authenticated
  using (team_id in (select app.accessible_team_ids())
         and workspace_id in (select app.full_member_workspace_ids()))
  with check (team_id in (select app.accessible_team_ids()));
create policy milestones_delete on public.milestones for delete to authenticated
  using (team_id in (select app.accessible_team_ids())
         and workspace_id in (select app.full_member_workspace_ids()));
revoke insert, update on public.milestones from authenticated;
grant insert (id, workspace_id, team_id, project_id, name, target_date, sort_key) on public.milestones to authenticated;
grant update (name, target_date, sort_key) on public.milestones to authenticated;

create trigger milestones_broadcast after insert or update or delete on public.milestones
  for each row execute function app.broadcast_team_change('milestone');

-- ---------------------------------------------------------------------------
-- Project updates: health plus a written update, newest first.
-- ---------------------------------------------------------------------------

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  team_id uuid not null,
  project_id uuid not null,
  author_id uuid,
  health text not null check (health in ('on_track', 'at_risk', 'off_track')),
  body jsonb check (app.is_document(body)),
  -- clock_timestamp: updates written in one transaction still order newest first.
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, project_id) references public.projects (team_id, id) on delete cascade,
  foreign key (workspace_id, author_id)
    references public.workspace_members (workspace_id, user_id) on delete set null (author_id)
);
create index project_updates_project_idx on public.project_updates (project_id, created_at desc);
create index project_updates_team_idx on public.project_updates (team_id);
create trigger project_updates_updated_at before update on public.project_updates
  for each row execute function app.set_updated_at();
create trigger project_updates_defaults before insert on public.project_updates
  for each row execute function app.project_child_defaults();

alter table public.project_updates enable row level security;
alter table public.project_updates force row level security;
create policy project_updates_select on public.project_updates for select to authenticated
  using (team_id in (select app.accessible_team_ids()));
create policy project_updates_insert on public.project_updates for insert to authenticated
  with check (team_id in (select app.accessible_team_ids())
              and workspace_id in (select app.full_member_workspace_ids())
              and author_id = (select auth.uid()));
create policy project_updates_update on public.project_updates for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy project_updates_delete on public.project_updates for delete to authenticated
  using (author_id = (select auth.uid()) or workspace_id in (select app.admin_workspace_ids()));
revoke insert, update on public.project_updates from authenticated;
grant insert (id, workspace_id, team_id, project_id, health, body) on public.project_updates to authenticated;
grant update (health, body) on public.project_updates to authenticated;

create trigger project_updates_broadcast after insert or update or delete on public.project_updates
  for each row execute function app.broadcast_team_change('project_update');

/** The newest update of every project the caller can see (security invoker: RLS applies). */
create view public.project_latest_updates with (security_invoker = true) as
  select distinct on (u.project_id)
    u.id, u.project_id, u.health, u.author_id, u.created_at
  from public.project_updates u
  order by u.project_id, u.created_at desc;
grant select on public.project_latest_updates to authenticated;
