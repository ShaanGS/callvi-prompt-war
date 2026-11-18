# Privacy and retention

This document describes what the code currently does. It is an engineering description, not a legal privacy notice. A reviewed privacy notice and a data protection assessment are still needed before a public launch.

## Principles

- **Consent first.** Durable learning memory is written only when a learner's consent status is `granted`. While consent is `pending`, `declined` or `revoked`, tools still work for the current session, but they report `saved: false` and write no durable rows. Integration tests check this table by table.
- **Learning-relevant only.** The agent stores only goals, course choices, progress, practice results and learning preferences, and only from a fixed set of preference keys and values. The agent is instructed never to collect OTPs, PINs, passwords, bank or account credentials, caste, religion, health details, political views, a precise home address, income or family conflict details.
- **Provenance.** Each goal and memory records its source (onboarding, settings, voice session or text session) and the session it came from. Learners can see this source on `/privacy`.
- **The learner stays in control.** Learners can view, correct and delete their goal and preferences, reset an idea, revoke consent, erase all learning memory, or delete their account.

A signed, httpOnly `lc_browser_identity` cookie lets learners enter without sign-in. It contains a random identifier and expiry, with no name, email or learning content. It lasts up to one year and grants no staff access. Saved learning can be resumed only in that browser; clearing cookies or using another device starts a separate profile. Deleting the account clears this cookie. Consent to durable learning memory is still required.

## What is stored

| Data | Where | Notes |
|---|---|---|
| Learner profile | `learners` | Language, consent status and version. A display name is stored only with consent. |
| Sign-in identity | `learner_identities` | A random browser identity, Supabase Auth user id, a development identity, or an **HMAC-SHA256 of the caller number** keyed with `PHONE_HASH_SECRET`. Raw phone numbers are never stored. |
| Consent history | `consent_records` | Append-only: each decision, its version, channel and time. |
| Goals, enrolments, progress, mastery, checkpoints | the matching tables | Written only with consent. |
| Practice attempts | `practice_attempts` | The learner's answer text (up to 1,000 characters), the rubric result and the feedback, so progress and feedback can be reviewed. Written only with consent. |
| Preferences and episode summaries | `learner_memory` | Structured keys and values with provenance. |
| Sessions | `learning_sessions` | Channel, timestamps, status, the current course position and a short structured summary. **No transcripts.** |
| Tool traces | `tool_invocations` | Tool name, status, latency, error code, and **argument names and sizes only**. Successful write responses are kept so retries can be replayed idempotently. |
| Product events | `app_events` | Event names with non-identifying metadata. |
| Deletion receipts | `deletion_receipts` | Scope, channel, row count and time. Not linked to the learner. |

**Not stored:** audio recordings, raw transcripts, raw phone numbers, the voice provider API key in any browser-visible place, or answers in logs.

The voice room in the browser shows a live transcript while a call is in progress. It is held in page memory only and disappears when the page closes. Application logs pass through `redactText`/`redactValue`, which mask phone-like numbers, digit runs of four or more, emails, bearer tokens and voice tokens.

### Session-only learners

A learner who declines consent can keep learning. Their position within the current session is kept on the session row so the lesson can continue, but no durable memory is written.

A goal typed during web onboarding without consent is held only in an httpOnly session cookie. Phone callers whose number is withheld get a temporary learner, which is deleted when the call ends.

## Deletion

| Action | Effect |
|---|---|
| Revoke consent (`/privacy`, or telling the agent) | Erases goals, enrolments, progress, mastery, checkpoints, practice attempts, structured memory, closed session records, tool traces and events. Open sessions switch to session-only. The account and consent history remain. |
| Delete learning memory | Same erasure as above, without changing consent. |
| Delete account (type `DELETE`) | Deletes the learner row, and every learner-owned table is deleted with it. If `SUPABASE_SERVICE_ROLE_KEY` is set, the Supabase Auth user is also deleted. Otherwise the learner is told the sign-in record needs manual removal. A non-identifying receipt is kept. |

Deletion is immediate in the application database. Backups follow the Supabase project's backup retention, which the operator must document.

## Retention

There is **no automated retention job yet**. Learner data is kept until the learner deletes it. Tool traces and events are kept until the learner's data is deleted or an operator removes them. Before launch, the team should decide on retention periods and implement a scheduled cleanup, for example:

- tool traces after 90 days
- events after 12 months
- learners inactive for an agreed period, after notice

## Third parties

Browser voice can use ElevenLabs, while the Sarvam adapter remains available. The configured provider processes voice for speech recognition, conversation and synthesis. The Callvi ElevenLabs agent is configured with voice recording disabled and a zero-day transcript retention setting. Learning progress remains in the application database and still requires consent. Retention on Sarvam's side follows the Sarvam account's settings and terms. The operator must review those and disclose them to learners. Supabase hosts the database and authentication.
