# Callvi for Prompt War

## Project description

Callvi is a phone-first AI skill-building platform for women learning in Tamil or English. A learner tells the companion her goal, gets a short lesson, asks for a different explanation and practises out loud. Callvi checks her response and, with consent, remembers where to continue next time. The curriculum covers small business, everyday digital skills and communication. The browser app uses Next.js, TypeScript, PostgreSQL and managed Sarvam or ElevenLabs voice. The standalone preview uses the same authored exercises and assessment logic.

## The 60-second pitch

| Time | What to do |
| --- | --- |
| 0–10s | Open Callvi. Say “Imagine you have ten minutes and a phone. What would you like to learn today?” Let a judge choose a skill. |
| 10–25s | In the live browser app, call the companion and state a learning goal. In the public preview, play the sample greeting and open the selected skill. |
| 25–45s | For small business, try the cost of one packet. Ask for another explanation and give an answer. Switch to Tamil to hear the same practice question. For digital skills, try the payment verification scenario instead. |
| 45–60s | Show how the response changes the feedback. Explain that a live learner can pause and return to a saved step if she grants memory consent. |

The public preview offers three interactive examples. The communication example is a tailoring conversation. The published audio sample captures the live agent teaching the cost of one packet. A physical handset demonstration requires a verified inbound number.

## Cloud Run

Use a billing-enabled project with Cloud Run, Cloud Build and Artifact Registry access. The Dockerfile builds the Next.js standalone server and listens on Cloud Run's injected port. The upload ignores local keys, generated files and learner databases.

1. Configure a dedicated hosted Postgres/Supabase database following [Setup](SETUP.md). From the checkout, set the target database and run `npm run db:migrate` and `npm run db:seed`. Seeding publishes the new rehearsal. Do this for existing deployments too.
2. In Secret Manager, make versions available to the service's runtime identity. The example uses secret names matching the environment variables and version 1. Supply the matching secret versions for your project. Keep signing and phone identity keys stable across revisions.
3. In Cloud Shell, run the following from the project root for a Sarvam deployment. Set `PROJECT_ID` and `REGION` to your deployment target. Add the phone agent and its separate bearer secret when the inbound agent exists.

```bash
secrets="DATABASE_URL,APP_SIGNING_SECRET,PHONE_HASH_SECRET,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SARVAM_API_KEY,SARVAM_ORG_ID,SARVAM_WORKSPACE_ID,SARVAM_WEB_APP_ID,SARVAM_TOOL_SECRET_BROWSER"
bindings=$(echo "$secrets" | tr ',' '\n' | awk '{print $0 "=" $0 ":1"}' | paste -sd, -)
gcloud run deploy callvi --source . --project "$PROJECT_ID" --region "$REGION" \
  --allow-unauthenticated --max-instances 1 --memory 1Gi \
  --set-env-vars BROWSER_VOICE_PROVIDER=sarvam --set-secrets "$bindings"
url=$(gcloud run services describe callvi --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')
curl --fail "$url/api/health"
npm run sarvam:config -- --channel browser --app-url "$url"
npm run sarvam:config -- --channel phone --app-url "$url"
```

Configure the published Sarvam agents with those HTTPS callback URLs. The source of truth for tool timing and request parameters is the generated configuration. Attach a number to the **phone** agent in an inbound deployment. Set `SARVAM_PHONE_APP_ID` and `SARVAM_TOOL_SECRET_PHONE` on the service before testing. Confirm hangup, redial, spoken feedback and consented resume, then set `PHONE_DISPLAY_NUMBER` and `PHONE_CHANNEL_VERIFIED=true`. The verified number becomes a dial link on the homepage.

[Google Cloud source deployments](https://cloud.google.com/run/docs/deploying-source-code) · [Secret Manager bindings](https://cloud.google.com/run/docs/configuring/services/secrets) · [Sarvam phone numbers](https://docs.sarvam.ai/voice-agents/deploy/telephony/manage-numbers)

### Deploy the public learning preview by itself

For a Cloud Run service with the same three interactive lessons as GitHub Pages, run the following in Cloud Shell from the repository root. This publishes the recorded call and browser exercises. The live AI browser calls, database and learner checkpoints use the full application deployment above.

```bash
set -e
PROJECT_ID="$(gcloud config get-value project)"
REGION=asia-south1
npm ci
npm run build:rehearsal
stage="$(mktemp -d)"
cp -R dist/rehearsal-demo "$stage/site"
cat > "$stage/Dockerfile" <<'DOCKER'
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY site/ /usr/share/nginx/html/
DOCKER
gcloud run deploy callvi-preview --source "$stage" --project "$PROJECT_ID" --region "$REGION" \
  --allow-unauthenticated --port 8080 --max-instances 2
url="$(gcloud run services describe callvi-preview --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
curl --fail --silent --output /dev/null "$url/"
echo "$url"
```

## Submission

### Verification on November 18

The production standalone build passed and returned HTTP 200 from its health endpoint with the hosted PostgreSQL connection. All 126 unit and integration tests passed. Six desktop/mobile browser journeys passed, including the new keyboard-only rehearsal. A separate live Sarvam browser test used a synthetic microphone and reached the provider's speaking state. Run it explicitly with `LIVE_SARVAM_TEST=1` and `npx playwright test e2e/live-sarvam.spec.ts --project desktop` against a configured agent. Seven optional ElevenLabs journeys were skipped in this run.

The phone regression exercises the actual authenticated tool handler, curriculum and database across two simulated carrier interactions. At verification time the Sarvam workspace had zero inbound deployments. Physical handset audio, hangup delivery, redial and production callback routing still need a live test after deployment.

### Verification on November 19

The full application passed its production build, 126 unit and integration tests and eight standard desktop/mobile browser journeys. An additional live Sarvam smoke test reached the speaking state. In a separate browser call, a synthetic caller asked to practise a tailoring conversation. The live agent identified pricing and pickup times and asked the caller to confirm that goal. A subsequent synthetic learner asked about unit cost. The published excerpt includes the agent teaching ₹50 divided by five packets and offering another example. Full spoken lesson completion and real handset delivery still need separate verification.

The public rehearsal offers English and Tamil customer audio, optional browser dictation and spoken coaching. Dictation availability and accuracy depend on the browser, language and microphone permission. The typed flow and recorded feedback work independently.

Provide the public one-branch repository under 10 MB, working Cloud Run service URL, project description above and LinkedIn post URL. The README identifies the pre-existing Callvi components and the features built for this edition. Open the final links in a signed-out browser before using one of the two submission attempts.

### LinkedIn draft

What would you like to learn if a lesson were a phone call away?

We built Callvi for women who want to practise everyday skills in Tamil or English. A learner can ask how to work out the cost of one packet, how to check a digital payment, or how to explain an idea clearly. Callvi teaches one step at a time, offers another example when needed and checks the learner’s attempt.

For Prompt War’s AI for Education track, we built on our earlier voice companion and made three learning paths available to try in a browser. The demo includes a recording from a live AI call.

Try Callvi: https://shaangs.github.io/callvi-prompt-war/
Source: https://github.com/ShaanGS/callvi-prompt-war
