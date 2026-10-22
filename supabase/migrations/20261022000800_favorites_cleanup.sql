-- Favorites point at views, projects, tasks and teams by id, without a foreign
-- key (one table for every kind). Drop them together with their target so no
-- sidebar keeps a dangling entry. security definer: the favorites belong to
-- other users, whom the deleting user's RLS cannot see.
create function app.drop_favorites() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.favorites where entity_kind = tg_argv[0] and entity_id = old.id;
  return old;
end $$;

create trigger views_drop_favorites after delete on public.views
  for each row execute function app.drop_favorites('view');
create trigger projects_drop_favorites after delete on public.projects
  for each row execute function app.drop_favorites('project');
create trigger tasks_drop_favorites after delete on public.tasks
  for each row execute function app.drop_favorites('task');
create trigger teams_drop_favorites after delete on public.teams
  for each row execute function app.drop_favorites('team');
