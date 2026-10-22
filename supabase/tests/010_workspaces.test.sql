begin;
\ir _helpers.psql
select plan(26);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('mallory');

-- Workspace creation --------------------------------------------------------
select tests.authenticate_as('alice');
select lives_ok(
  $$ select public.create_workspace('Acme', 'acme', 'Engineering', 'ENG', 'software') $$,
  'a signed-in user can create a workspace'
);
select is((select role::text from public.workspace_members where user_id = tests.uid('alice')), 'owner', 'creator is owner');
select is((select count(*)::int from public.teams), 1, 'a first team is created');
select is(
  (select array_agg(name order by category, position) from public.statuses),
  array['Backlog','Todo','In Progress','In Review','Done','Canceled'],
  'the software template workflow is created in category order'
);
select is((select count(*)::int from public.team_members where user_id = tests.uid('alice')), 1, 'creator joins the team');
select throws_ok(
  $$ select public.create_workspace('Acme 2', 'acme', 'General', 'GEN') $$,
  '23505', null, 'slugs are unique'
);
select throws_ok(
  $$ select public.create_workspace('Bad', 'Bad Slug') $$,
  '23514', null, 'slug format is enforced'
);
select throws_ok(
  $$ insert into public.workspaces (name, slug) values ('Direct', 'direct') $$,
  '42501', null, 'workspaces cannot be inserted directly'
);

-- Outsiders see nothing -----------------------------------------------------
select tests.authenticate_as('mallory');
select is((select count(*)::int from public.workspaces), 0, 'outsider sees no workspaces');
select is((select count(*)::int from public.teams), 0, 'outsider sees no teams');
select is((select count(*)::int from public.statuses), 0, 'outsider sees no statuses');
select is((select count(*)::int from public.workspace_members), 0, 'outsider sees no members');
select is((select count(*)::int from public.profiles where id = tests.uid('alice')), 0, 'outsider cannot see member profiles');
select throws_ok(
  $$ select public.create_invitation((select id from public.workspaces where slug = 'acme'), 'x@test.daiq') $$,
  '42501', null, 'outsider cannot invite'
);
select is(
  (select count(*)::int from public.workspace_member_emails((select id from public.workspaces where slug = 'acme'))),
  0, 'outsider cannot read member emails'
);

-- Invitations ---------------------------------------------------------------
select tests.authenticate_as('alice');
create temp table tokens (handle text, token text) on commit drop;
grant all on tokens to authenticated;
insert into tokens
select 'bob', public.create_invitation((select id from public.workspaces where slug = 'acme'), 'BOB@test.daiq', 'member');

select throws_ok(
  $$ select public.create_invitation((select id from public.workspaces where slug = 'acme'), 'x@test.daiq', 'owner') $$,
  '22023', null, 'owners cannot be invited'
);
select is((select length(token) from tokens), 43, 'tokens carry 256 bits (43 base64url chars)');
select is((select count(*)::int from public.invitations where token_hash is not null and email = 'bob@test.daiq'), 1, 'only the token hash is stored, email normalised');

select tests.authenticate_as('mallory');
select throws_ok(
  $$ select public.accept_invitation((select token from tokens where handle = 'bob')) $$,
  '42501', null, 'a different user cannot accept the invitation'
);

select tests.authenticate_as('bob');
select is(
  (select workspace_name from public.preview_invitation((select token from tokens where handle = 'bob'))),
  'Acme', 'invitee can preview the invitation'
);
select lives_ok($$ select public.accept_invitation((select token from tokens where handle = 'bob')) $$, 'invitee accepts');
select is((select count(*)::int from public.teams), 1, 'new member sees public teams');
select throws_ok(
  $$ select public.accept_invitation((select token from tokens where handle = 'bob')) $$,
  'P0002', null, 'tokens are single-use'
);

-- Roles ---------------------------------------------------------------------
select throws_ok(
  $$ select public.set_member_role((select id from public.workspaces where slug = 'acme'), tests.uid('alice'), 'member') $$,
  '42501', null, 'members cannot change roles'
);

select tests.authenticate_as('alice');
select lives_ok(
  $$ select public.set_member_role((select id from public.workspaces where slug = 'acme'), tests.uid('bob'), 'admin') $$,
  'owner promotes a member to admin'
);
select throws_ok(
  $$ select public.remove_member((select id from public.workspaces where slug = 'acme'), tests.uid('alice'));
     set constraints all immediate $$,
  '23514', null, 'the last owner cannot leave'
);

select * from finish();
rollback;
