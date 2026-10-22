-- Local development seed (applied by `supabase db reset`). Never used in production.
-- Sign in with dev@daiq.local / daiq-dev-password.
do $$
declare
  uid uuid := '00000000-0000-4000-a000-0000000000d1';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'dev@daiq.local', extensions.crypt('daiq-dev-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Dev User"}', now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', 'dev@daiq.local', 'email_verified', true),
          'email', now(), now(), now());

  perform app.seed_demo_workspace(uid, 'acme', 'Acme Inc.', false);
end $$;
