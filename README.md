# Callvi · AI for Education

Callvi helps women who run small businesses rehearse practical conversations in Tamil or English. A home tailor can practise quoting a price and pickup time before a customer phones. Callvi plays the customer, listens to the offer and uses a bilingual rubric to identify the detail still missing. A learner can ask for a different explanation, retry, decline memory or save a stopping point.

### Try the Prompt War exercise

Run the app locally with Node.js 24 and `npm ci`, then `npm run dev`. Open the homepage and choose Tamil or English. In a configured voice session, ask to rehearse a customer call and choose the course of that name. **Practise by text** opens the same scenario and rubric without a voice account, microphone or API key.

In the exercise, shortening a pair of trousers costs ₹50 and takes two days. The customer asks for ₹40 and collection tomorrow. Give the fee alone, then try the full reply. Compare the feedback after each attempt. These numbers are fictional terms of the exercise. The rubric checks a bounded set of phrases and can leave an unfamiliar answer ungraded.

**Implementation.** Next.js and TypeScript serve the learner interface, authenticated voice tools and course content. Sarvam or ElevenLabs handles browser speech and dialogue. Sarvam inbound calls use server-to-server tools. PostgreSQL stores consented checkpoints. Zod validates tool inputs, Vitest checks decisions and Playwright exercises the learner journey.

**Project history.** The voice companion, three original courses and provider adapters predate Prompt War. This public edition builds on the earlier Callvi prototype and adds the tailoring rehearsal, bilingual browser practice, homepage channel fixes, a two-call regression and Cloud Run packaging. The inbound flow uses a provider-owned phone number and requires a real two-call test before the app displays it.

[Demo script, project description and deployment](docs/PROMPT_WAR.md)

## Learning by phone

The call is the product: the intended learner may have only a basic button phone. The current browser is a demo access channel; service discovery, today's intent, consent, learning navigation and ending the call work through speech. A new or returning call does not automatically start a lesson. See [the call-first product contract](docs/CALL_FIRST_PRODUCT.md) for the flow and the remaining inbound-telephony/SMS integration work.

Learners enter directly without an account or sign-in. A signed, httpOnly cookie identifies this browser; saved progress resumes in the same browser when memory consent is granted. Clearing cookies or using a different device starts a separate profile. Staff access remains protected at `/sign-in?next=/staff`.

- **Channels:** browser voice (ElevenLabs, with the Sarvam adapter retained), a text study room that drives the same agent tools, and optional inbound phone through a separately configured Sarvam phone agent. Phone is shown to learners only after a real inbound call and second-call resume test have been verified.
- The four courses are Rehearse a Customer Call, Small Business Starter, Customer Communication and Digital Basics for a Small Business. The curriculum is team-authored and awaits expert review.
- **The application owns the data.** Identity, consent, goals, courses, progress, checkpoints, practice records and memory live in Postgres, behind server-side domain services. The voice provider reaches them only through authenticated, idempotent API tools.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000 — direct entry, embedded database, no credentials needed
```

The main screen is voice first: tap **Call Callvi** and complete consent, goal discovery, course choice and learning through conversation.

See [docs/SETUP.md](docs/SETUP.md) for Supabase, Sarvam and phone configuration, and [.env.example](.env.example) for every variable.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint, `tsc --noEmit` |
| `npm test` | Vitest: unit, integration (consent, deletion, RLS, tool-callback auth, phone identity, provider proxy) and the 12 agent scenarios |
| `npm run test:e2e` | Playwright journeys on desktop and mobile |
| `npm run db:migrate` / `db:seed` | Apply `supabase/migrations/`, upsert course content |
| `npm run staff:grant` | Grant or revoke staff access for a Supabase Auth user |
| `npm run sarvam:config` | Print agent instructions and API-tool settings for the Sarvam dashboard |
| `npm run agent:eval-export` | Export the agent scenarios as conversation test cases for the provider |

## Layout

```
src/app/                 routes: learner pages (app), live room (focus), staff workspace, API routes
src/components/          UI primitives, learner shell, learning room, voice panel
src/content/             course content and its Zod schema
src/lib/                 i18n (en, ta), languages, client-safe voice state
src/server/agent/        tool registry, orchestrator, context builder, learning policy, evaluation scenarios
src/server/services/     domain services: learners, sessions, courses, progress, memory, assessment, deletion
src/server/providers/    Sarvam adapter: signed-URL proxy, tool callbacks, dashboard configuration
src/server/repositories/ SQL access (Zod-validated rows)
supabase/migrations/     versioned schema and row-level security
tests/  e2e/  scripts/
```

## Documentation

- Product and technical specifications: [docs/PRD.md](docs/PRD.md), [docs/TRD.md](docs/TRD.md), [docs/AGENT_SPEC.md](docs/AGENT_SPEC.md), [docs/COURSES_AND_ACCEPTANCE.md](docs/COURSES_AND_ACCEPTANCE.md), [docs/SOURCES.md](docs/SOURCES.md)
- [docs/SETUP.md](docs/SETUP.md): setup and provider configuration
- [docs/PRIVACY_AND_RETENTION.md](docs/PRIVACY_AND_RETENTION.md): what is stored, and how deletion works
- [Verification and submission](docs/PROMPT_WAR.md#verification-on-november-18) covers the browser, database, simulated carrier interactions and outstanding real-call checks.
