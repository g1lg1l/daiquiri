-- Task attachments in Supabase Storage (feature spec P2, database-model §4.5).
--
-- Files live in the private bucket `attachments` at
--   {workspace_id}/{task_id}/{attachment_id}/{file name}
-- and are only reachable through signed URLs. Storage policies tie every
-- object to a task the caller can see; the `attachments` table holds the
-- metadata the app lists. The client uploads the file, then inserts the row;
-- deleting removes the object first, then the row.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do nothing;

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  storage_path text not null unique check (char_length(storage_path) <= 1024),
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type text not null default 'application/octet-stream' check (char_length(mime_type) <= 255),
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, task_id) references public.tasks (workspace_id, id) on delete cascade,
  foreign key (workspace_id, uploaded_by)
    references public.workspace_members (workspace_id, user_id) on delete set null (uploaded_by),
  -- The path must be this attachment's own folder of this task.
  check (storage_path like workspace_id::text || '/' || task_id::text || '/' || id::text || '/%')
);
create index attachments_task_idx on public.attachments (task_id, created_at);

/** Anonymous demo visitors cannot upload: the public demo must not host files (threat T16). */
create function app.is_anonymous() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;
grant execute on function app.is_anonymous() to authenticated;

create function app.attachment_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.uploaded_by := auth.uid();
  return new;
end $$;
create trigger attachments_defaults before insert on public.attachments
  for each row execute function app.attachment_defaults();

alter table public.attachments enable row level security;
alter table public.attachments force row level security;
create policy attachments_select on public.attachments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id)
              and uploaded_by = (select auth.uid()) and not (select app.is_anonymous()));
create policy attachments_delete on public.attachments for delete to authenticated
  using (uploaded_by = (select auth.uid()) or workspace_id in (select app.admin_workspace_ids()));
revoke insert, update on public.attachments from authenticated;
grant insert (id, workspace_id, task_id, storage_path, file_name, mime_type, size_bytes)
  on public.attachments to authenticated;

-- A new or removed file is a change of its task (the list shows a paperclip count).
create trigger attachments_broadcast after insert or delete on public.attachments
  for each row execute function app.broadcast_team_change('task');

create function app.log_attachment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  task record;
begin
  select t.workspace_id, t.team_id, t.project_id into task from public.tasks t where t.id = new.task_id;
  perform app.log_activity(task.workspace_id, task.team_id, new.task_id, task.project_id,
    'task.attachment_added', jsonb_build_object('file_name', new.file_name));
  return null;
end $$;
create trigger attachments_activity after insert on public.attachments
  for each row execute function app.log_attachment();

-- ---------------------------------------------------------------------------
-- Storage policies: an object's second folder is its task; RLS on tasks decides.
-- ---------------------------------------------------------------------------

create function app.attachment_task(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when (storage.foldername(object_name))[2] ~ '^[0-9a-f-]{36}$'
    then ((storage.foldername(object_name))[2])::uuid
  end
$$;
grant execute on function app.attachment_task(text) to authenticated;

create policy attachments_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'attachments'
         and exists (select 1 from public.tasks t where t.id = app.attachment_task(name)));
create policy attachments_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and not (select app.is_anonymous())
              and exists (select 1 from public.tasks t
                          where t.id = app.attachment_task(name)
                            and t.workspace_id::text = (storage.foldername(name))[1]));
create policy attachments_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments'
         and (owner_id = (select auth.uid())::text
              or exists (select 1 from public.tasks t
                         where t.id = app.attachment_task(name)
                           and t.workspace_id in (select app.admin_workspace_ids()))));
