# Product Requirements Document (PRD)

**Product:** Voice-first AI Learning Companion  
**Team:** marlloz  
**Version:** 0.1  
**Status:** Product-quality MVP specification  
**Primary language for first course:** Tamil  

## 1. Product vision

Make practical learning easier to start and continue for people who are poorly served by app-centric learning experiences. A learner should be able to call a number, explain what they want to achieve, learn through a natural conversation, practise aloud and return later without losing progress.

The course provides structure. The learner provides the direction. The agent adapts the learning journey.

## 2. Problem framing

### 2.1 Provisional problem statement

Women seeking practical skills for employment or self-employment may need a flexible learning experience that fits around work and family responsibilities, supports their preferred language and does not depend on navigating an app or having a smartphone. Conventional digital courses can impose reading, typing, navigation and scheduling demands that create friction for some learners.

This is a **working problem hypothesis**, not a universal statement about women. It must be validated with direct user research.

### 2.2 Design-thinking framing

**Empathise:** Understand the learner's daily routine, learning aspirations, available devices, language preferences, confidence asking questions, current learning alternatives, constraints and sources of trust.

**Define:** Identify the specific unmet need from research. Do not begin by assuming that lack of an app is the only problem. Possible barriers to investigate include time, language, literacy, confidence, device access, data cost, course relevance, social support and continuity.

**Ideate:** Explore voice-first tutoring, community-assisted onboarding, flexible micro-sessions, goal-driven course paths and spoken practice. Compare ideas against user needs, feasibility and safety.

**Prototype:** Test a narrow journey end-to-end: identify a goal, select a course, learn one concept, complete a spoken exercise and save progress.

**Test:** Observe real users attempting tasks. Record what they understand, where they get confused, whether they can interrupt or ask for repetition, and whether they want to return.

### 2.3 Research status

Known source from the team's poster:

- Cole, Joshi & Schoar (2024), “Heuristics on Call”, *The World Bank Economic Review*, 38(3), 580–597. The poster cites this as evidence that phone-based business training in India and the Philippines improved business practices, while not establishing higher sales or profits.

Research gaps to close:

- Conduct short interviews or contextual conversations with intended learners.
- Understand actual phone ownership and access: basic phone, shared smartphone, own smartphone, or no reliable access.
- Understand whether a learner can make a call privately and at a convenient time.
- Validate Tamil preference and code-mixed speech needs.
- Identify trusted referral channels and whether the learner wants support from a trainer or women's group.
- Do not generalise findings from a small convenience sample to all women or all tier-2/tier-3 communities.

## 3. Target users and stakeholders

### 3.1 Primary user

A woman interested in learning a practical skill for employment, self-employment or personal capability, who may prefer voice interaction or face friction with conventional app-based courses. The initial release begins with Tamil-speaking learners but should not assume all learners prefer Tamil.

### 3.2 Secondary users and stakeholders

- Women seeking employment or self-employment.
- Homemakers and women returning to work.
- Women's self-help groups and community organisations that may introduce learners to the service.
- Course mentors/trainers who review curriculum and practical exercises.
- NGOs, CSR programmes and skill-development organisations that may sponsor or distribute access.
- Employers or local business networks that may offer real-world pathways.
- Telephony, speech and AI infrastructure providers.

**User/customer distinction:** The learner is the primary user and beneficiary. A community organisation, NGO, CSR sponsor or institutional programme may be the paying customer or distribution partner. This is a business-model hypothesis to validate, not a confirmed commercial arrangement.

## 4. Jobs to be done

- When I have a goal but do not know where to start, help me turn it into a manageable learning path.
- When I do not understand something, explain it another way without making me feel embarrassed.
- When I have only a short window of time, let me learn in a short session and continue later.
- When I speak naturally, including pauses or code-mixing, understand what I mean and respond clearly.
- When I return, remember my goal and where I stopped, without making me repeat everything.
- When I practise, give useful feedback and help me improve.

## 5. Core product experience

1. **Discover and call:** Learner receives the number through a trusted channel and calls when convenient.
2. **Welcome and consent:** Agent identifies itself as AI, explains the learning service and asks permission to save progress. Learner can continue, decline persistence or request deletion.
3. **Language choice:** Start in Tamil for the first pilot; allow supported language preference and code-mixed speech where configured.
4. **Goal discovery:** Ask one question at a time. Understand the learner's goal, prior familiarity and time constraints without conducting a long form-like interrogation.
5. **Course recommendation:** Present a small number of relevant choices in plain spoken language. Learner can ask questions or choose another course.
6. **Adaptive learning:** Teach one concept at a time using approved course content. Explain with examples relevant to the learner's context. Allow interruption, repetition and alternate explanations.
7. **Practice:** Ask a short spoken question or scenario. Assess against a course rubric, explain feedback and allow retry.
8. **Checkpoint:** Save current course, lesson, concept, answer status, learner preference and a concise session summary.
9. **Resume:** On the next call, identify the learner, confirm the remembered goal and offer to continue, review or change direction.
10. **Real-world application:** Suggest a small, safe action the learner can try. Do not promise employment or income outcomes.

## 6. Initial product scope

### 6.1 Core product capabilities

- Three selectable courses in the initial catalogue.
- Tamil-first conversation, with English/Tanglish fallback as supported by selected provider configuration.
- Natural conversational teaching, not a fixed recording.
- One clear learning goal captured per learner.
- Course/lesson retrieval from reviewed content.
- At least one spoken practice interaction with feedback.
- Persistent progress across two separate sessions.
- Learner/course/progress view in a simple operator dashboard.
- Visible distinction between real phone calling and browser-microphone testing.

### 6.2 Initial course catalogue

**Course 1 — Small Business Starter (flagship; Tamil):**
- Identify a simple product or service and customer.
- Understand cost, price and basic profit using small numbers.
- Practise describing the product and responding to a customer question.

**Course 2 — Digital Basics for a Small Business (preview):**
- Understand basic digital record-keeping.
- Recognise safe habits when handling digital payments and payment confirmations.
- Practise a simple daily sales record.

**Course 3 — Customer Communication (preview):**
- Introduce a product clearly.
- Ask a customer what they need.
- Respond politely to common questions and practise a short sales conversation.

The primary course should be the deepest and most polished. Supporting courses may contain shorter lesson paths. Course material must be reviewed and must not be presented as certified vocational training.

## 7. Functional requirements

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-01 | Start a voice session | P0 | Learner can start an available phone or browser voice session; channel is labelled correctly. |
| FR-02 | Identify or create learner | P0 | Inbound caller can be matched to an existing learner or start a new profile with consent. Browser learners must have an authenticated or securely issued learner identity. Seeded identities are allowed only in local development and automated tests. |
| FR-03 | Set a learning goal | P0 | Agent captures a short goal and confirms it with learner. |
| FR-04 | Browse/select course | P0 | Agent can list 2–3 seeded courses and enrol learner in one. |
| FR-05 | Retrieve approved lesson content | P0 | Agent receives relevant concept, examples, task and rubric from course data. |
| FR-06 | Adapt explanation | P0 | Learner can ask for repetition or another explanation; agent changes approach instead of repeating verbatim. |
| FR-07 | Spoken practice | P0 | Agent asks at least one question and records an assessed attempt with feedback. |
| FR-08 | Save checkpoint | P0 | Session end or explicit checkpoint saves lesson position and summary. |
| FR-09 | Resume learning | P0 | A second session restores goal and progress and offers a useful continuation. |
| FR-10 | Operator dashboard | P1 | Shows course list, learner progress, recent sessions and last checkpoint. |
| FR-11 | Transcript/trace view | P1 | Shows redacted transcript or structured event trace for authorised operational support and quality review, subject to consent. |
| FR-12 | User memory controls | P1 | Learner can ask what is remembered and request correction or deletion. |
| FR-13 | Multi-language expansion | P2 | Add more languages only after validating language quality. |

## 8. Non-functional requirements

- **Latency:** Minimise dead air. The agent should use short acknowledgements while retrieval/tool calls execute. Measure actual response latency rather than claiming a target without tests.
- **Reliability:** Handle missing caller IDs, tool timeouts, repeated webhook delivery, interrupted calls and partial sessions gracefully.
- **Privacy:** Collect only data needed for learning continuity. Explain what is stored. Do not retain audio recordings by default. Do not expose phone numbers or secrets in logs.
- **Security:** Server-only secrets, validated schemas, authenticated tool endpoints, database access controls and rate limiting.
- **Accessibility:** Short spoken chunks, simple words, one question at a time, repeat/slow-down ability and no dependence on reading a screen.
- **Maintainability:** Provider adapters, typed contracts, modular course data and automated tests for memory and progression.
- **Truthfulness:** Never claim that the agent is a human, a certified trainer or a guaranteed route to employment/income.

## 9. Out of scope for the initial product release

- Open-ended course creation for arbitrary topics.
- Fully autonomous multi-agent swarms.
- Outbound mass calling or marketing campaigns.
- Payments, loans, job placement guarantees or financial transactions.
- Official certificates or accreditation.
- Production-grade multilingual coverage beyond tested languages.
- Large-scale analytics or unverified market-size projections.

## 10. Success metrics

Initial release acceptance metrics:

- Voice session connects successfully.
- Learner goal is captured and confirmed.
- Course starts and a lesson is completed.
- At least one practice attempt is recorded.
- Learner can resume with the correct checkpoint in a second session.
- Agent handles repetition, interruption and an off-topic question without losing the lesson state.

Pilot metrics to validate later:

- First-call activation and successful onboarding.
- Repeat-call rate and time between sessions.
- Lesson completion and practice improvement.
- Learner-reported clarity, confidence and relevance.
- Demonstrated application of a skill in a real situation.
- Longer-term employment/self-employment outcomes, measured separately and not inferred from course completion.

## 11. Business model hypotheses

Potential paying customers or sponsors:

- NGOs and community organisations licensing the service for a cohort.
- CSR programmes funding access for a defined learner group.
- Government or institutional skill-development programmes.
- Training organisations paying per active learner or cohort.

Potential pricing structures to investigate: per enrolled learner, per completed learning programme, cohort subscription or sponsored usage. Validate telephony and inference cost before selecting a model. Do not invent TAM/SAM/SOM numbers. Market sizing needs sourced learner/population counts, realistic reach assumptions and a transparent bottom-up calculation.

## 12. Competitive and literature review plan

Compare the product with categories, not just brand names:

- Recorded IVR and telephone lessons.
- Conventional LMS and mobile learning apps.
- Messaging-based learning assistants.
- General-purpose voice assistants.
- AI voice-agent platforms.
- Human trainers and community-based skill programmes.

Comparison criteria: phone access, need for smartphone/data, natural interruption, adaptive explanation, structured curriculum, spoken practice, learner memory, progress continuity, human escalation, language quality, delivery cost and evidence of learning outcomes.

Literature starting point from the team's poster: Cole, Joshi & Schoar (2024), “Heuristics on Call”, *The World Bank Economic Review*, 38(3), 580–597. The poster states that phone-based business training improved business practices but did not establish increased sales or profits. Treat this as a starting point and inspect the paper before quoting detailed findings.

## 13. Risks and mitigations

- **AI teaches incorrect material:** Use curated course content, short retrieval context, bounded lessons and safe fallback to a mentor.
- **Tamil recognition/speech quality varies:** Test with real speakers, code-mixing and noisy phone conditions; keep a browser test path.
- **Call costs or number unavailable:** Verify provider workspace, number provisioning and pricing; maintain browser voice as an independently supported product channel.
- **Memory overreach:** Store only learning-relevant facts, ask consent, show/correct/delete memory.
- **Learner cannot use the phone privately:** Offer flexible call-back timing only with consent; avoid unsolicited outbound calls.
- **Course completion mistaken for empowerment:** Measure skill demonstration and real-world application, not completion alone.
