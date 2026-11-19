-- Indexes for foreign keys that had none.
--
-- Postgres does not index a foreign key automatically. Without these, deleting
-- a learner (which cascades through every table) or a session (which sets
-- references to null) scans each referencing table in full, and reads that
-- join on these columns fall back to sequential scans as data grows.
-- tests/integration/schema.test.ts fails if a new foreign key arrives without one.

create index if not exists app_events_session_idx on public.app_events(session_id);

create index if not exists concept_mastery_lesson_idx on public.concept_mastery(lesson_id);
create index if not exists concept_mastery_source_session_idx on public.concept_mastery(source_session_id);

create index if not exists enrollments_course_idx on public.enrollments(course_id);
create index if not exists enrollments_current_lesson_idx on public.enrollments(current_lesson_id);
create index if not exists enrollments_goal_idx on public.enrollments(goal_id);

create index if not exists learner_goals_source_session_idx on public.learner_goals(source_session_id);
create index if not exists learner_memory_source_session_idx on public.learner_memory(source_session_id);

create index if not exists learning_checkpoints_course_idx on public.learning_checkpoints(course_id);
create index if not exists learning_checkpoints_lesson_idx on public.learning_checkpoints(lesson_id);
create index if not exists learning_checkpoints_session_idx on public.learning_checkpoints(session_id);

create index if not exists learning_evidence_enrollment_idx on public.learning_evidence(enrollment_id);
create index if not exists learning_evidence_session_idx on public.learning_evidence(session_id);

create index if not exists learning_sessions_enrollment_idx on public.learning_sessions(enrollment_id);

create index if not exists lesson_progress_lesson_idx on public.lesson_progress(lesson_id);

create index if not exists practice_attempts_lesson_idx on public.practice_attempts(lesson_id);
create index if not exists practice_attempts_session_idx on public.practice_attempts(session_id);
