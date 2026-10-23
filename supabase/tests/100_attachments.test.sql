-- Attachments: files and metadata follow the task's visibility; only uploaders (or admins) delete.
begin;
\ir _helpers.psql
select plan(13);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Files', 't-files', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-files';
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-files';
grant select on ctx to authenticated;

select tests.authenticate_as('alice');
insert into public.tasks (team_id, workspace_id, title) select team_id, workspace_id, 'Has files' from ctx;
create temp table paths on commit drop as
  select t.workspace_id || '/' || t.id || '/' || a.id || '/brief.pdf' as path, a.id as attachment_id, t.id as task_id, t.workspace_id
  from public.tasks t, (select gen_random_uuid() as id) a where t.title = 'Has files';
grant select on paths to authenticated;

-- Storage objects --------------------------------------------------------------
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) select 'attachments', path, tests.uid('alice')::text from paths $$,
  'members upload into a task they can see');

select tests.authenticate_as('eve');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) select 'attachments', path || '-eve', tests.uid('eve')::text from paths $$,
  '42501', null, 'outsiders cannot upload into the task');
select is((select count(*)::int from storage.objects where bucket_id = 'attachments'), 0,
  'outsiders cannot list its files');

select tests.authenticate_as('bob');
select is((select count(*)::int from storage.objects where bucket_id = 'attachments' and name = (select path from paths)), 1,
  'teammates can read its files');
-- Deleting objects only works through the Storage API (covered end to end).

select tests.authenticate_as('alice');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     select 'attachments', gen_random_uuid() || '/' || task_id || '/x/forged.txt', tests.uid('alice')::text from paths $$,
  '42501', null, 'the first folder must be the task''s workspace');

-- Anonymous demo visitors cannot upload anywhere, even into their own task.
select tests.clear_authentication();
select set_config('request.jwt.claims',
  json_build_object('sub', tests.uid('alice'), 'role', 'authenticated', 'is_anonymous', true)::text, true);
set local role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) select 'attachments', path || '-anon', tests.uid('alice')::text from paths $$,
  '42501', null, 'anonymous sessions cannot upload files');
select throws_ok(
  $$ insert into public.attachments (id, workspace_id, task_id, storage_path, file_name, size_bytes)
     select attachment_id, workspace_id, task_id, path, 'brief.pdf', 1 from paths $$,
  '42501', null, 'nor record attachments');
select tests.authenticate_as('alice');

-- Metadata rows ----------------------------------------------------------------
insert into public.attachments (id, workspace_id, task_id, storage_path, file_name, mime_type, size_bytes)
select attachment_id, workspace_id, task_id, path, 'brief.pdf', 'application/pdf', 1024 from paths;
select is((select uploaded_by from public.attachments), tests.uid('alice'), 'the uploader is always the caller');
select throws_ok(
  $$ insert into public.attachments (workspace_id, task_id, storage_path, file_name, size_bytes)
     select workspace_id, task_id, workspace_id || '/' || task_id || '/elsewhere/x.txt', 'x.txt', 1 from paths $$,
  '23514', null, 'a row must point at its own folder of its task');
select is(
  (select kind from public.activity where task_id = (select task_id from paths) order by created_at desc limit 1),
  'task.attachment_added', 'adding a file shows in the task activity');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.attachments), 0, 'outsiders see no attachments');

select tests.authenticate_as('bob');
delete from public.attachments;
select is((select count(*)::int from public.attachments), 1, 'members cannot delete others'' attachments');

select tests.authenticate_as('alice');
delete from public.attachments;
select is((select count(*)::int from public.attachments), 0, 'the uploader can');

select * from finish();
rollback;
