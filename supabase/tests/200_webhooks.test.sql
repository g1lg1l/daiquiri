-- Webhooks: safe URLs only, admins only, secrets in Vault, signed deliveries with retries.
begin;
\ir _helpers.psql
select plan(22);

-- URL rules ------------------------------------------------------------------------
select ok(app.is_safe_webhook_url('https://hooks.zapier.com/hooks/catch/1/abc'), 'a public https endpoint is allowed');
select ok(app.is_safe_webhook_url('https://api.example.org:443/in'), 'port 443 may be explicit');
select ok(not app.is_safe_webhook_url('http://hooks.zapier.com/x'), 'plain http is refused');
select ok(not app.is_safe_webhook_url('https://10.0.0.5/x'), 'IP literals are refused');
select ok(not app.is_safe_webhook_url('https://[::1]/x'), 'IPv6 literals are refused');
select ok(not app.is_safe_webhook_url('https://localhost/x'), 'localhost is refused');
select ok(not app.is_safe_webhook_url('https://kong:8000/x'), 'single-label hosts and other ports are refused');
select ok(not app.is_safe_webhook_url('https://db.internal/x'), 'internal-only names are refused');
select ok(not app.is_safe_webhook_url('https://user@evil.com/x'), 'credentials in the URL are refused');

-- Setup ---------------------------------------------------------------------------
select tests.create_user('alice');
select tests.create_user('bob');
select tests.authenticate_as('alice');
select public.create_workspace('Hooks', 't-hooks', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-hooks';
create temp table ctx on commit drop as
  select t.id as team_id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-hooks';
grant select on ctx to authenticated;

-- Admins only --------------------------------------------------------------------
select tests.authenticate_as('bob');
select throws_ok(
  $$ select public.create_webhook((select workspace_id from ctx), 'Mine', 'https://hooks.example.org/x', array['task.created']) $$,
  '42501', null, 'members cannot add webhooks');

select tests.authenticate_as('alice');
create temp table hook on commit drop as
  select public.create_webhook((select workspace_id from ctx), 'CI', 'https://hooks.example.org/in',
                               array['task.created', 'task.updated']) as created;
grant select on hook to authenticated;
select ok((select created ->> 'secret' like 'whsec_%' from hook), 'admins get the signing secret once');
select throws_ok(
  $$ update public.webhooks set url = 'https://127.0.0.1/x' $$, '23514', null, 'and cannot point it at an internal address');
select throws_ok($$ select count(*) from vault.decrypted_secrets $$, '42501', null, 'the secret stays in Vault');

select tests.authenticate_as('bob');
select is((select count(*)::int from public.webhooks), 0, 'members do not see webhooks');

-- Events ----------------------------------------------------------------------------
select tests.authenticate_as('alice');
select public.create_task(null, (select team_id from ctx), 'Ship it');
update public.tasks set priority = 1 where title = 'Ship it';
select tests.clear_authentication();
select is(
  (select array_agg(event order by id) from public.webhook_deliveries
   where webhook_id = ((select created from hook) ->> 'id')::uuid),
  array['task.created', 'task.updated'], 'task changes queue deliveries for the events it listens to');
select is(
  (select payload -> 'previous' from public.webhook_deliveries
   where webhook_id = ((select created from hook) ->> 'id')::uuid and event = 'task.updated'),
  '{"priority": 0}'::jsonb, 'updates carry the previous values of what changed');

-- Sending ----------------------------------------------------------------------------
delete from public.webhook_deliveries where webhook_id <> ((select created from hook) ->> 'id')::uuid;
select app.run_webhooks();
select ok(
  (select bool_and(q.headers ->> 'Daiquiri-Signature' ~ '^t=\d+,v1=[0-9a-f]{64}$')
   from public.webhook_deliveries d join net.http_request_queue q on q.id = d.request_id
   where d.webhook_id = ((select created from hook) ->> 'id')::uuid),
  'every delivery is sent signed');

select ok(
  (select bool_and(
     split_part(q.headers ->> 'Daiquiri-Signature', 'v1=', 2) = encode(extensions.hmac(
       substring(q.headers ->> 'Daiquiri-Signature' from '^t=(\d+)') || '.' || convert_from(q.body, 'UTF8'),
       (select created ->> 'secret' from hook), 'sha256'), 'hex'))
   from public.webhook_deliveries d join net.http_request_queue q on q.id = d.request_id
   where d.webhook_id = ((select created from hook) ->> 'id')::uuid),
  'and the signature verifies against the exact bytes sent');

-- The endpoint answers 200 to the first and 500 to the second.
insert into net._http_response (id, status_code, created)
select request_id, case when event = 'task.created' then 200 else 500 end, now()
from public.webhook_deliveries where webhook_id = ((select created from hook) ->> 'id')::uuid;
select app.run_webhooks();
select is(
  (select array_agg(status || ':' || attempts order by id) from public.webhook_deliveries
   where webhook_id = ((select created from hook) ->> 'id')::uuid),
  array['succeeded:1', 'pending:1'], 'successes are recorded and failures wait to be retried');
select ok(
  (select next_attempt_at > now() from public.webhook_deliveries
   where webhook_id = ((select created from hook) ->> 'id')::uuid and event = 'task.updated'),
  'with a backoff');

select tests.authenticate_as('bob');
select is((select count(*)::int from public.webhook_deliveries), 0, 'members do not see deliveries');

select tests.clear_authentication();
update public.workspaces set is_demo = true where id = (select workspace_id from ctx);
select tests.authenticate_as('alice');
select throws_ok(
  $$ select public.create_webhook((select workspace_id from ctx), 'Relay', 'https://hooks.example.org/y', array['task.created']) $$,
  '23514', null, 'the public demo cannot add webhooks');

select * from finish();
rollback;
