# Security

Callvi teaches people who may share a handset, may not read English, and are trusting a voice on the phone. The design goal is that the AI can say the wrong thing but cannot *do* the wrong thing: every action with consequences goes through a server-side tool that validates, authorises and records it.

## Reporting a vulnerability

Please open a private security advisory on this repository rather than a public issue. Include the route or file, steps to reproduce and the impact you observed.

## Threat model

| Threat | Control | Where |
| --- | --- | --- |
| A forged tool call from someone other than the voice agent | Per-agent bearer secret, compared in constant time; separate secrets for browser and phone channels | [`tool-callback.ts`](src/server/providers/sarvam/tool-callback.ts), [`crypto.ts`](src/server/security/crypto.ts) |
| A provider retrying a callback and double-recording an attempt | Idempotency key on every tool call | [`tools.ts`](src/server/agent/tools.ts), [`provider.test.ts`](tests/integration/provider.test.ts) |
| Malformed or oversized input | Zod schema on every route and tool; request bodies capped at 16 KB | [`body.ts`](src/server/http/body.ts) |
| One learner reading another's progress | Row-level security on all 18 tables, tested against a real Postgres | [`row_level_security.sql`](supabase/migrations/20261104000200_row_level_security.sql), [`rls.test.ts`](tests/integration/rls.test.ts) |
| A tampered browser identity | HMAC-signed identity cookie, `httpOnly`, `sameSite=lax`, `secure` in production | [`browser-identity.ts`](src/server/auth/browser-identity.ts), [`proxy.ts`](src/proxy.ts) |
| A phone number leaking from the database or logs | Numbers stored only as HMAC hashes; log fields redacted | [`phone.ts`](src/server/security/phone.ts), [`redact.ts`](src/server/security/redact.ts) |
| The model claiming a wrong answer is right, or inventing memory | Grading and memory are tool results the agent may not alter; memory is written only after recorded consent | [`agent-setup.ts`](src/server/providers/sarvam/agent-setup.ts), [`learning-policy.ts`](src/server/agent/learning-policy.ts) |
| A development sign-in reaching production | Refused when `NODE_ENV=production`, with a test | [`dev-identity.ts`](src/server/auth/dev-identity.ts) |
| Brute-force sign-in or abuse of public routes | Per-client rate limits | [`rate-limit.ts`](src/server/security/rate-limit.ts) |
| Script injection or clickjacking on the public site | Strict Content-Security-Policy (`script-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, HSTS | [`vercel.json`](vercel.json), [`next.config.ts`](next.config.ts) |

## Data the learner controls

- Nothing about a learner is kept unless she agrees during the call ([`set_memory_consent`](src/server/agent/tools.ts)).
- She can ask what is remembered, correct it, or ask for everything to be deleted, all by speaking ([`request_data_deletion`](src/server/services/deletion-service.ts)).
- Retention periods and what is never collected: [Privacy and retention](docs/PRIVACY_AND_RETENTION.md).

## Dependency advisories

`npm audit --omit=dev` reports **no vulnerabilities**, and CI fails on any high or critical advisory.

One was resolved by removal rather than upgrade. `sarvam-conv-ai-sdk` lists `speaker`, a native audio-output module with a denial-of-service advisory ([GHSA-w5fc-gj3h-26rx](https://github.com/advisories/GHSA-w5fc-gj3h-26rx)) and no fixed version. Callvi never loads it: the SDK is imported only as `sarvam-conv-ai-sdk/browser`, whose `browser` field maps `speaker` to `false`, and no server code imports the SDK. An npm `overrides` entry replaces it with an [empty stub](vendor/speaker-stub) that throws if anything ever tries to load it, so the vulnerable code is not installed at all.

## Known limitations

- The rate limiter is in memory, so limits are per instance rather than global. Production runs with a single instance; a shared store is needed before scaling out.
- Proof of a learner's identity on a shared phone is not possible from caller ID alone, so saved progress is tied to a consented phone identity rather than to a person.
