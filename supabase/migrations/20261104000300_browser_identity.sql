-- Learners can start directly with a private identity issued to their browser.
-- This identity has no Supabase session or staff privileges. All application
-- data continues to go through server services and the existing RLS policies.
alter table learner_identities drop constraint learner_identities_provider_check;
alter table learner_identities add constraint learner_identities_provider_check
  check (provider in ('supabase', 'dev', 'phone', 'browser'));
