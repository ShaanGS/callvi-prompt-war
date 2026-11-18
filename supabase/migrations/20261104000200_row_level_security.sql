-- Row Level Security
--
-- All application reads and writes go through server-side services using the
-- database owner connection (DATABASE_URL), which is never exposed to browsers.
-- RLS is defence in depth for the Supabase Data API: the public `anon` key and
-- `authenticated` user tokens may only read published course content and the
-- signed-in learner's own rows. No browser role may insert, update or delete.

alter table public.learners enable row level security;
alter table public.learner_identities enable row level security;
alter table public.consent_records enable row level security;
alter table public.staff_members enable row level security;
alter table public.courses enable row level security;
alter table public.course_lessons enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.learner_goals enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.concept_mastery enable row level security;
alter table public.learning_checkpoints enable row level security;
alter table public.practice_attempts enable row level security;
alter table public.learner_memory enable row level security;
alter table public.tool_invocations enable row level security;
alter table public.app_events enable row level security;
alter table public.deletion_receipts enable row level security;

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on public.staff_members, public.tool_invocations, public.app_events, public.deletion_receipts
  from anon, authenticated;

-- The learner ids that belong to the current Supabase Auth user.
create or replace function public.current_learner_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select learner_id from public.learner_identities
  where provider = 'supabase' and subject = (auth.uid())::text
$$;
revoke all on function public.current_learner_ids() from public;
grant execute on function public.current_learner_ids() to authenticated;

-- Published course content is public.
grant select on public.courses, public.course_lessons to anon, authenticated;
create policy courses_public_read on public.courses
  for select to anon, authenticated
  using (status in ('published', 'reviewed'));
create policy course_lessons_public_read on public.course_lessons
  for select to anon, authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_lessons.course_id and c.status in ('published', 'reviewed')
  ));

-- Learner-owned rows: read-only access to one's own data.
grant select on public.learners, public.learner_identities, public.consent_records,
  public.learning_sessions, public.learner_goals, public.enrollments, public.lesson_progress,
  public.concept_mastery, public.learning_checkpoints, public.practice_attempts,
  public.learner_memory to authenticated;

create policy learners_own_read on public.learners
  for select to authenticated using (id in (select public.current_learner_ids()));
create policy learner_identities_own_read on public.learner_identities
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
create policy consent_records_own_read on public.consent_records
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
create policy learning_sessions_own_read on public.learning_sessions
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
create policy learner_goals_own_read on public.learner_goals
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
create policy enrollments_own_read on public.enrollments
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
create policy lesson_progress_own_read on public.lesson_progress
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
create policy concept_mastery_own_read on public.concept_mastery
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
create policy learning_checkpoints_own_read on public.learning_checkpoints
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
create policy practice_attempts_own_read on public.practice_attempts
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
create policy learner_memory_own_read on public.learner_memory
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
