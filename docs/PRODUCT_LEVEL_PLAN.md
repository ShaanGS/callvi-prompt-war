# Callvi: from voice demo to a teaching product

Date: 5 November 2026. Status: product and engineering plan, not a claim that these capabilities are implemented.

The platform vision includes women starting a business, women operating a business, and women preparing for employment. The user agreed to **home business as the first narrow proving ground**, without abandoning that wider vision.

## The promise to prove

A woman can call from a basic phone, explain what she wants to achieve, and receive practical teaching that responds to her situation. Across short return calls, she becomes able to perform useful tasks with less assistance. Callvi remembers consented learning evidence, adapts the next activity, and helps her try a small action outside the call.

For the first course, the tasks are: describe an offer and a likely customer; explain a packet's relevant costs; and handle a simple customer conversation honestly. Passing a lesson or sounding confident is insufficient evidence that she can perform those tasks independently.

The product must earn a claim of advantage over a general voice assistant. We have not run that comparison or validated learner outcomes. Access through a basic phone, useful continuity, trustworthy teaching and demonstrated skill gains are separate hypotheses to test. A particular model, a longer prompt, or more stored conversation is not a demonstrated competitive advantage.

## What the code actually supports today

| Area | Existing foundation | Product gap |
|---|---|---|
| Voice contact | Conversational Tamil/English, interruption support, today's-intent opening and a per-call readiness check | Actual inbound telephone access, shared-phone identity, hangup/drop recovery and noisy basic-phone conditions remain unverified |
| Memory | Consent-gated goal, preferences, enrolment, concept state and structured checkpoints, with provenance and deletion | No durable record of specific misconceptions, assistance used, which explanation helped, due reviews or outside-call follow-through |
| Context | Bounded, learner-scoped starting context and lesson retrieval | Mostly position and status; lacks the evidence needed to decide why to review or teach differently |
| Assessment | Explicit numeric/term rubrics, feedback and safe `ungraded` outcomes | Word/number matching can reward contradictions; it does not reliably understand an open spoken answer |
| Mastery | Per-concept states and ordered progression | One correct response becomes `mastered`; an assisted answer is not distinguished from independent or later performance |
| Adaptation | Prepared alternate explanations and explicit preferences | Explanation usage is session-based; no measured policy for choosing an intervention from earlier evidence |
| Operations | Tool traces, outcomes and operator counts | No validated retention/transfer measurements, teaching-quality release gate or cost per demonstrated skill |

Source anchors: `src/server/services/assessment/assessment-service.ts`, `src/server/agent/learning-policy.ts`, `src/server/agent/context-builder.ts`, `src/server/services/memory-service.ts`, and `src/server/services/staff-service.ts`.

### Reproduced quality failures

These were reproduced by importing the current course and calling the real assessment service with synthetic inputs on 5 November 2026. No real learner data was used.

1. Exercise `sbs-02-unit-cost`: **“It is not 12 rupees. My answer is 120 rupees.”** returns `correct`. The evaluator accepts the expected number anywhere in the answer.
2. Exercise `sbs-01-offer-sentence`: **“நான் முறுக்கு விக்க மாட்டேன். பக்கத்து குடும்பங்களுக்கு விக்கவே மாட்டேன்.”** returns `correct`. Matching product/customer words does not establish the meaning of the statement.
3. `masteryAfterAttempt` maps any `correct` result to `mastered`, and subsequent incorrect answers preserve that mastered state. This is the current MVP progression rule; it is not evidence of retained skill.

The existing passing tests establish important software behavior. They do not establish genuine understanding, retention or benefit to a learner. These failures are a reason to change the evaluation standard before adding more content.

## A teaching loop that spans calls

1. **Understand today's purpose.** Ask what would help; respect a question, a short time window, uncertainty or “not now.” Do not force a lesson.
2. **Establish a starting point.** Use one small diagnostic task, appropriate to the chosen goal. Do not make an experienced learner repeat basic material without a reason.
3. **Teach one useful idea.** Use approved facts and an example relevant to her stated activity. Keep her own context separate from fixed assessment scenarios.
4. **Elicit an attempt.** Let her produce an answer before showing a completed solution. Questions, silence and speech-recognition uncertainty are not wrong answers.
5. **Interpret and assess.** Distinguish what she said, what the rubric supports, what remains uncertain, and how much help was given.
6. **Choose a useful response.** Clarify, hint, change the example, practise a prerequisite, or move forward based on the evidence and her choice.
7. **Check independence.** Use a different example with less help. A copied or heavily prompted answer cannot establish independent performance.
8. **Carry a small action forward.** Offer one practical action and, with permission, revisit it on a later call. A reported action remains self-reported.
9. **Check later.** Offer a short review when she returns; test a fresh example before claiming the skill has been retained.

Example: she divides a batch cost incorrectly. Callvi remembers the demonstrated difficulty and the explanation that helped. On a later call, after she chooses to practise costs, it uses a different batch/packet example. It does not merely announce the next lesson or repeat the previous answer.

## Learner memory: useful facts and learning evidence

Keep three layers separate:

- **Declared context:** her confirmed goal, business stage/product, preferred language and any relevant device constraint she chooses to share. Unknown stays unknown. Today's available time normally stays session-only. Do not turn discovery into an interrogation.
- **Learning evidence:** skill and task version, assessment criteria demonstrated, help provided, specific mistake hypotheses, when it happened, and whether a later independent attempt supported the conclusion. Include source session and assessment version. A hypothesis is not a permanent label on the person.
- **Continuity and action:** current stopping point, unfinished question, review candidates and a small agreed action. Store a later report as self-reported, not verified business success.

Keep provenance, confidence/freshness and correction history. Preferences can change. A successful explanation is evidence for trying it again, not proof of a fixed “learning style.” Ask permission before persisting personal context; keep nonconsented learning session-only. Do not infer education, intelligence, income, family circumstances or emotions from an accent or voice.

The context builder should retrieve just the relevant goal/context, current skill evidence, unresolved difficulty, previous useful intervention and review candidate. It should not inject a complete transcript or all courses. All retrieval stays scoped to the learner and consent policy, and deletion must erase these new memory types too.

## Assessment and mastery requirements

**Calculation:** identify the caller's asserted answer and units. Handle corrections, quoted problem numbers, negation and recognition uncertainty. Deterministic arithmetic checks the interpreted value; finding a number somewhere is insufficient.

**Explanation and role-play:** assess against a reviewed rubric, allowing valid Tamil/Tanglish paraphrases and detecting contradictions, irrelevance and unsupported claims. Any semantic evaluator must return criterion-level evidence and uncertainty, and be calibrated against human-reviewed examples. It cannot mark its own invented completion as the caller's answer. Ambiguous cases get a short clarification or `ungraded`, not false praise.

**Follow-ups:** preserve the exact earlier contribution and the exact missing-detail reply for the same exercise. Record their provenance and the help given. Do not ask for a full repetition merely to satisfy a grader.

**Mastery:** distinguish introduced, practised-with-help, demonstrated-independently and checked-later. The precise state names are an implementation decision. Proposed first-course rule: one correct answer permits moving forward but does not by itself certify retention; a different independent probe and a later check provide stronger evidence. Review can reduce confidence in an earlier conclusion without shaming the learner. Preserve existing learner progress during migration and identify old mastery as legacy evidence, rather than inventing stronger proof.

## What a stronger harness does

The model handles listening and expression. Server-owned policies constrain valid learning actions, state writes, evidence and progression. The existing tool authentication, idempotency and readiness checks remain foundations.

Add an evidence-aware decision layer that can propose **diagnose, clarify, teach, hint, practise, review, or pause** and explain the relevant evidence. It must respect today's purpose, available time and unresolved uncertainty. It should be testable without a voice provider; the voice agent must still be tested against it in real conversations. This is not a request for an autonomous swarm or arbitrary course generation.

Keep release evidence in separate layers:

| Layer | Tests that matter |
|---|---|
| Contracts and isolation | Wrong learner, unconfirmed writes, revoked consent, stale state, duplicate calls, tool failure and partial closure |
| Assessment calibration | Correct/wrong/negated answers, quoted numbers, valid paraphrases, partial follow-ups, corrections, uncertainty and disagreement with teacher labels |
| Longitudinal learning | Assisted success stays assisted; fresh tasks; return after a gap; incorrect later answer; goal correction; memory deletion; no cross-learner contamination |
| Voice interaction | Actual Tamil/Tanglish audio, interruptions, quiet/slow speakers, code switching, unclear recognition, no screen, “not now,” disconnects and tool delays |
| Learner outcomes | Independent performance on unseen tasks, later retention, relevance and a safely reported outside-call action |

A single aggregate green test count cannot substitute for these layers. Track false-positive grading separately from false negatives. Any evaluation suite and human-labelled sample must be versioned. Review failures rather than repeatedly adjusting a prompt until one scripted call passes.

## First proof with home-business learners

Focus on one reviewed path with three demonstrable skills. Recruit an initial small group, for example 5–10 intended learners, for discovery and usability learning. That size can expose misunderstandings; it cannot establish a statistically reliable advantage over alternatives.

For each participant, obtain consent, understand present alternatives, capture a simple starting task, observe calls, and check a new task without help later. Human review of selected consented examples should judge meaning and usefulness. Retain no audio by default; any evaluation recordings need separate, explicit opt-in and a retention policy. Include basic/shared-phone conditions before claiming that channel works.

Compare teaching quality fairly: equivalent tasks, time and relevant material, with independent later evaluation. A generic voice-assistant baseline can help distinguish the benefit of structured teaching from the benefit of merely having assistance. Separately assess whether phone access itself solves a real access problem. Do not assume all free assistants lack memory or tutoring features, or claim we have beaten them without a comparison.

Track the denominators and missing follow-ups: connection success, intent-to-start completion, independently demonstrated tasks before/after, assistance required, later retention, voluntary return, speech failures, false-positive grades, latency and cost per learner/skill. “Course completed,” confidence and call duration are supporting measures, not proof of capability or income.

Proposed initial release gates, to validate with a mentor before use: no false-correct result on the known contradictory examples; no unauthorised cross-learner memory or fabricated saves; no independent/retained label from an assisted answer alone; successful complete calls over the actual phone channel; and acceptable human-reviewed Tamil teaching. Numerical latency, cost and learning-effect targets need measured baselines before commitments.

## Build order and dependencies

1. **Make assessment trustworthy.** Add adversarial regression cases, label a small bilingual benchmark with a Tamil-speaking educator, implement interpreted-answer/criterion evidence and clarification. Address the reproduced false positives first. No new courses in this slice.
2. **Build the learner evidence model.** Separate assistance, independent performance and later checks. Add consent-aware, correctable evidence records and focused context retrieval. Migrate existing progress conservatively.
3. **Make teaching adapt to that evidence.** Add short diagnostics, structured misconceptions, review candidates, alternative interventions and fresh tasks to the flagship course. Validate task quality with a mentor before using it to judge learners.
4. **Complete the phone path and run the pilot.** Telephony discovery can proceed alongside the above. A number alone is insufficient: server tools, caller/shared-phone identity, consent, disconnections and return calls must be verified. SMS stays optional and requires its own opt-in and verified transport before any messages are sent.
5. **Expand only from observed evidence.** Reuse the learning/memory/evaluation core for operating businesses and employment preparation; author and review domain-specific tasks and outcomes separately.

No calendar promise is made here: mentor availability, real learner access, telephony and measured grading quality are dependencies. The first engineering slice is assessment reliability plus evidence capture; platform breadth follows proof on the narrow path.

## Open decisions

- **Product/founder:** where can we reach the first intended learners, and what do they use today? Are we primarily helping first-time starters or also experienced sellers in that initial group?
- **Curriculum/mentor:** who can review Tamil task interpretation, practical accuracy and rubric labels? Which three tasks best represent useful capability?
- **Engineering:** how should interpreted answers, assistance and review evidence be represented and migrated? Which semantic checks can reach an acceptable calibrated error rate?
- **Product/operations:** what review or escalation is actually available when the system cannot assess or help? Do not invent a human handoff that nobody staffs.
- **Commercial/engineering:** who pays for access, and what cost per learner is sustainable? Measure call and inference costs before selecting a business model.

## Research that informs the design, not proof of Callvi

Cole, Joshi and Schoar's phone-business-training evaluation found improvements in business practices, without evidence of a sales/profit impact. It supports investigating phone-delivered practical training, not promising earnings. [Heuristics on Call, World Bank Economic Review (2024)](https://documents1.worldbank.org/curated/en/099149308012421075/pdf/IDU198cbc1df1421614add1b901130eab4fc86f8.pdf).

Bastani and colleagues studied high-school mathematics, where assistance-time performance and later unaided learning differed; tutoring safeguards mitigated adverse effects. Our inference is to measure independent later performance and protect practice. Their population and tasks differ from Callvi's, so this is not evidence that Callvi works or beats another assistant. [PNAS study (2025)](https://www.pnas.org/doi/10.1073/pnas.2422633122), [published correction](https://www.pnas.org/doi/10.1073/pnas.2518204122).
