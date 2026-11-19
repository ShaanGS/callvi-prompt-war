# Working on Callvi

Guidance for contributors and coding agents.

## Rules that protect learners

- **The model never grades.** Practice results come from the rubric in [`assessment-service.ts`](src/lib/assessment/assessment-service.ts). Never let a prompt or a provider response change a result.
- **Curriculum and memory come from tools, not prompts.** Course content lives in [`src/content/courses`](src/content/courses) and reaches the agent only through [`tools.ts`](src/server/agent/tools.ts).
- **Nothing is remembered without recorded consent.** Any new write of learner data must check consent first, as [`learning-policy.ts`](src/server/agent/learning-policy.ts) does.
- **Both languages, always.** Every learner-facing string needs Tamil and English. A change that adds English only is incomplete.

## Before you push

```bash
npm run lint && npm run typecheck && npm run test:coverage
npm run test:preview   # the deployed preview: accessibility, headers, lessons
```

Coverage thresholds live in [`vitest.config.mts`](vitest.config.mts) and only go up. A new route needs a Zod schema, the 16 KB body cap from [`body.ts`](src/server/http/body.ts) and an authentication check.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
