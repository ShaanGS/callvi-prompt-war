-- LOCAL DEVELOPMENT AND TESTS ONLY.
--
-- Supabase projects already provide the `auth` schema, `auth.uid()` and the
-- `anon` / `authenticated` roles. The embedded PGlite database used for local
-- development and automated tests does not, so this file creates minimal
-- compatible stand-ins before the real migrations run. It is never applied to
-- a Supabase project.

create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
