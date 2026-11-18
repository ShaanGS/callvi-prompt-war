# The call is the product

Callvi's primary experience is one voice contact for women building practical skills. A learner may have only a basic button phone. An app, account, internet connection, screen, typed form or link cannot be required to understand the service or navigate it. The browser is the current demo channel. SMS can eventually support the conversation, but must never be essential.

## A call has a purpose chosen by the caller

The opening explains Callvi briefly and asks what would help today. It is not a lesson-start button. A caller might want to learn, practise, review, ask a practical question, change direction or simply find out what the service does.

For a new caller, establish that purpose before collecting memory permission. When remembering a goal or stopping point becomes relevant, explain it and ask once. Learning remains possible if she declines. Confirm a goal and offer a course by what she can do with it, not by reading a catalogue. Ask whether she wants to start now and wait.

For a returning caller, greet her and ask what she needs today. Use saved learning to help with her choice; do not automatically resume it. “Hello,” “okay,” memory consent and an existing enrolment are not agreement to learn. A clear “continue my lesson” is enough: do not ask a second time.

If she is unsure, give one or two relevant examples. If she says not now, respect it. If she asks what Callvi is, explain it without opening a lesson. Avoid unnecessary small talk or a rigid onboarding interrogation.

## Every essential action works through speech

The caller can ask for Tamil or English, a simpler explanation, a repeat, a slower pace, review, practice, a new goal, an explanation of what is remembered, deletion, a pause or the end of the call. No onscreen course selection or settings page is needed for those conversations. Do not assume a smartphone when choosing an activity; explain device requirements and offer a suitable alternative.

Teaching is short and responsive: one idea, one practice question, the caller's answer, then assessment and one useful next step. Explain feedback aloud. At the end, say what was actually saved and the practical next step. Never claim a save, order, message or callback that did not happen.

## Implemented now

The ElevenLabs demo uses a service-style first greeting and a separate, warm returning greeting. The authenticated connection supplies the caller's actual starting consent and learning context to the agent; it does not have to guess the state while opening the conversation. The server refuses the first lesson retrieval of each voice call unless `learner_ready=true` records an explicit choice in that call. The flag is session state, defaults to false and is not restored from a checkpoint. This is separate from memory consent and enrolment. Subsequent lesson requests in that call do not need another readiness check.

Live regressions cover service questions without a screen, declining a lesson on both new and return calls, a polite “okay” not launching teaching, and an explicit request resuming the correct saved idea. Backend tests cover the readiness check resetting for a new call. The retained Sarvam setup also describes the same spoken contact flow.

## Still required for a real button-phone launch

A public inbound telephone number, the phone provider's server-side tool connection, caller identity/shared-phone behavior, hangup and dropped-call handling, and a real second-call test must be connected and verified. The ElevenLabs browser demo currently executes client tools in the browser; changing the prompt alone does not make those tools run over a telephone line. Existing Sarvam phone support is an implementation path, not a claim of live telephony.

SMS delivery is not connected. A later SMS feature needs its own explicit opt-in and a verified sender and delivery path. It should provide a short recap or reminder rather than a mandatory link or app installation. No SMS is sent or promised by the current agent.
