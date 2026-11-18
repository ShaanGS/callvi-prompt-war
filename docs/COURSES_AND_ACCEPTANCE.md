# Initial Course Catalogue and Product Acceptance

**Purpose:** Define the three initial learning pathways and the behaviours the product must reliably support. These are real product content records, not presentation-only demo screens.

## 1. Initial course catalogue

### Course 1 — Small Business Starter (flagship; Tamil-first)

**Audience:** Learners exploring a small home-based or local business. Avoid assuming that every learner wants to start a business or has the same resources.

**Learning outcomes:**
- Identify a product or service and describe a possible customer.
- Distinguish cost, selling price and simple profit using small, transparent examples.
- Practise describing a product and responding to a customer question.

**Lessons:**
1. A business idea and its customer: needs, product fit and a simple customer description.
2. Cost, price and profit: identify direct costs, calculate per-unit cost and understand the difference between cost and selling price.
3. Talking about a product: describe what is offered, ask a customer what they need and respond clearly.

**Practice example:** Ingredients cost ₹120 for 10 packets. Ask the learner to calculate the cost per packet. Then explain that a selling price must account for all relevant costs; do not prescribe a price without enough information.

### Course 2 — Digital Basics for a Small Business

**Learning outcomes:**
- Keep a simple daily sales and expense record.
- Understand basic digital payment confirmation safety.
- Organise customer orders and simple records.

**Lessons:**
1. A daily sales and expense notebook.
2. Payment confirmation: check the transaction in the trusted app/account; never share a PIN or OTP.
3. Organising orders and customer details while collecting only what is needed.

### Course 3 — Customer Communication

**Learning outcomes:**
- Introduce a product or service clearly.
- Ask a customer what they need before recommending something.
- Respond politely to common questions and practise a short conversation.

**Lessons:**
1. A clear and honest product introduction.
2. Listening and asking useful questions.
3. Responding to questions, uncertainty and objections respectfully.

## 2. Content integrity requirements

- Store each course, lesson, concept, example, practice prompt and rubric as structured content. Do not place the whole curriculum in one prompt blob.
- Tamil is the primary language for the first course. Provide English support where the selected voice configuration supports it. Do not claim fluent code-mixing until tested with actual speakers.
- Clearly distinguish team-authored content from material reviewed by a domain mentor. Do not label content certified, accredited or expert-reviewed without evidence.
- Use simple examples but do not make unsupported business, legal, tax, financial or employment promises.
- Mark any lesson that needs specialist review before wider deployment.

## 3. Product journey acceptance

A real learner must be able to:
1. Discover the service and understand that the voice companion is AI.
2. Choose a supported language and understand what learning information may be stored.
3. Grant or decline durable memory consent.
4. Explain a learning goal in natural language.
5. Choose a suitable course or ask for a recommendation.
6. Start a voice learning session on a channel that is actually configured.
7. Ask for clarification or a different explanation without being forced through a rigid script.
8. Complete a practice activity and receive feedback against a lesson-specific rubric.
9. Pause or end the session and save a checkpoint when consent permits.
10. Return in a later session and resume accurately, or choose to review/change the goal.
11. Inspect, correct or delete retained learner information.

## 4. Agent behaviour acceptance

- It asks one question at a time and does not interrogate the learner with a long intake form.
- It explains that it is an AI and never impersonates a human teacher.
- It adapts the explanation when the learner says they do not understand; it does not repeat the same sentence verbatim.
- It gives supportive, accurate feedback and does not praise incorrect answers as correct.
- It uses course material as the source of truth and admits when the course does not cover a question.
- It can handle interruptions, requests to slow down/repeat, pauses and a change of goal.
- It never claims memory was saved unless the persistence tool confirms success.
- It does not store durable memory when consent is declined or revoked.

## 5. Operational acceptance tests

- New learner onboarding and consent flow.
- Existing learner resolution through trusted identity.
- Goal creation and confirmation.
- Course selection and enrolment.
- Lesson retrieval from structured course content.
- Alternate explanation and learner interruption.
- Correct, partially correct and incorrect practice answers.
- Checkpoint persistence and idempotent retry.
- A separate second session resumes the correct goal, course, lesson and next action.
- Consent declined, consent revoked and learner-data deletion.
- Tool authentication failure, malformed payload, timeout and duplicate webhook.
- Voice-provider unavailable or microphone permission denied.
- Phone channel disabled until a real inbound call and a second-call resume test pass.

## 6. Operational dashboard requirements

The staff workspace should show only real database-backed records:
- Course catalogue and content-review status.
- Learner list with privacy-minimised identifiers.
- Goals and enrolments.
- Progress and recent sessions.
- Practice outcomes and checkpoints.
- Tool execution traces with redacted identifiers and errors.

Do not seed fake learner analytics or invented performance metrics into a production workspace. Clearly labelled local fixtures may be used in automated tests and development only.
