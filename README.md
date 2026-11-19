# Callvi

[![Callvi. Build your skills, one call at a time.](docs/media/callvi-cover.webp)](https://callvi-prompt-war.vercel.app/)

**[Try the learning demo](https://callvi-prompt-war.vercel.app/) · [தமிழில் கற்க](https://callvi-prompt-war.vercel.app/?lang=ta) · [Hear a recorded AI call](https://callvi-prompt-war.vercel.app/call-sample.html) · [Watch the walkthrough](https://callvi-prompt-war.vercel.app/walkthrough.mp4)**

Callvi is an AI learning companion that teaches practical skills **by voice conversation**, in **Tamil or English**, designed to work over an ordinary phone call. A learner says what she wants to be able to do. Callvi picks a short lesson, explains one idea, listens to her try it, and explains it differently when she needs that. With her permission, it remembers where she stopped.

**Prompt War theme: 2 — AI for Education.**

---

## The problem

Most digital learning assumes a smartphone, a data plan, comfortable reading, English, and a free half-hour. Many of the women who would gain most from practical skills, such as pricing what they sell, checking a digital payment or explaining a fee to a customer, have none of those reliably. They do have a phone and a few minutes between tasks.

A course that has to be downloaded, read and navigated does not reach them. A conversation does.

## The solution

Callvi turns the phone call itself into the classroom:

1. **The learner talks; the AI teaches.** A voice agent asks about her goal, recommends a course, and teaches one concept at a time in short spoken chunks.
2. **Practice is checked against the lesson, not guessed by the model.** Her spoken or typed attempt is graded by a deterministic rubric for that exercise. The AI is told the result and cannot change it.
3. **The explanation adapts.** If she does not follow, the agent fetches a different authored approach — an everyday example, an analogy, step by step or question-led — instead of repeating itself.
4. **Progress survives the call.** With explicit consent, a checkpoint is saved so the next call resumes at the right idea. Without consent, nothing is kept.
5. **Educators can see what happened.** A staff area shows learners, sessions, course content and every tool call the agent made.

## How Callvi answers the AI for Education theme

The theme asks for learning that is *more accessible, personalized, interactive and effective*, that *adapts to individual learning needs*, *assists educators*, *improves student engagement* and *transforms traditional teaching*. Each phrase maps to working code:

| The theme asks for | What Callvi does | Where it lives |
| --- | --- | --- |
| **Accessible** | Voice-first and bilingual: no reading or typing is required on a call. The web demo has zero axe-core violations (WCAG 2.2 AA) in both languages, desktop and mobile. | [`agent-setup.ts`](src/server/providers/sarvam/agent-setup.ts), [`e2e/preview/demo.spec.ts`](e2e/preview/demo.spec.ts) |
| **Personalized** | Her own goal is recorded and matched to a course; language, pace and explanation style are remembered when she consents. | [`recommendation-service.ts`](src/server/services/recommendation-service.ts), [`memory-service.ts`](src/server/services/memory-service.ts) |
| **Interactive** | A real-time spoken conversation she can interrupt, plus practice she answers out loud or by dictation. | [`use-sarvam-voice.ts`](src/components/room/use-sarvam-voice.ts), [`dictation.tsx`](src/app/%28focus%29/practice/dictation.tsx) |
| **Effective** | Every exercise has a rubric. Six mastery states separate "practised once" from "mastered" and "carried forward", so one lucky answer does not complete a course. | [`assessment-service.ts`](src/lib/assessment/assessment-service.ts), [`learning-policy.ts`](src/server/agent/learning-policy.ts) |
| **Adapts to individual learning needs** | Every concept has two or three authored explanations drawn from five approaches (65 across 22 concepts); feedback branches on correct, partial, needs practice or ungraded, and a partial answer gets asked for the *one* missing detail. | [`schema.ts`](src/content/schema.ts), [`tools.ts`](src/server/agent/tools.ts) |
| **Assists educators** | Staff dashboard for learners, sessions and courses, plus a trace of every tool the agent called and whether it succeeded, so an educator can check what the AI did. Traces record the shape of each request, never the learner's words. | [`src/app/staff`](src/app/staff), [`staff-service.ts`](src/server/services/staff-service.ts) |
| **Improves engagement** | Short lessons of one idea at a time, resume where she paused, and each lesson ends with one small real-world action to try. | [`session-service.ts`](src/server/services/session-service.ts), [`src/content/courses`](src/content/courses) |
| **Transforms traditional teaching** | The interface is a phone call, not an app or a classroom, so it fits around work and needs no screen. | [Phone experience](docs/CALL_FIRST_PRODUCT.md) |

## Where the AI is — and what it is not allowed to do

| Layer | AI | Responsibility |
| --- | --- | --- |
| Voice conversation (default) | **Sarvam Conversational AI** — speech recognition, language model and speech for Tamil and English | Understands the learner, speaks the lesson, decides when to call a tool |
| Voice conversation (alternative) | **ElevenLabs Agents** with the `gpt-6-sol` model and `eleven_v4_turbo` voice | Same role, swappable behind one interface |
| Teaching decisions | **12 server-side tools** the agent must call | Curriculum, grading, memory and consent come from the server, not the prompt |

The model is deliberately kept away from the things it should not decide:

- **It never grades.** [`record_practice_attempt`](src/server/agent/tools.ts) returns the rubric result and the agent is instructed never to change it or call a wrong answer right.
- **It never invents curriculum.** Lessons are fetched with [`get_lesson_context`](src/server/agent/tools.ts); nothing course-specific is in the prompt.
- **It never invents memory.** It reads saved progress through [`get_memory_summary`](src/server/agent/tools.ts), and only writes after [`set_memory_consent`](src/server/agent/tools.ts).
- **Its instructions are generated from code** ([`agent-setup.ts`](src/server/providers/sarvam/agent-setup.ts)) so the provider dashboard cannot drift from the app's own policy.

## Key features

- Bilingual Tamil and English lessons, switchable at any moment.
- Three practical courses (small business, everyday digital skills, communication) and a customer-call rehearsal.
- Live voice lessons through Sarvam or ElevenLabs, with interruption and repeat.
- Rubric-based practice feedback with hints and a model answer only when appropriate.
- Two or three explanations per concept from five approaches, and six mastery states per learner.
- Consent-first memory with a spoken request to delete everything ([`request_data_deletion`](src/server/agent/tools.ts)).
- Educator dashboard with session and tool-call traces.
- A public, keyless web preview of three lessons with recorded audio and browser dictation.

## Try it

The [public demo](https://callvi-prompt-war.vercel.app/) needs no account, keys or microphone.

| Learning path | What to try |
| --- | --- |
| [Small business](https://callvi-prompt-war.vercel.app/?skill=cost) | Work out the cost of one packet from a batch. Ask for another explanation, answer, and hear the question in either language. |
| [Digital skills](https://callvi-prompt-war.vercel.app/?skill=digital) | Decide how to check whether a digital payment really arrived. Read the feedback and revise. |
| [Communication](https://callvi-prompt-war.vercel.app/?skill=communication) | Answer a customer as a home tailor: give the fee and pickup time. Callvi shows which details it heard. |

The demo runs the same authored exercises and the same rubric as the live app, but plays recorded audio instead of opening a live voice session, so it works without provider keys. [The recorded call](https://callvi-prompt-war.vercel.app/call-sample.html) is a real Sarvam session with a synthetic learner.

## Architecture

```
Learner (phone or browser)
   │  speech
   ▼
Voice agent  ──  Sarvam Conversational AI  |  ElevenLabs Agents
   │  authenticated tool calls (HMAC bearer, idempotency key)
   ▼
Next.js route handlers  ──  Zod validation · rate limits · 16 KB body cap
   ▼
Agent orchestrator  ──  learning policy (pure) · rubric assessment (pure)
   ▼
PostgreSQL  ──  courses · sessions · mastery · consented checkpoints · row-level security
```

| Path | Responsibility |
| --- | --- |
| [`src/server/agent`](src/server/agent) | Tool registry, orchestrator, learning policy and evaluation |
| [`src/server/services`](src/server/services) | Assessment, sessions, memory, recommendations, staff views, deletion |
| [`src/server/providers`](src/server/providers) | Sarvam and ElevenLabs adapters behind one interface |
| [`src/content/courses`](src/content/courses) | Team-authored bilingual curriculum, validated by a Zod schema |
| [`supabase/migrations`](supabase/migrations) | Schema, indexes and row-level security policies |
| [`demo`](demo) | Entry point for the static public preview |

## Technologies

| Category | Used |
| --- | --- |
| Languages | TypeScript, SQL, CSS |
| Frameworks | Next.js 16 (App Router), React 19, Tailwind CSS |
| AI and voice | Sarvam Conversational AI, ElevenLabs Agents (`gpt-6-sol`, `eleven_v4_turbo`) |
| Data | PostgreSQL (Supabase in production, PGlite for local and tests) |
| Validation and security | Zod, HMAC-signed identities, row-level security |
| Testing | Vitest, Playwright, axe-core |
| Build and deploy | esbuild (preview), Vercel, Docker for Cloud Run, GitHub Actions |

## Security

- Every API route validates its input with Zod and caps the body at 16 KB; every route except the health check authenticates the caller.
- Agent tool callbacks require a per-agent bearer secret, compared in constant time, and are idempotent.
- Phone numbers are stored only as HMAC hashes; logs are redacted.
- Row-level security on all 18 application tables, covered by integration tests.
- The deployed site sends a strict Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and HSTS ([`vercel.json`](vercel.json)).

Details and the threat model: [SECURITY.md](SECURITY.md) · [Privacy and retention](docs/PRIVACY_AND_RETENTION.md)

## Accessibility

- Zero axe-core violations (WCAG 2.2 AA and best practice) on every demo page, desktop and mobile, English and Tamil — enforced by an automated test.
- `<html lang>` follows the chosen language so screen readers pronounce Tamil correctly.
- Feedback is announced through live regions; a changed explanation is announced too.
- Skip links, visible focus, `prefers-reduced-motion` support and 44px touch targets.

## Efficiency

Callvi's learners are often on basic phones and patchy mobile data, so the preview is built to download as little as possible.

- **JavaScript cut by two thirds, from 928 KB to 303 KB** (about 95 KB compressed, as served). Lesson content is validated against the schema once at build time ([`extract-preview.ts`](scripts/extract-preview.ts)), so the phone receives three exercises as plain data rather than whole courses plus a validation library. The build fails if either is pulled back in ([`build-rehearsal.mjs`](scripts/build-rehearsal.mjs)).
- Voice SDKs load only when a call starts; lesson audio loads only when played.
- Hash-named fonts are cached for a year; audio for a day.
- 21 database indexes cover the learner, session and mastery lookups the agent makes on every turn.

## Testing

**275 automated tests run on every push** ([CI](.github/workflows/ci.yml)), alongside lint, strict type-checking and a dependency audit.

| Suite | Tests | What it proves | Command |
| --- | --- | --- | --- |
| Unit, integration and agent scenarios | **241** in 21 files | Rubric grading and misconception feedback, learning policy, curriculum schema, request limits, error responses, rate limiting and log redaction; against a real PostgreSQL (PGlite), learning flows, row-level security, idempotent provider callbacks and the educator dashboard's counts and privacy; and multi-turn tool sequences a voice agent makes | `npm test` |
| Deployed preview | **34** | The built site served with the real `vercel.json` headers, on desktop and mobile: zero axe-core violations on 8 pages, every security header present, the CSP blocking nothing the lessons need, and each lesson teaching correctly in English and Tamil | `npm run test:preview` |
| Full app journeys (local) | 9 | Sign-in, practice, memory consent and the staff dashboard in the Next.js app | `npm run test:e2e` |

Coverage of `src/server`, `src/content` and `src/lib` is 82% of statements and 77% of branches, and CI fails if it drops ([thresholds](vitest.config.mts), `npm run test:coverage`).

The tests assert behaviour a learner or educator relies on rather than implementation details. For example: an answer of 120 is told it forgot to divide while 1200 is told it multiplied, wrong agent secrets lock an address out before the secret is compared, and the educator dashboard never shows a learner's answer text.

## Run locally

Requires Node.js 24. The development server starts an embedded PostgreSQL database on first use, so no setup is needed to explore the app.

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) and choose a skill. For live voice, add a Sarvam or ElevenLabs configuration ([setup guide](docs/SETUP.md), [environment variables](.env.example)).

| Task | Command |
| --- | --- |
| Lint, type-check, test and build | `npm run check` |
| Unit, integration and agent tests | `npm test` |
| Browser journeys | `npx playwright install chromium` then `npm run test:e2e` |
| Build the public preview | `npm run build:rehearsal` |

## Project history

The voice companion, the first courses and the provider adapters predate Prompt War. During the hackathon we added the bilingual communication lesson and rubric, browser dictation and spoken feedback, the keyless public preview, a two-call regression, security headers, the accessibility work above, and Cloud Run packaging. All curriculum is team-authored and uses fictional details. [Media credits](docs/MEDIA.md)
