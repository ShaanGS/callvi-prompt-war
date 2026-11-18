-- Course progression is practice completed, not a claim of retained mastery.
alter table public.concept_mastery drop constraint concept_mastery_state_check;
alter table public.concept_mastery add constraint concept_mastery_state_check
  check (state in ('introduced', 'practising', 'needs_practice', 'practised', 'mastered', 'carried_forward'));
-- Legacy 'mastered' means course progress only. Do not fabricate evidence or
-- rewrite live rows while the previous app version is still serving calls.

create table public.learning_evidence (
  attempt_id uuid primary key references public.practice_attempts(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  session_id uuid references public.learning_sessions(id) on delete set null,
  lesson_id text not null,
  concept_id text not null,
  exercise_id text not null,
  purpose text not null check (purpose in ('practice', 'review')),
  result text not null check (result in ('correct', 'partial', 'needs_practice', 'ungraded')),
  support text not null check (support in ('none_recorded', 'explanation_provided', 'hint_provided', 'example_provided')),
  approach text,
  met_criteria jsonb not null default '[]'::jsonb,
  missed_criteria jsonb not null default '[]'::jsonb,
  rubric_version integer not null,
  observed_at timestamptz not null default now()
);
create index learning_evidence_context on public.learning_evidence (learner_id, enrollment_id, concept_id, observed_at desc);
alter table public.learning_evidence enable row level security;
revoke all on public.learning_evidence from anon, authenticated;
grant select on public.learning_evidence to authenticated;
create policy learning_evidence_own_read on public.learning_evidence
  for select to authenticated using (learner_id in (select public.current_learner_ids()));
