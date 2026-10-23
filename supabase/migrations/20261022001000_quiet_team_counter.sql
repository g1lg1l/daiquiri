-- teams.task_seq is an internal counter bumped by every new task. A change to
-- it alone is not a change of the team: no updated_at bump and no realtime
-- event (an import of 5,000 tasks used to send 5,000 "team changed" messages
-- to the whole workspace).
drop trigger teams_broadcast on public.teams;
create trigger teams_broadcast after insert or delete on public.teams
  for each row execute function app.broadcast_workspace_change('team');
create trigger teams_broadcast_update after update on public.teams
  for each row
  when ((to_jsonb(old) - 'task_seq' - 'updated_at') is distinct from (to_jsonb(new) - 'task_seq' - 'updated_at'))
  execute function app.broadcast_workspace_change('team');

drop trigger teams_updated_at on public.teams;
create trigger teams_updated_at before update on public.teams
  for each row
  when ((to_jsonb(old) - 'task_seq' - 'updated_at') is distinct from (to_jsonb(new) - 'task_seq' - 'updated_at'))
  execute function app.set_updated_at();
