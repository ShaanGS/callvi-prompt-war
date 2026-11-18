# Callvi for Prompt War

## Project description

Callvi is an AI for Education assistant for women who run small businesses and want to practise real customer conversations in Tamil or English. A caller can rehearse a price negotiation, hear which part of her offer was unclear and try again. The learner chooses whether Callvi remembers her place. The web version offers microphone access and a keyboard-only rehearsal. A configured inbound phone agent can deliver the lesson through speech on a basic phone.

## Demonstrate the decision

1. Open Callvi and choose English or Tamil. In a voice session, say “I'd like to rehearse a customer call” or “தையல் வாடிக்கையாளரிடம் விலை பேசிப் பழகணும்.” Choose the rehearsal when offered. The agent asks separately about memory.
2. When the customer asks for a discount and an earlier pickup, answer “I charge fifty rupees.” Callvi should ask about pickup. Give the full offer in your own words. Try giving only the pickup time on a new attempt to hear the other branch.
3. In a room without a microphone, open **Practise by text**. Give both answers and compare the feedback. This route runs the same assessment in the browser and discards the attempts when you leave.
4. For a live telephone demo, dial the verified inbound line from a private test handset. Pause after the first attempt and hang up. Redial from that handset, ask to continue and finish the answer. Verify the consented course and fresh learning-intent check on the second call. Use fictional learning details. A shared caller ID identifies a line and cannot distinguish the people using it.

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

## Submission

### Verification on November 18

The production standalone build passed and returned HTTP 200 from its health endpoint with the hosted PostgreSQL connection. All 126 unit and integration tests passed. Six desktop/mobile browser journeys passed, including the new keyboard-only rehearsal. A separate live Sarvam browser test used a synthetic microphone and reached the provider's speaking state. Run it explicitly with `LIVE_SARVAM_TEST=1` and `npx playwright test e2e/live-sarvam.spec.ts --project desktop` against a configured agent. Seven optional ElevenLabs journeys were skipped in this run.

The phone regression exercises the actual authenticated tool handler, curriculum and database across two simulated carrier interactions. At verification time the Sarvam workspace had zero inbound deployments. Physical handset audio, hangup delivery, redial and production callback routing still need a live test after deployment.

Provide the public one-branch repository under 10 MB, working Cloud Run service URL, project description above and LinkedIn post URL. The README identifies the pre-existing Callvi components and the features built for this edition. Open the final links in a signed-out browser before using one of the two submission attempts.

**LinkedIn draft**

What do you say when a customer asks for a discount and wants the order tomorrow? We built a Tamil and English customer-call rehearsal for Callvi at Prompt War. You can play a home tailor, quote your fee, and try again after hearing which detail the customer still needs. The exercise builds on our earlier work on Callvi, a voice learning companion for women building practical skills.

Try the rehearsal: [insert verified Cloud Run link]
