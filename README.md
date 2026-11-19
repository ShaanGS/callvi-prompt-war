# Callvi

[![Callvi. Build your skills, one call at a time.](docs/media/callvi-cover.webp)](https://shaangs.github.io/callvi-prompt-war/)

**[Explore the learning demo](https://shaangs.github.io/callvi-prompt-war/) · [தமிழில் கற்க](https://shaangs.github.io/callvi-prompt-war/?lang=ta) · [Listen to a recorded AI call](https://shaangs.github.io/callvi-prompt-war/call-sample.html) · [Watch the walkthrough](https://shaangs.github.io/callvi-prompt-war/walkthrough.mp4)**

Callvi is a phone-first AI skill-building platform for women who want to learn in Tamil or English. A learner tells Callvi what she wants to do. The companion chooses a short lesson, explains an idea, listens to her attempt and offers another explanation when she needs one. With permission, it remembers where she paused.

**Prompt War vertical · AI for Education.** Someone with a basic phone may have time for a short conversation between tasks and little opportunity to sit through an app-based course. The call is the teaching interface. The web demo lets judges explore the curriculum and hear a sample of the agent before an inbound handset line is provisioned.

## Try a lesson

| Learning path | What to try |
| --- | --- |
| [Small business](https://shaangs.github.io/callvi-prompt-war/?skill=cost) | Calculate the ingredient cost of one packet from a batch. Try a different explanation, answer and hear the practice question in either language. |
| [Digital skills](https://shaangs.github.io/callvi-prompt-war/?skill=digital) | Decide how to check whether a digital payment arrived. Read the feedback and revise your answer. |
| [Communication](https://shaangs.github.io/callvi-prompt-war/?skill=communication) | Practise giving two details clearly. In this example a tailor explains the fee and pickup time. |

## How a call works

The learner chooses her language and goal. The AI agent uses server-side tools to find a course and retrieve a teaching step. The curriculum supplies an explanation, an everyday example and an exercise. Each assessment checks the learner's response against that exercise’s criteria. A missed detail, a numeric misconception and an unfamiliar open answer can produce different feedback.

The browser app supports live voice through Sarvam or ElevenLabs. The public GitHub Pages preview plays prerecorded audio and runs the curriculum checks locally. The call sample captures a real Sarvam browser session with a synthetic learner. Inbound telephony requires a configured number and a verified physical redial. [Phone experience](docs/CALL_FIRST_PRODUCT.md) · [Demo and deployment](docs/PROMPT_WAR.md)

PostgreSQL stores consented checkpoints. Repeated provider callbacks use idempotency checks. The curriculum is team-authored, the exercises use fictional details, and a shared handset cannot identify individual learners by caller ID alone. [Curriculum](src/content/courses) · [Assessment](src/server/services/assessment/assessment-service.ts) · [Privacy and retention](docs/PRIVACY_AND_RETENTION.md)

## Run locally

Use Node.js 24. The development server starts an embedded PostgreSQL database on first use.

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) and choose a skill. For live voice, configure a provider and its authenticated callbacks. [Setup guide](docs/SETUP.md) · [Environment variables](.env.example)

| Verify or build | Command |
| --- | --- |
| Lint, type-check, run tests and build Next.js | `npm run check` |
| Run unit, integration and agent-scenario tests | `npm test` |
| Run desktop and mobile journeys | `npx playwright install chromium` then `npm run test:e2e` |
| Build the standalone judge rehearsal | `npm run build:rehearsal` |

The app uses TypeScript, React, Next.js, Zod and PostgreSQL. Sarvam and ElevenLabs provide live voice integrations. PGlite, Vitest and Playwright support local testing. GitHub Actions verifies and publishes the interactive learning preview. [Verification and build workflow](.github/workflows/rehearsal.yml)

## Project history

The Callvi voice companion, three courses and provider adapters predate Prompt War. For this edition we built the tailoring scenario and bilingual rubric, a browser rehearsal with optional dictation and bilingual spoken feedback, a two-call regression, Cloud Run packaging and a public bilingual preview of three skills. The curriculum is team-authored. [Project description and pitch](docs/PROMPT_WAR.md) · [Media credits](docs/MEDIA.md)
