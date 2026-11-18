-- Learning Companion — core schema (release 0.1)
--
-- Conventions
--   * UUID primary keys for learner-owned rows, stable text slugs for course content.
--   * Every learner-owned table cascades from learners(id) so that a single
--     DELETE FROM learners removes the learner's profile, identities, consent
--     history, goals, enrolments, progress, sessions, checkpoints, practice
--     attempts, memory, tool traces and events.
--   * No audio and no raw transcripts are stored by this schema.
--   * Raw phone numbers are never stored: phone identities are keyed HMACs.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Learners and identity
-- ---------------------------------------------------------------------------

create table public.learners (
  id uuid primary key default gen_random_uuid(),
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  preferred_language text not null default 'ta-IN' check (preferred_language in ('ta-IN', 'en-IN')),
  phone_last4 text check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$'),
  consent_status text not null default 'pending'
    check (consent_status in ('pending', 'granted', 'declined', 'revoked')),
  consent_version text,
  consent_updated_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger learners_updated_at before update on public.learners
  for each row execute function public.set_updated_at();

-- Verified identity mappings. A learner is only ever resolved from a verified
-- provider subject: a Supabase Auth user id, a development-only identity, or a
-- keyed HMAC of a provider-supplied inbound caller number.
create table public.learner_identities (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  provider text not null check (provider in ('supabase', 'dev', 'phone')),
  subject text not null check (char_length(subject) between 1 and 200),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, subject)
);
create index learner_identities_learner_idx on public.learner_identities(learner_id);

-- Append-only consent history. learners.consent_status is the current value.
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  decision text not null check (decision in ('granted', 'declined', 'revoked')),
  consent_version text not null,
  channel text not null check (channel in ('browser', 'phone', 'text', 'settings')),
  source_session_id uuid,
  created_at timestamptz not null default now()
);
create index consent_records_learner_idx on public.consent_records(learner_id, created_at desc);

-- Staff roles. Staff identities are separate from learner records.
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('supabase', 'dev')),
  subject text not null,
  email_hint text check (email_hint is null or char_length(email_hint) <= 120),
  role text not null check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, subject)
);
create trigger staff_members_updated_at before update on public.staff_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Course knowledge (authoritative, team-authored content)
-- ---------------------------------------------------------------------------

create table public.courses (
  id text primary key check (id ~ '^[a-z0-9-]{3,64}$'),
  title jsonb not null,
  summary jsonb not null,
  description jsonb not null,
  audience jsonb not null,
  outcomes jsonb not null,
  recommendation_terms jsonb not null default '{}'::jsonb,
  languages text[] not null,
  primary_language text not null check (primary_language in ('ta-IN', 'en-IN')),
  level text not null check (level in ('beginner', 'intermediate')),
  status text not null check (status in ('draft', 'reviewed', 'published', 'archived')),
  content_review_status text not null
    check (content_review_status in ('team_authored', 'mentor_review_in_progress', 'mentor_reviewed')),
  content_review_note jsonb,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  sort_order integer not null default 0,
  content_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

create table public.course_lessons (
  id text primary key check (id ~ '^[a-z0-9-]{3,64}$'),
  course_id text not null references public.courses(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  title jsonb not null,
  objective jsonb not null,
  concepts jsonb not null,
  practice jsonb not null,
  real_world_action jsonb not null,
  mentor_review_status text not null
    check (mentor_review_status in ('team_authored', 'mentor_review_in_progress', 'mentor_reviewed')),
  review_flags jsonb not null default '[]'::jsonb,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  content_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, sequence)
);
create index course_lessons_course_idx on public.course_lessons(course_id, sequence);
create trigger course_lessons_updated_at before update on public.course_lessons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sessions, goals, enrolments, progress
-- ---------------------------------------------------------------------------

create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  enrollment_id uuid,
  channel text not null check (channel in ('phone', 'browser', 'text', 'simulated')),
  provider text not null check (provider in ('sarvam', 'none', 'simulation')),
  provider_interaction_id text unique,
  status text not null default 'started'
    check (status in ('started', 'active', 'paused', 'completed', 'interrupted', 'failed')),
  memory_mode text not null check (memory_mode in ('durable', 'session_only')),
  language text not null check (language in ('ta-IN', 'en-IN')),
  -- Session state (layer 2). Short-lived; cleared on close in session-only mode.
  state jsonb not null default '{}'::jsonb,
  state_version integer not null default 0,
  summary text check (summary is null or char_length(summary) <= 1000),
  checkpoint jsonb,
  end_reason text check (end_reason is null or char_length(end_reason) <= 64),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index learning_sessions_learner_idx on public.learning_sessions(learner_id, started_at desc);
create index learning_sessions_status_idx on public.learning_sessions(status, last_activity_at desc);

create table public.learner_goals (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  goal_text text not null check (char_length(goal_text) between 3 and 500),
  goal_status text not null default 'active'
    check (goal_status in ('active', 'completed', 'paused', 'abandoned')),
  user_confirmed boolean not null default false,
  source_session_id uuid references public.learning_sessions(id) on delete set null,
  source text not null check (source in ('onboarding', 'settings', 'voice_session', 'text_session')),
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index learner_goals_one_active on public.learner_goals(learner_id) where goal_status = 'active';
create index learner_goals_learner_idx on public.learner_goals(learner_id, created_at desc);
create trigger learner_goals_updated_at before update on public.learner_goals
  for each row execute function public.set_updated_at();

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  course_id text not null references public.courses(id) on delete restrict,
  goal_id uuid references public.learner_goals(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'withdrawn')),
  current_lesson_id text references public.course_lessons(id) on delete set null,
  idempotency_key text unique,
  enrolled_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index enrollments_one_open_per_course on public.enrollments(learner_id, course_id)
  where status in ('active', 'paused');
create index enrollments_learner_idx on public.enrollments(learner_id, last_activity_at desc);
create trigger enrollments_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();

alter table public.learning_sessions
  add constraint learning_sessions_enrollment_fk
  foreign key (enrollment_id) references public.enrollments(id) on delete set null;

create table public.lesson_progress (
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id text not null references public.course_lessons(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  status text not null check (status in ('not_started', 'in_progress', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (enrollment_id, lesson_id)
);
create index lesson_progress_learner_idx on public.lesson_progress(learner_id);
create trigger lesson_progress_updated_at before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- Concept mastery is durable learner memory (type "mastery") kept in a
-- structured table so that progression rules can query it directly.
create table public.concept_mastery (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id text not null references public.course_lessons(id) on delete cascade,
  concept_id text not null check (char_length(concept_id) <= 80),
  state text not null check (state in ('introduced', 'practising', 'needs_practice', 'mastered', 'carried_forward')),
  attempts integer not null default 0 check (attempts >= 0),
  last_result text check (last_result is null or last_result in ('correct', 'partial', 'needs_practice', 'ungraded')),
  source_session_id uuid references public.learning_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, concept_id)
);
create index concept_mastery_learner_idx on public.concept_mastery(learner_id);
create trigger concept_mastery_updated_at before update on public.concept_mastery
  for each row execute function public.set_updated_at();

create table public.learning_checkpoints (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  enrollment_id uuid references public.enrollments(id) on delete cascade,
  session_id uuid references public.learning_sessions(id) on delete set null,
  idempotency_key text not null unique,
  goal_text text check (goal_text is null or char_length(goal_text) <= 500),
  course_id text references public.courses(id) on delete set null,
  lesson_id text references public.course_lessons(id) on delete set null,
  concept_id text,
  completed_practice jsonb not null default '[]'::jsonb,
  unresolved_difficulty text check (unresolved_difficulty is null or char_length(unresolved_difficulty) <= 300),
  next_action text not null check (char_length(next_action) <= 64),
  summary text not null check (char_length(summary) <= 1000),
  created_at timestamptz not null default now()
);
create index learning_checkpoints_learner_idx on public.learning_checkpoints(learner_id, created_at desc);
create index learning_checkpoints_enrollment_idx on public.learning_checkpoints(enrollment_id, created_at desc);

create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  session_id uuid references public.learning_sessions(id) on delete set null,
  lesson_id text not null references public.course_lessons(id) on delete cascade,
  concept_id text not null,
  exercise_id text not null,
  answer_text text not null check (char_length(answer_text) between 1 and 1000),
  score real check (score is null or (score >= 0 and score <= 1)),
  result text not null check (result in ('correct', 'partial', 'needs_practice', 'ungraded')),
  feedback text not null check (char_length(feedback) <= 1500),
  rubric_version integer not null default 1,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index practice_attempts_learner_idx on public.practice_attempts(learner_id, created_at desc);
create index practice_attempts_enrollment_idx on public.practice_attempts(enrollment_id, concept_id);

-- Durable, consented, structured learner memory (preferences, profile facts,
-- episodic summaries). Every row carries provenance.
create table public.learner_memory (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  memory_type text not null check (memory_type in ('profile', 'preference', 'goal', 'episode', 'mastery')),
  memory_key text not null check (char_length(memory_key) between 1 and 80),
  memory_value jsonb not null,
  source text not null check (source in ('learner_settings', 'onboarding', 'voice_session', 'text_session', 'system')),
  source_session_id uuid references public.learning_sessions(id) on delete set null,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  user_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, memory_type, memory_key)
);
create trigger learner_memory_updated_at before update on public.learner_memory
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Operations: tool traces, events, deletion receipts
-- ---------------------------------------------------------------------------

create table public.tool_invocations (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null check (char_length(tool_name) <= 64),
  channel text not null check (channel in ('phone', 'browser', 'text', 'simulated')),
  learner_id uuid references public.learners(id) on delete cascade,
  session_id uuid references public.learning_sessions(id) on delete set null,
  provider_interaction_id text,
  idempotency_key text not null unique,
  status text not null check (status in ('started', 'succeeded', 'failed', 'rejected')),
  latency_ms integer,
  error_code text check (error_code is null or char_length(error_code) <= 64),
  -- Redacted request metadata: argument names and sizes only, never values.
  request_summary jsonb not null default '{}'::jsonb,
  -- Stored only for successful write tools so that retries can be replayed.
  response jsonb,
  replay_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index tool_invocations_created_idx on public.tool_invocations(created_at desc);
create index tool_invocations_session_idx on public.tool_invocations(session_id);
create index tool_invocations_learner_idx on public.tool_invocations(learner_id);

create table public.app_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (char_length(event_name) <= 64),
  learner_id uuid references public.learners(id) on delete cascade,
  session_id uuid references public.learning_sessions(id) on delete set null,
  channel text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index app_events_created_idx on public.app_events(created_at desc);
create index app_events_learner_idx on public.app_events(learner_id);

-- Non-identifying proof that a deletion request was carried out.
create table public.deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('learning_memory', 'account')),
  channel text not null check (channel in ('browser', 'phone', 'text', 'settings')),
  rows_deleted integer not null default 0,
  completed_at timestamptz not null default now()
);
