# Technical Requirements & Design Document (TRD)

**Product:** Voice-first AI Learning Companion  
**Version:** 0.1  
**Status:** Product architecture, release 0.1  

## 1. Engineering goals

1. Deliver an end-to-end voice learning journey quickly and reliably.
2. Keep learner identity, course progression, memory and assessment data inside our application database.
3. Treat voice/telephony as a replaceable adapter rather than coupling course logic to one vendor.
4. Avoid building custom low-level audio streaming and telephony infrastructure in the initial release unless required.
5. Keep all tool calls typed, authenticated, validated, observable and idempotent.

## 2. Recommended architecture

### 2.1 MVP integration choice

Use **Sarvam Voice Agents** as the managed real-time voice and telephony runtime for the first version, provided the team's account can access the required features and provision an inbound number. Its documented runtime combines speech recognition, LLM reasoning, speech synthesis and turn-taking; it supports Tamil, phone-number deployment, browser SDKs and API tools that invoke external HTTPS endpoints. The application backend owns learning-specific APIs and data. See the official documentation links in `SOURCES.md`.

This is a pragmatic make-vs-buy decision: do not spend the initial build implementing audio streaming, VAD, barge-in and telephony media bridges from scratch. The product's differentiating logic should be goal-oriented course progression, adaptive teaching policy, learner memory and practice evaluation.

**Important trade-off:** Sarvam's managed Voice Agents stack does not currently support bringing a custom ASR/LLM/TTS model into that runtime. Keep our business logic and persistence vendor-independent, and document that the live voice reasoning loop is managed by the provider. A fully custom runtime can be a later phase using independent STT, LLM and TTS adapters.

### 2.2 Logical architecture

```text
                 ┌───────────────────────────────┐
                 │          Learner              │
                 │   Basic phone / Browser mic   │
                 └───────────────┬───────────────┘
                                 │
                 ┌───────────────▼───────────────┐
                 │       Voice Provider          │
                 │  ASR · turn-taking · LLM · TTS │
                 │  Phone transport / Web SDK     │
                 └───────────────┬───────────────┘
                                 │ HTTPS tool calls
                 ┌───────────────▼───────────────┐
                 │      Next.js API Layer        │
                 │ Auth · Zod · rate limits      │
                 └───────────────┬───────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼────────┐  ┌──────────▼─────────┐  ┌─────────▼─────────┐
│ Learning Service │  │ Memory Service     │  │ Course Service    │
│ goals/progression│  │ profile/checkpoint │  │ lessons/rubrics   │
└─────────┬────────┘  └──────────┬─────────┘  └─────────┬─────────┘
          └──────────────────────┼──────────────────────┘
                                 │
                 ┌───────────────▼───────────────┐
                 │     Supabase PostgreSQL       │
                 │ Learners · Courses · Sessions │
                 │ Progress · Memory · Attempts  │
                 └───────────────────────────────┘

                 ┌───────────────────────────────┐
                 │       Operator Dashboard      │
                 │ Learners · Courses · Progress │
                 │ Recent sessions · Debug trace │
                 └───────────────────────────────┘
```

### 2.3 Stack

- Frontend and HTTP backend: Next.js App Router + TypeScript.
- UI: Tailwind CSS + shadcn/ui. Use Framer Motion only where it improves feedback; keep the interface calm and legible.
- Database: Supabase PostgreSQL.
- Validation: Zod schemas at every external boundary.
- Voice: Sarvam Voice Agents for MVP phone/browser sessions, subject to account access and provisioning.
- SDK: Use the official Sarvam Web TypeScript SDK for browser voice where appropriate. For phone calls, configure the managed agent and inbound number or connect a supported telephony provider.
- Tests: Vitest for services/schemas; Playwright for dashboard critical paths; agent test cases in the voice platform plus local deterministic tests.
- Hosting: Vercel for the Next.js UI and short-lived HTTPS API routes, provided API tool callbacks and webhook behaviour work under the selected deployment. Do not host long-lived custom audio WebSocket media bridges in serverless route handlers.

## 3. System boundaries

### Our application owns

- Learner records and consent state.
- Goal capture and confirmation.
- Course catalogue, curriculum, lesson content and exercise rubrics.
- Course enrolment and progression rules.
- Learning context assembly.
- Durable learner memory and session checkpoints.
- Practice attempt records and progress status.
- Tool schemas, validation, authorization, idempotency and business rules.
- Operator dashboard, analytics events and data deletion.

### Voice provider owns in the MVP

- Phone call transport and/or browser audio capture.
- Streaming ASR and TTS.
- Turn detection, interruption handling and audio playback.
- The managed voice conversation loop and tool-call orchestration.
- Call-level analytics exposed by the platform.

### Later provider abstraction

Define internal interfaces such as `VoiceSessionProvider`, `SpeechInputProvider`, `SpeechOutputProvider` and `AgentRuntimeProvider` even if only one provider is implemented initially. Keep provider-specific request/response shapes inside adapter modules.

## 4. Application modules

```text
src/
  app/
    (dashboard)/
      page.tsx
      learners/page.tsx
      learners/[id]/page.tsx
      courses/page.tsx
      sessions/page.tsx
    api/
      voice/
        context/route.ts
        courses/route.ts
        goal/route.ts
        lesson/route.ts
        practice/route.ts
        checkpoint/route.ts
        session-start/route.ts
        session-end/route.ts
  components/
    dashboard/
    courses/
    learners/
    sessions/
    voice/
  lib/
    db/
    auth/
    validation/
    telemetry/
  server/
    services/
      learner-service.ts
      learning-service.ts
      memory-service.ts
      course-service.ts
      assessment-service.ts
      session-service.ts
    providers/
      sarvam/
      interfaces/
    agent/
      context-builder.ts
      tool-registry.ts
      policies.ts
    repositories/
  content/
    courses/
      small-business-starter/
      digital-business-basics/
      customer-communication/
```

Implementers may adapt this to framework conventions, but must not merge all logic into one route or one giant component.

## 5. Data model

Use UUID primary keys, UTC timestamps, foreign keys, indexes and explicit lifecycle states. Use Supabase migrations; do not rely on manual dashboard-only schema changes.

### `learners`

- `id uuid primary key`
- `phone_hash text unique null` — keyed HMAC of normalized E.164 number; never log raw phone number.
- `phone_last4 text null` — display helper only.
- `display_name text null`
- `preferred_language text not null default 'ta-IN'`
- `consent_status text not null` — `pending | granted | declined | revoked`
- `consent_updated_at timestamptz null`
- `created_at`, `updated_at`

For authenticated browser sessions, resolve the learner from the verified application session. Never trust a phone number supplied by browser JavaScript as proof of identity. Seeded learners are restricted to local development and automated tests.

### `learner_goals`

- `id uuid primary key`
- `learner_id uuid references learners`
- `goal_text text not null`
- `goal_status text not null` — `active | completed | paused | abandoned`
- `source_session_id uuid null`
- `created_at`, `updated_at`

### `courses`

- `id text primary key` — stable slug.
- `title text not null`
- `description text not null`
- `language_code text not null`
- `level text not null`
- `status text not null` — `draft | reviewed | published | archived`
- `estimated_minutes int null`
- `created_at`, `updated_at`

### `course_lessons`

- `id text primary key`
- `course_id text references courses`
- `sequence int not null`
- `title text not null`
- `objective text not null`
- `concepts jsonb not null`
- `explanation_points jsonb not null`
- `examples jsonb not null`
- `practice_prompt text not null`
- `assessment_rubric jsonb not null`
- `mentor_review_status text not null`
- Unique (`course_id`, `sequence`).

Keep content atomic and bounded. Do not store an entire curriculum as one unstructured prompt blob.

### `enrollments`

- `id uuid primary key`
- `learner_id uuid references learners`
- `course_id text references courses`
- `status text not null` — `active | paused | completed | withdrawn`
- `current_lesson_id text null references course_lessons`
- `enrolled_at`, `updated_at`, `completed_at null`
- Unique active learner/course pair enforced in service or partial index.

### `learning_sessions`

- `id uuid primary key`
- `learner_id uuid references learners`
- `enrollment_id uuid null references enrollments`
- `provider text not null`
- `provider_interaction_id text null unique`
- `channel text not null` — `phone | browser | simulated`
- `status text not null` — `started | completed | interrupted | failed`
- `started_at timestamptz`, `ended_at timestamptz null`
- `summary text null`
- `checkpoint jsonb null`

### `session_turns` (optional for MVP; only persist when consent permits)

- `id uuid primary key`
- `session_id uuid references learning_sessions`
- `sequence int not null`
- `speaker text not null` — `learner | agent | tool`
- `text_redacted text not null`
- `created_at timestamptz`

### `learner_memory`

- `id uuid primary key`
- `learner_id uuid references learners`
- `memory_type text not null` — `profile | preference | goal | episode | mastery`
- `memory_key text not null`
- `memory_value jsonb not null`
- `source_session_id uuid null`
- `confidence numeric null`
- `user_confirmed boolean not null default false`
- `created_at`, `updated_at`
- Unique (`learner_id`, `memory_type`, `memory_key`).

### `practice_attempts`

- `id uuid primary key`
- `learner_id uuid references learners`
- `enrollment_id uuid references enrollments`
- `lesson_id text references course_lessons`
- `concept_id text not null`
- `answer_text text not null`
- `score numeric null`
- `result text not null` — `correct | partial | needs_practice | ungraded`
- `feedback text not null`
- `created_at timestamptz`

### `tool_invocations` (debug/audit)

- `id uuid primary key`
- `provider_interaction_id text null`
- `tool_name text not null`
- `idempotency_key text not null unique`
- `status text not null`
- `latency_ms int null`
- `error_code text null`
- `created_at timestamptz`

Never log API keys, raw credentials or full unredacted caller identifiers.

## 6. Agent tool API contracts

All endpoints are server-side HTTPS endpoints. Every request must authenticate the provider tool using a dedicated secret stored in the deployment environment. Validate the body with Zod. Include `interaction_id` and an idempotency key whenever a write can be retried.

Suggested endpoints:

| Tool | Endpoint | Purpose |
|---|---|---|
| `get_learning_context` | `POST /api/voice/context` | Resolve trusted caller or authenticated browser learner, load consent, goals, active enrolment, checkpoint and relevant learner memory. |
| `list_courses` | `GET /api/voice/courses` | Return only published/reviewed courses available in selected language. |
| `set_learning_goal` | `POST /api/voice/goal` | Save a learner-confirmed goal. |
| `start_or_resume_course` | `POST /api/voice/enrol` | Create or resume a course enrolment. |
| `get_lesson_context` | `POST /api/voice/lesson` | Return the next approved lesson content, examples, practice prompt and rubric. |
| `record_practice_attempt` | `POST /api/voice/practice` | Save outcome/feedback from a practice interaction. |
| `save_checkpoint` | `POST /api/voice/checkpoint` | Save current lesson, concept status and short learner-approved summary. |
| `close_learning_session` | `POST /api/voice/session-end` | Finalise session, persist checkpoint and summary; idempotent. |

For Sarvam API tools, pass the call's user identifier and interaction ID through the documented call-context variables. Prefer `on_start` to fetch the initial learner context and `on_end` to persist the end-of-call checkpoint, with mid-call tools for course actions. The voice agent should call tools only when needed; do not make a database round-trip for every conversational sentence.

### Tool response design

Return small, explicit JSON objects with stable keys. Example context response:

```json
{
  "learner": {
    "id": "learner-example-001",
    "display_name": "Meena",
    "preferred_language": "ta-IN",
    "consent_status": "granted"
  },
  "active_goal": "Learn how to price homemade food products",
  "active_course": {
    "id": "small-business-starter",
    "title": "Small Business Starter"
  },
  "progress": {
    "current_lesson_id": "sbs-02",
    "completed_concepts": ["identify-product"],
    "needs_practice": ["cost-vs-price"]
  },
  "last_session_summary": "Learner identified idli batter as a product and started learning basic cost calculation.",
  "suggested_next_action": "resume_lesson"
}
```

This JSON is a contract illustration, not a real learner record.

## 7. Memory and context architecture

Use four distinct layers:

1. **Turn context (ephemeral):** Recent conversation turns, current question and immediate tool result. Owned by the voice runtime.
2. **Session state (short-lived):** Current course, lesson, concept, pending exercise, attempts in this call and current conversation state.
3. **Learner memory (durable, selective):** User-confirmed goal, preferred language, learning preferences, active enrolment, concept mastery and last-session summary.
4. **Course knowledge (authoritative):** Reviewed lesson objectives, explanations, examples, exercises and rubrics. Never treat model-generated content as approved curriculum.

### Context assembly

At call start:

- Resolve phone learners only from trusted inbound caller identity; resolve browser learners from the authenticated application session. Seeded identities are restricted to local development and automated tests.
- Check consent status.
- Load the active goal and enrolment.
- Load current lesson and progress.
- Load a concise last-session summary and selected preferences.
- Load only the relevant lesson/course knowledge, not every course or every historical turn.
- Return a short context object for the agent.

During the call:

- Retrieve lesson content only when starting/resuming a lesson or changing topic.
- Record explicit user-confirmed goals and course choices.
- Record practice outcome and relevant mastery updates.
- Do not silently convert guesses into durable memories.

At call end:

- Save current course/lesson/concept checkpoint.
- Save a short factual summary: what was covered, what the learner practised, what remains, and next suggested step.
- Store no inferred sensitive attributes.
- If consent is declined/revoked, do not create durable learning memory; offer a session-only experience.

### Memory quality rules

- Prefer structured state over a free-form paragraph.
- Store provenance (`source_session_id`) and whether the learner confirmed a fact.
- Give the learner a way to inspect, correct and delete stored learning data.
- Avoid collecting caste, religion, health, political views, family conflict, income, exact address or any other sensitive information not needed for learning.
- Do not infer literacy, confidence, ability or family responsibilities from accent, pauses or vocabulary.

## 8. Agent state machine

The agent should be state-aware but not behave like a rigid IVR.

```text
WELCOME
  -> CONSENT_AND_LANGUAGE
  -> IDENTIFY_LEARNER
  -> DISCOVER_GOAL
  -> RECOMMEND_COURSE
  -> CONFIRM_ENROLMENT
  -> TEACH_CONCEPT
  -> CHECK_UNDERSTANDING
  -> PRACTICE
  -> FEEDBACK_AND_RETRY
  -> CHECKPOINT
  -> CLOSE_OR_CONTINUE
```

At any stage the learner can interrupt, ask a clarification, request another example, switch supported language, pause, change goal or ask what the agent remembers. The state machine is a guide for progress, not a script that blocks natural conversation.

## 9. Security, privacy and abuse controls

- Keep service-role keys and voice-provider API keys in environment variables; never expose them to the browser.
- Authenticate every agent tool endpoint with a dedicated bearer secret or provider-supported secure mechanism.
- Rate-limit endpoints and reject oversized payloads.
- Validate `interaction_id`, user identifier and all body fields. Treat caller metadata and transcripts as untrusted input.
- Hash phone identifiers with a server-side HMAC key; keep raw E.164 number out of application logs. Store only what is operationally necessary.
- Enable Supabase Row Level Security for browser-accessible tables. The service role must be server-only.
- Do not record audio by default. Show an explicit disclosure before any audio/transcript retention.
- Use idempotency keys for write tools, because webhook/tool retries may occur.
- Return generic errors to the voice provider; retain structured internal error codes without personal data.
- Support consent revocation and deletion of learner profile, memory, progress and transcripts according to the product's retention policy.
- Do not make unsolicited outbound calls in the initial product release.

## 10. Observability

Track structured, privacy-minimised events:

- `session.started`, `session.ended`, `session.failed`
- `learner.identified`, `consent.granted`, `consent.declined`
- `goal.confirmed`, `course.selected`, `lesson.started`, `lesson.completed`
- `practice.submitted`, `practice.feedback_given`
- `checkpoint.saved`, `memory.retrieved`, `memory.updated`
- `tool.started`, `tool.succeeded`, `tool.failed`

Record latency by tool, provider interaction ID, channel and error code. Never use raw phone numbers as event dimensions.

## 11. Testing requirements

### Unit tests

- Caller identifier normalisation/HMAC.
- Consent gating.
- Context builder returns only active/relevant data.
- Checkpoint update is idempotent.
- Course progression respects lesson order and completion state.
- Practice rubric accepts valid and rejects malformed results.
- Learner deletion removes dependent records.

### Integration tests

- On-start context retrieval.
- Tool auth rejects missing/invalid secret.
- Tool retry does not duplicate enrolment, practice attempt or checkpoint.
- On-end finalisation handles a partial/interrupted session.
- Second session resumes the correct course/lesson.

### Agent conversation tests

1. Learner says they do not know what course they need.
2. Learner chooses small-business course and states a goal.
3. Learner says “I didn't understand”; agent changes explanation.
4. Learner interrupts while the agent is speaking.
5. Learner gives an incorrect calculation; agent explains without shaming.
6. Learner code-switches Tamil/English.
7. Learner asks an off-topic question outside course scope.
8. Learner returns in a second call and asks “where did we stop?”
9. Learner declines memory persistence.
10. Tool endpoint times out or returns invalid data.
11. Inbound caller ID is unavailable.
12. Duplicate on-end webhook arrives.

## 12. Deployment and operations

- Local development: Next.js app + Supabase local or development project + voice-provider test agent.
- Staging: deployed application + separate staging database + provider tool URLs pointed to staging.
- Production: deploy only after auth, database migrations, privacy controls, rate limits, monitoring and voice-provider configuration have been verified.
- Phone availability is enabled only after a real inbound call and a second-call resume test succeed. Browser voice is a separate supported channel, not proof of telephony readiness.

## 13. Later custom voice runtime

If the team later needs complete ownership of the real-time loop, evaluate a custom pipeline: telephony/SIP or WebRTC adapter -> streaming ASR -> learning-agent runtime -> TTS. Sarvam documents real-time Tamil-capable streaming STT and streaming TTS. This path requires additional work for VAD, barge-in, audio buffering, retries, codec/sample-rate conversion and call lifecycle. Do not implement it in the first release when the managed voice agent can satisfy the product requirements.
