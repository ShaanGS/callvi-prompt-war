# Setup

This guide covers local development, a production deployment on Supabase, and configuring the Sarvam voice agents. The product works without any external credentials in development: it uses an embedded database, a private browser identity and the text study room. Browser voice uses the configured Sarvam or ElevenLabs agent. Inbound phone uses Sarvam. Phone also needs a verified inbound number.

## 1. Local development

Requirements: Node.js 20.12 or newer (developed on Node 24) and npm.

```bash
npm install
cp .env.example .env.local      # optional: everything is optional in development
npm run dev                     # http://localhost:3000
```

With no `DATABASE_URL`, the app opens an embedded PostgreSQL database (PGlite) in `.data/pglite`. It applies the migrations in `supabase/migrations/` and seeds the course catalogue on first use. To start again from an empty database, delete `.data/`. Only one process can open the embedded database at a time, so stop `npm run dev` before running `db:*` scripts against the same directory, or point the script at another directory with `LOCAL_DB_DIR`.

Learners open `/` to choose their language and start a call or a practice session. A signed, httpOnly browser cookie keeps each learner separate; consent still controls whether learning progress is saved. Progress resumes only in the same browser profile. Clearing cookies or switching devices starts a new learner.

Apply all migrations, including `20261104000300_browser_identity.sql`, before deploying this version to a hosted database.

For operators only, `/sign-in?next=/staff` offers a **development sign-in** when Supabase Auth is not configured:

- The same name always maps to the same learner, which makes it easy to test resuming in a second session.
- Ticking "staff" grants development staff access, which opens the `/staff` workspace.
- It is refused whenever `NODE_ENV=production`, and the app will not start in production with `DEV_AUTH_ENABLED` set.

### Checks

```bash
npm run lint
npm run typecheck
npm test                 # unit, integration and the 12 agent scenarios (Vitest, in-memory PGlite)
npx playwright install chromium   # first time only
npm run test:e2e         # browser journeys against a dev server on port 3100
npm run build
```

## 2. Production database (Supabase)

1. Create a Supabase project. Copy the **transaction pooler** connection string (port **6543**, host `…pooler.supabase.com`) into `DATABASE_URL`, with the password URL-encoded. The adapter uses `prepare: false`, `max_pipeline: 1`, a single client connection per instance and a short idle timeout. Disabling pipelining avoids overlapping query batches, while transaction pooling prevents serverless instances from reserving every database connection. The direct connection (`db.<ref>.supabase.co`) is IPv6-only on many plans and may not be reachable from Vercel.
2. Apply the migrations, then seed the courses:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   The files in `supabase/migrations/` are also valid Supabase CLI migrations (`supabase db push`). They enable row-level security on every table:
   - Browser clients (anon and authenticated roles) can read published course content.
   - A signed-in user can read their own learner rows.
   - Browsers cannot write anything directly. All writes go through the server.

3. Set `APP_SIGNING_SECRET` and `PHONE_HASH_SECRET`. Each must be a random value of at least 32 characters. `.env.example` shows a command that generates one.

## 3. Learner and staff sign-in (Supabase Auth)

1. In Supabase, go to **Authentication → Providers → Email** and enable email sign-in.
2. The app signs people in with a **one-time code**, not a magic link. Edit **Authentication → Email Templates → Magic Link** so that it shows the code:

   ```html
   <h2>Your Learning Companion sign-in code</h2>
   <p>Enter this code to sign in: <strong>{{ .Token }}</strong></p>
   <p>If you did not ask for this, you can ignore this email.</p>
   ```

3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The anon key is designed to be public, and RLS limits what it can read.
4. Optional: set `SUPABASE_SERVICE_ROLE_KEY` (server-only) so that "Delete my account" also deletes the Supabase Auth user. Without it, learning data is still deleted, and the learner is told their sign-in record needs a manual removal.
5. Configure Supabase's SMTP settings for production. The built-in mailer is heavily rate-limited.

### Granting staff access

Staff are Supabase Auth users with a row in `staff_members`. There is no self-service staff sign-up.

```bash
# Find the user's id under Authentication → Users after they have signed in once.
npm run staff:grant -- --subject <auth-user-uuid> --role staff     # or --role admin
npm run staff:grant -- --subject <auth-user-uuid> --revoke
```

## 4. Sarvam voice agents

Voice is provided by Sarvam Voice Agents. The application keeps ownership of the learner's identity, consent, goals, courses, progress and memory. The agent reaches all of these through authenticated HTTPS API tools. Two agents are needed:

| Agent | Used for | `user_identifier` the app expects | Tool secret |
|---|---|---|---|
| Browser agent | Voice in the web app (Web SDK) | The signed `lcv1.` voice-session token the app issues | `SARVAM_TOOL_SECRET_BROWSER` |
| Phone agent | Inbound calls to your number | The caller number Sarvam supplies (HMAC-hashed immediately) | `SARVAM_TOOL_SECRET_PHONE` |

The two secrets must be different. A browser can never reach the phone identity path because it cannot present the phone agent's secret.

### 4.1 Create the agents

1. Create both agents in the Sarvam dashboard and choose Tamil and English as the languages.
2. Generate the instructions and tool settings from the code, so the dashboard cannot drift from the application:

   ```bash
   npm run sarvam:config -- --channel browser --app-url https://your-deployment.example
   npm run sarvam:config -- --channel phone   --app-url https://your-deployment.example
   # add --json for machine-readable output
   ```

   The same output is shown to staff at `/staff/setup`.
3. Paste the **agent instructions** into each agent's prompt. Curriculum and learner memory are deliberately left out of the prompt. They come from tools at run time.

### 4.2 Add the API tools

For each tool listed by `sarvam:config`, add an **API tool** to the agent with the following settings:

- **Method and URL:** `POST https://your-deployment.example/api/voice/tools/<tool_name>`
- **Authentication:** bearer token. Store the matching tool secret as a workspace secret and select it.
- **Request body:** the JSON template printed by the script. Insert the call's **User Identifier** and **Interaction ID** call variables using the dashboard's variable picker (`@`). The agent fills in the tool's other parameters.
- **When to run:**
  - `get_learning_context` during the conversation, immediately after the greeting, to retrieve the learner’s context.
  - `close_learning_session` at **on_end**, which saves an end-of-call checkpoint.
  - All other tools during the conversation.

Every state-changing tool is idempotent, and a duplicate `on_end` call is safe.

### 4.3 Browser voice

1. Set `SARVAM_API_KEY`, `SARVAM_ORG_ID`, `SARVAM_WORKSPACE_ID` and `SARVAM_WEB_APP_ID`. `SARVAM_WEB_APP_VERSION` is optional and pins a published version.
2. Set `SARVAM_TOOL_SECRET_BROWSER`.

The browser SDK never receives the API key. The SDK's `baseUrl` points at the same-origin proxy at `/api/voice/sarvam/`. That route requires a signed-in learner, rate-limits requests, accepts only the configured browser agent, adds `X-API-Key` on the server, and returns only `{ url, reference_id }`. Once every variable is set, the voice option appears on `/learn`.

### 4.4 Phone

1. Attach the phone agent to an inbound number in Sarvam.
2. Set `SARVAM_PHONE_APP_ID` and `SARVAM_TOOL_SECRET_PHONE`.
3. Run the real-call verification:
   1. Call the number. Grant consent, set a goal, choose a course and finish part of a lesson, then hang up.
   2. Call again from the same number and confirm that the agent resumes at the saved lesson and idea.
   3. Check `/staff/traces` for successful context retrieval and `on_end` calls.
4. Only after both calls pass, set `PHONE_CHANNEL_VERIFIED=true` and `PHONE_DISPLAY_NUMBER`. The number is not shown to learners before then.

Callers whose number is withheld get a session-only learner, which is deleted when the call ends.

## 5. Health and operations

- `GET /api/health` returns whether the database is reachable. It returns no configuration values.
- `/staff/setup` lists missing configuration items (names only, never values) and the readiness of each channel.
- `/staff/traces` shows tool calls with their status, latency and error codes. Argument values are not stored, only argument names and sizes.


## ElevenLabs browser voice (localhost and Vercel)

Set `ELEVENLABS_API_KEY` in `.env.local`, then run `npm run elevenlabs:configure`. This creates the private Callvi agent with the application's 12 client tools, disables audio recording, and saves `ELEVENLABS_AGENT_ID` and `BROWSER_VOICE_PROVIDER=elevenlabs` locally. Restart the development server after the first setup so the provider migration is applied.

The browser obtains a short-lived signed WebSocket URL from its authenticated session endpoint. Client tools call the same-origin learning APIs with the learner's cookie. This works on localhost without a public tunnel and keeps local and production databases separate. API keys never reach the browser.

On Vercel set the same three variables for production. `vercel.json` applies migrations and seeds courses before building, using production environment variables. Learners enter without signing in. Operator sign-in remains protected.

The opt-in `LIVE_VOICE_TEST=1` browser test consumes provider credits and uses a synthetic learner. Normal test runs skip it.

Production functions are pinned to Singapore (`sin1`) beside the Supabase database to keep learning-tool round trips short.
