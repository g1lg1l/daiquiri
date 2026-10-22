-- Private teams and guests (threat T4).
begin;
\ir _helpers.psql
select plan(15);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('gina');

-- Seed membership directly (RPC flows are covered in 010).
select tests.clear_authentication();
select tests.authenticate_as('alice');
select public.create_workspace('Acme', 't-acme', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-acme'
union all
select id, tests.uid('gina'), 'guest'::public.workspace_role from public.workspaces where slug = 't-acme';

select tests.authenticate_as('alice');
select public.create_team((select id from public.workspaces where slug = 't-acme'), 'Leadership', 'LEAD', 'generic', true);
select is((select count(*)::int from public.teams), 2, 'creator sees the private team');

select tests.authenticate_as('bob');
select is((select array_agg(key) from public.teams), array['GEN'], 'members do not see private teams they are not in');
select is((select count(*)::int from public.statuses s join public.teams t on t.id = s.team_id where t.key = 'LEAD'), 0, 'nor their statuses');
select is(
  (select count(*)::int from public.team_members tm where tm.team_id not in (select id from public.teams)),
  0, 'nor their membership'
);
select lives_ok(
  $$ insert into public.team_members (team_id, workspace_id, user_id)
     select id, workspace_id, tests.uid('bob') from public.teams where key = 'GEN'
     on conflict do nothing $$,
  'members can join public teams'
);
select is(
  (select count(*)::int from public.team_members
   where user_id = tests.uid('bob')),
  1, 'bob joined GEN'
);

-- Joining a private team by guessing its id is denied.
select tests.clear_authentication();
create temp table lead on commit drop as select id, workspace_id from public.teams where key = 'LEAD';
grant select on lead to authenticated;
select tests.authenticate_as('bob');
select throws_ok(
  $$ insert into public.team_members (team_id, workspace_id, user_id) select id, workspace_id, tests.uid('bob') from lead $$,
  '42501', null, 'members cannot join private teams by id'
);

-- Guests ---------------------------------------------------------------------
select tests.authenticate_as('gina');
select is((select count(*)::int from public.teams), 0, 'guests see no teams until added');
select is((select count(*)::int from public.workspaces), 1, 'guests see the workspace itself');
select is(
  (select array_agg(user_id) from public.workspace_members),
  array[tests.uid('gina')], 'guests see only themselves in the directory'
);
select throws_ok(
  $$ select public.create_team((select id from public.workspaces), 'Guest team', 'GT') $$,
  '42501', null, 'guests cannot create teams'
);

select tests.authenticate_as('alice');
insert into public.team_members (team_id, workspace_id, user_id)
select id, workspace_id, tests.uid('gina') from public.teams where key = 'GEN';

select tests.authenticate_as('gina');
select is((select array_agg(key) from public.teams), array['GEN'], 'guests see teams they are added to');
select is(
  (select count(*)::int from public.workspace_members),
  3, 'guests see their teammates'
);

-- Realtime topic authorisation ------------------------------------------------
select tests.clear_authentication();
insert into realtime.messages (topic, extension, payload, event, private)
select 'team:' || id, 'broadcast', '{}'::jsonb, 'change', true from public.teams;
create temp table gen on commit drop as select id from public.teams where key = 'GEN';
grant select on gen to authenticated;

select tests.authenticate_as('bob');
select set_config('realtime.topic', (select 'team:' || id from lead), true);
select is((select count(*)::int from realtime.messages), 0, 'realtime: members cannot receive a private team topic');
select set_config('realtime.topic', (select 'team:' || id from gen), true);
select ok((select count(*) from realtime.messages) > 0, 'realtime: members can join their public team topic');

select * from finish();
rollback;
