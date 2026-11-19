# Callvi

[![CI](https://github.com/ShaanGS/callvi-prompt-war/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ShaanGS/callvi-prompt-war/actions/workflows/ci.yml?query=branch%3Amain) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[![Callvi. Build your skills, one call at a time.](docs/media/callvi-cover.webp)](https://callvi-prompt-war.vercel.app/)

**[Try the learning demo](https://callvi-prompt-war.vercel.app/) · [தமிழில் கற்க](https://callvi-prompt-war.vercel.app/?lang=ta) · [Hear a recorded AI call](https://callvi-prompt-war.vercel.app/call-sample.html) · [Watch the walkthrough](https://callvi-prompt-war.vercel.app/walkthrough.mp4)**

Callvi is an AI learning companion that teaches practical skills **by voice conversation**, in **Tamil or English**, designed to work over an ordinary phone call. A learner says what she wants to be able to do. Callvi picks a short lesson, explains one idea, listens to her try it, and explains it differently when she needs that. With her permission, it remembers where she stopped.

**Chosen vertical: Prompt War theme 2, AI for Education.**

> **The public link** is a keyless preview: three lessons with the real exercises and rubric, prerecorded lesson audio, and [a recording of a live AI call](https://callvi-prompt-war.vercel.app/call-sample.html). **The full app**, with saved progress and the educator dashboard, runs from this repository with `npm ci && npm run dev`; live voice also needs a Sarvam or ElevenLabs key ([Setup and run](#setup-and-run)).

---

## The problem

Most digital learning assumes a smartphone, a data plan, comfortable reading, English, and a free half-hour. Many of the women who would gain most from practical skills, such as pricing what they sell, checking a digital payment or explaining a fee to a customer, have none of those reliably. They do have a phone and a few minutes between tasks.

A course that has to be downloaded, read and navigated does not reach them. A conversation does.

## The solution

Callvi turns the phone call itself into the classroom:

1. **The learner talks; the AI teaches.** A voice agent asks about her goal, recommends a course, and teaches one concept at a time in short spoken chunks.
2. **Practice is checked against the lesson, not guessed by the model.** Her spoken or typed attempt is graded by a deterministic rubric for that exercise. The AI is told the result and cannot change it.
3. **The explanation adapts.** If she does not follow, the agent fetches a different authored approach — an everyday example, an analogy, step by step or question-led — instead of repeating itself.
4. **Progress survives the call.** With explicit consent, a checkpoint is saved so the next call resumes at the right idea. Without consent, no progress, goal, preference or answer is saved to her record.
5. **Educators can see what happened.** A staff area shows learners, sessions, course content and every tool call the agent made.

## Problem statement alignment: AI for Education

The problem statement: *"Reimagine education through AI-powered solutions that make learning more accessible, personalized, interactive, and effective. Develop intelligent applications that adapt to individual learning needs, assist educators, improve student engagement, and transform traditional teaching and learning experiences."*

Each phrase maps to working code. Where the AI sits, and what it may not do, is [below](#where-the-ai-is--and-what-it-is-not-allowed-to-do).

| The theme asks for | What Callvi does | Where it lives |
| --- | --- | --- |
| **More accessible** | Voice-first and bilingual: no reading or typing is required on a call. The web demo has zero axe-core violations (WCAG 2.2 AA) in both languages, desktop and mobile. | [`agent-setup.ts`](src/server/providers/sarvam/agent-setup.ts), [`e2e/preview/demo.spec.ts`](e2e/preview/demo.spec.ts) |
| **More personalized** | Her own goal is recorded and matched to a course; language, pace and explanation style are remembered when she consents. | [`recommendation-service.ts`](src/server/services/recommendation-service.ts), [`memory-service.ts`](src/server/services/memory-service.ts) |
| **More interactive** | A real-time spoken conversation she can interrupt, plus practice she answers out loud or by dictation. | [`use-sarvam-voice.ts`](src/components/room/use-sarvam-voice.ts), [`dictation.tsx`](src/app/%28focus%29/practice/dictation.tsx) |
| **More effective** | Every exercise has a rubric. Six mastery states separate "practised once" from "mastered" and "carried forward", so one lucky answer does not complete a course. | [`assessment-service.ts`](src/lib/assessment/assessment-service.ts), [`learning-policy.ts`](src/server/agent/learning-policy.ts) |
| **Adapts to individual learning needs** | Every concept has two or three authored explanations drawn from five approaches (65 across 22 concepts); feedback branches on correct, partial, needs practice or ungraded, and a partial answer gets asked for the *one* missing detail. | [`schema.ts`](src/content/schema.ts), [`lesson.ts`](src/server/agent/tools/lesson.ts) |
| **Assists educators** | Staff dashboard for learners, sessions and courses, plus a trace of every tool the agent called and whether it succeeded, so an educator can check what the AI did. Traces record the shape of each request, never the learner's words. | [`src/app/staff`](src/app/staff), [`staff-service.ts`](src/server/services/staff-service.ts) |
| **Improves student engagement** | Short lessons of one idea at a time, resume where she paused, and each lesson ends with one small real-world action to try. | [`session-service.ts`](src/server/services/session-service.ts), [`src/content/courses`](src/content/courses) |
| **Transforms traditional teaching and learning experiences** | The interface is a phone call, not an app or a classroom, so it fits around work and needs no screen. | [Phone experience](docs/CALL_FIRST_PRODUCT.md) |

## Approach and logic

Callvi is an assistant that decides what to do next from what it knows about the learner, not from a fixed script. At the start of every call it reads her context through one tool ([`get_learning_context`](src/server/agent/tools/learner.ts)): consent, goal, course, saved checkpoint, preferences and language. Every decision below is made in code from that context, and the voice model only carries it out.

| When the learner… | Callvi decides to… | Decided in |
| --- | --- | --- |
| has not said whether progress may be saved | ask for memory consent before anything else | [`suggestNextAction`](src/server/agent/learning-policy.ts) |
| has no goal and no course | ask what she wants to be able to do, and record it | [`suggestNextAction`](src/server/agent/learning-policy.ts) |
| has a goal but no course | recommend up to three courses whose terms match her own words, in Tamil or English | [`recommendation-service.ts`](src/server/services/recommendation-service.ts) |
| has a saved checkpoint | resume at the idea where she stopped, not the start | [`session-service.ts`](src/server/services/session-service.ts) |
| is on a call but has not chosen to start | wait: no lesson opens until she says she wants to learn now | [`lesson.ts`](src/server/agent/tools/lesson.ts) |
| does not follow an explanation | switch to an approach she has not heard yet, preferring the style she said suits her | [`chooseExplanation`](src/server/agent/learning-policy.ts) |
| gives a partly right answer | ask only for the detail that is missing | [`assessment-service.ts`](src/lib/assessment/assessment-service.ts) |
| gives a wrong answer that matches a known mistake | name that mistake ("you multiplied instead of dividing") | [`assessment-service.ts`](src/lib/assessment/assessment-service.ts) |
| has two attempts at an idea that were not right | offer another try, a different explanation, or to move on | [`nextStepAfterAttempt`](src/server/agent/learning-policy.ts) |
| asks to review earlier work | pick an idea she practised before, overdue first, and ask a fresh question without teaching the answer first | [`lesson.ts`](src/server/agent/tools/lesson.ts) |
| declined memory, or calls without caller ID | teach for this session only and save nothing to her record | [`learner.ts`](src/server/agent/tools/learner.ts) |

The rules are pure functions with no database or network access, so each is unit-tested directly ([`policy-and-content.test.ts`](tests/unit/policy-and-content.test.ts)), and 12 multi-turn scenarios replay whole conversations against them ([`evals/agent`](evals/agent)).

## Where the AI is — and what it is not allowed to do

| Layer | AI | Responsibility |
| --- | --- | --- |
| Voice conversation (default) | **Sarvam Conversational AI** — speech recognition, language model and speech for Tamil and English | Understands the learner, speaks the lesson, decides when to call a tool |
| Voice conversation (alternative) | **ElevenLabs Agents** with the `gpt-6-sol` model and `eleven_v4_turbo` voice | Same role, swappable behind one interface |
| Teaching decisions | **12 server-side tools** the agent must call | Curriculum, grading, memory and consent come from the server, not the prompt |

The model is deliberately kept away from the things it should not decide:

- **It never grades.** [`record_practice_attempt`](src/server/agent/tools/practice.ts) returns the rubric result and the agent is instructed never to change it or call a wrong answer right.
- **It never invents curriculum.** Lessons are fetched with [`get_lesson_context`](src/server/agent/tools/lesson.ts); nothing course-specific is in the prompt.
- **It never invents memory.** It reads saved progress through [`get_memory_summary`](src/server/agent/tools/memory.ts), and only writes after [`set_memory_consent`](src/server/agent/tools/learner.ts).
- **Its instructions are generated from code** ([`agent-setup.ts`](src/server/providers/sarvam/agent-setup.ts)) so the provider dashboard cannot drift from the app's own policy.

## Features

- Bilingual Tamil and English lessons, switchable at any moment.
- Three practical courses (small business, everyday digital skills, communication) and a customer-call rehearsal.
- Live voice lessons through Sarvam or ElevenLabs, with interruption and repeat.
- Rubric-based practice feedback with hints and a model answer only when appropriate.
- Two or three explanations per concept from five approaches, and six mastery states per learner.
- Consent-first memory with a spoken request to delete everything ([`request_data_deletion`](src/server/agent/tools/memory.ts)).
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

## Setup and run

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

## How it works

```
Learner (phone or browser)
   │  speech
   ▼
Voice agent  ──  Sarvam Conversational AI  |  ElevenLabs Agents
   │  authenticated tool calls (per-agent bearer secret, idempotency key)
   ▼
Next.js route handlers  ──  Zod validation · rate limits · 16 KB body cap
   ▼
Agent orchestrator  ──  learning policy (pure) · rubric assessment (pure)
   ▼
PostgreSQL  ──  courses · sessions · mastery · consented checkpoints · row-level security
```

| Path | Responsibility |
| --- | --- |
| [`src/server/agent`](src/server/agent) | The 12 tools (one file per area), orchestrator and learning policy |
| [`evals/agent`](evals/agent) | 12 multi-turn scenarios that replay whole conversations against the real tools and database |
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
| Speech in the preview | Piper text-to-speech for the prerecorded lesson audio ([voices and attribution](docs/MEDIA.md)), the browser Web Speech API for dictation |
| Data | PostgreSQL (Supabase in production, PGlite for local and tests) |
| Identity | Supabase Auth email one-time codes; HMAC-signed browser identity for learners who have not signed in |
| Validation and security | Zod, row-level security, constant-time secret comparison |
| Testing | Vitest, Playwright, axe-core |
| Build and deploy | esbuild (preview), Vercel, Docker for Cloud Run, GitHub Actions |

## Code quality

- TypeScript in `strict` mode throughout, with no `any`, no `@ts-ignore`, no `eslint-disable` and no TODOs in `src`.
- One direction of dependency: route handlers and server actions are thin; they validate, authorise and call [services](src/server/services), which call [repositories](src/server/repositories). The [learning policy](src/server/agent/learning-policy.ts) and [rubric](src/lib/assessment/assessment-service.ts) are pure functions with no I/O, so they are tested directly.
- Each tool the agent can call is declared once, with a Zod input schema, in a small file for its area under [`agent/tools`](src/server/agent/tools) (consent, courses, lessons, practice, sessions, memory), and [`tools.ts`](src/server/agent/tools.ts) lists them; what the agent is told after each call lives apart in [`tool-guidance.ts`](src/server/agent/tool-guidance.ts).
- Comments explain why, not what; constants that encode a decision, such as rate limits and coverage thresholds, carry their reason beside them.
- ESLint (Next.js core web vitals and TypeScript rules) and Prettier run on every push; CI fails on either.

## Security

- Every API route validates its input with Zod and caps the body at 16 KB; every route except the health check identifies the caller by a signed browser identity, a Supabase session or an agent's bearer secret.
- Agent tool callbacks require a per-agent bearer secret, compared in constant time, and are idempotent. Repeated wrong secrets lock the address out before any secret is compared.
- Every route and learner action is rate limited, and one address can create at most 100 new learners in ten minutes. Limits are keyed on Vercel's own client-address header when running on Vercel, and otherwise on the hop the nearest proxy appended, never on the first `X-Forwarded-For` entry, which the client writes.
- Each staff page checks the staff role itself rather than relying on its layout. Cookies the app sets itself are `httpOnly`, `SameSite=Lax` and `Secure` in production.
- Phone numbers are stored only as HMAC hashes, with no digits kept in clear, and a test searches every column to prove it; logs are redacted.
- Every read checks that the learner owns the row; row-level security on every table backs that up for Supabase's public Data API, and a test fails if a table arrives without it.
- The deployed site sends a strict Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and HSTS ([`vercel.json`](vercel.json)).

Details and the threat model: [SECURITY.md](SECURITY.md) · [Privacy and retention](docs/PRIVACY_AND_RETENTION.md)

## Accessibility

- Zero axe-core violations (WCAG 2.2 AA and best practice) on every public demo page and every screen of the full app, including the educator dashboard and feedback states, in English and Tamil, on desktop and phone. CI enforces it on every push.
- `<html lang>` follows the chosen language so screen readers pronounce Tamil correctly.
- Feedback is announced through live regions; a changed explanation is announced too.
- Skip links, visible focus, `prefers-reduced-motion` support and 44px touch targets.
- Type is sized in `rem`, so it follows the reader's font-size setting, and no text is smaller than 12px.

## Efficiency

Callvi's learners are often on basic phones and patchy mobile data, so the preview is built to download as little as possible.

- **JavaScript cut by two thirds, from 928 KB to 303 KB** (about 95 KB compressed, as served). Lesson content is validated against the schema once at build time ([`extract-preview.ts`](scripts/extract-preview.ts)), so the phone receives three exercises as plain data rather than whole courses plus a validation library. The build fails if either is pulled back in ([`build-rehearsal.mjs`](scripts/build-rehearsal.mjs)).
- Voice SDKs load only when a call starts; lesson audio loads only when played. The live room stops polling while its tab is in the background.
- Request bodies are counted as they stream in and cut off at 16 KB, so an oversized upload is never buffered.
- The script, stylesheet and fonts are content-hashed and cached for a year, so a returning phone downloads nothing but the page; lesson audio is cached for a day.
- Every foreign key has an index, so deleting a learner's data follows an index instead of scanning each table. A test fails if a new foreign key arrives without one.
- The educator overview takes 4 queries rather than 15, and a learner's courses are read concurrently rather than one after another.

## Testing

**342 automated tests run on every push** ([CI](.github/workflows/ci.yml)), alongside lint, strict type-checking, a production build and a dependency audit.

| Suite | Tests | What it proves | Command |
| --- | --- | --- | --- |
| Unit, integration and agent scenarios | **273** in 26 files | Rubric grading and misconception feedback, that every interface string has a Tamil translation, learning policy, curriculum schema, request limits, error responses, rate limiting and log redaction; against a real PostgreSQL (PGlite), learning flows, row-level security, the staff and learner guards, foreign-key indexes, that no digit of a caller's number is stored, idempotent provider callbacks and the educator dashboard's counts and privacy; and multi-turn tool sequences a voice agent makes | `npm test` |
| Deployed preview | **36** | The built site served with the real `vercel.json` headers, on desktop and mobile: zero axe-core violations on 8 pages, every security header present, the CSP blocking nothing the lessons need, hashed bundles cached for a year, and each lesson teaching correctly in English and Tamil | `npm run test:preview` |
| Full app | **33** | The Next.js app against an embedded PostgreSQL: sign-in, practice, memory consent and the customer-call rehearsal, plus zero axe-core violations on every screen, from sign-in to the live room and the educator's view of one learner, in English and Tamil, on a phone and in feedback states | `npm run test:e2e` |

Coverage of `src/server`, `src/content` and `src/lib` is 85% of statements and 79% of branches, and CI fails if it drops ([thresholds](vitest.config.mts), `npm run test:coverage`).

The tests assert behaviour a learner or educator relies on rather than implementation details. For example: an answer of 120 is told it forgot to divide while 1200 is told it multiplied, wrong agent secrets lock an address out before the secret is compared, and the educator dashboard never shows a learner's answer text.

## Assumptions

- A learner has a phone and a few minutes. Reading, typing and English are not assumed.
- Course content is written and reviewed by people. The AI teaches from it and never invents curriculum or grades.
- The voice provider (Sarvam or ElevenLabs) handles speech recognition, the language model and speech; Callvi owns every decision with consequences.
- Caller ID identifies a phone, not a person, since handsets are often shared. Saved progress belongs to a consented phone identity.
- Production runs as a single instance, so the in-memory rate limiter is enough; a shared store is needed before scaling out ([SECURITY.md](SECURITY.md)).
- The public link plays recorded audio so it works without provider keys. Live voice needs a Sarvam or ElevenLabs key.
- Lessons use fictional details. Callvi is practice, not certified training, and gives no financial, legal or medical advice.

## Project history

The voice companion, the first courses and the provider adapters predate Prompt War: they were built in a separate private repository, starting on 5 November 2026. This repository was created for the submission, so its own history starts on 19 November. During the hackathon we added the bilingual communication lesson and rubric, browser dictation and spoken feedback, the keyless public preview, a two-call regression, security headers, the accessibility work above, and Cloud Run packaging. All curriculum is team-authored and uses fictional details. [Media credits](docs/MEDIA.md)

## License

[MIT](LICENSE). Third-party voice models and media keep their own licences; see [Media credits](docs/MEDIA.md).
