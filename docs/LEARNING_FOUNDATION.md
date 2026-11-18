# Evidence-led teaching: first shipped increment

Callvi serves the learner through the conversation. This increment focuses on home-business skills, learner-owned evidence and useful return calls. It keeps the existing everyday Tamil with light English mixing and the explicit choice to learn in each call.

## What changes

- A correct practice answer advances the course as `practised`. It does not establish mastery, independent learning or retention. Legacy `mastered` rows remain compatible course-progress records and are displayed as practised; no historical evidence is invented.
- Every new durable attempt saves a small evidence row atomically with the attempt: result, rubric version, criteria met/missed, recorded help, explanation approach and session. There is no extra transcript or audio in evidence.
- Help labels describe what the runtime supplied, not a claim about everything the caller heard. `none_recorded` is deliberately not called independent learning. Another explanation, a hint or a model answer makes the subsequent result assisted.
- New-call context includes relevant observed practice and difficulty. The caller still chooses whether to review, continue, ask a question or leave. Nothing launches from a greeting or saved course alone.
- The flagship course has one authored fresh review question per idea (nine total). The numeric review changes the batch from 120/10 to 180/10. Review initially withholds the explanation, key points and example answer.
- A fresh successful review is labelled `checked_again` only when the question differs from a previous success, the call differs, at least 24 hours elapsed and no help was recorded for that question. This is an observation, not proof of durable mastery. The 24-hour interval is an initial product rule, not a validated optimal learning schedule.
- A later wrong answer surfaces a practice need without erasing completed course work. Reviewing an earlier lesson does not move enrolment backwards or trigger another course completion.
- The progress page reflects help, clarification and later checks separately from course advancement. The same information is available in spoken memory/context tools.

## Assessment limits

The hosted agent uses GPT-6 Sol with reasoning disabled for voice latency, retaining the Janani Tamil voice. GPT-4.1 skipped required assessment calls in repeated-answer/correction checks even after prompt tightening. Model changes must pass the live spoken-question and repeated-answer tests; deterministic unit tests alone cannot establish model compliance.

Grading remains a bounded bilingual rubric interpreter. Numeric interpretation selects an identifiable asserted answer rather than accepting any matching number; multiple possible answers, unsupported negatives and uncertainty ask for clarification without revealing the answer. Known negated product/customer statements do not earn positive concept credit. Honest delivery-limit criteria permit explicit relevant negative statements.

This does not solve general semantic equivalence, contradictory long answers or every Tamil/ASR form. Open answers outside recognised criteria remain ungraded or partial. Native-speaker evaluation, expert content review and a broader semantic assessment evaluation set remain necessary before a wider pilot.

## Privacy and persistence

Evidence is scoped to the learner and enrolment. RLS permits only an authenticated owner's reads and no direct browser writes. Browser guest identity uses the existing signed-cookie ownership checks. Evidence is written only with durable-memory consent. Deleting practice or enrolments cascades to evidence; turning memory off erases it. Session-only learners can practise without creating durable evidence.

## Validation and remaining work

Regression coverage includes quoted wrong answers, ambiguous calculations, everyday Tamil amounts, negated claims, help versus unassisted checks, question/call/day separation, idempotent retries, earlier-lesson review, leaving review, course position, consent withdrawal and row ownership. Browser checks cover desktop/mobile journeys and a real ElevenLabs Tamil return call with a wrong answer, hint, correction and saved ending. Scripted voice tests inject text turns and receive real TTS; they do not establish native listening quality or learning effectiveness.

This increment does not connect a public telephone number or SMS. It also does not yet provide a full spaced-review question bank, a learner-confirmed business profile, follow-up on real-world actions, or validated learner outcomes. Those are the next platform work, alongside a pilot with women building home businesses.
