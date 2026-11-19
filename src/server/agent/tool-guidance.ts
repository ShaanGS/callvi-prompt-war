import type { AssessmentOutcome } from "@/lib/assessment/assessment-service";
import type { nextStepAfterAttempt } from "./learning-policy";

/**
 * What the voice agent is told after a teaching tool runs. Kept apart from the
 * handlers so the instructions can be read, reviewed and changed in one place
 * without touching the logic that decides which one applies.
 */

export const NOT_SAVED_SESSION_ONLY =
  "The learner has not granted durable memory, so this is kept for this session only. Do not say it was saved.";

export type PracticeNextStep = ReturnType<typeof nextStepAfterAttempt> | "review_complete";

export function lessonGuidance(opts: {
  request: "current" | "different_explanation" | "repeat" | "move_on" | "review";
  explanationsExhausted: boolean;
  freshReview: boolean;
  helpRequested: boolean;
  lessonAlreadyComplete: boolean;
}): string {
  let guidance =
    "Teach this ONE idea in two or three short spoken sentences, paraphrasing into everyday language without changing the facts. Ask practice.prompt once and wait. Do not also ask check_question: it is an alternative, not another test. Send the learner's first substantive answer to record_practice_attempt before judging it. A request for help or a different explanation is not an answer to assess.";
  if (opts.request === "different_explanation" && opts.explanationsExhausted) {
    guidance =
      "Every prepared explanation for this idea has been used. Ask which part is unclear, or relate the same facts to the learner's own situation, or try the practice question together. Do not invent new facts.";
  } else if (opts.request === "different_explanation") {
    guidance =
      "This is a different teaching approach. Explain it in two short everyday sentences without repeating your previous wording. Then ask practice.prompt once and wait. Do not submit the learner's request for help as an attempt.";
  }
  if (opts.freshReview && !opts.helpRequested)
    guidance =
      "Ask ONLY the fresh practice.prompt and wait. Do not teach, hint, reveal a worked example or supply the answer first. This checks the same useful idea in a new situation. If help is requested, get a different explanation. Assess every answer with record_practice_attempt. Never call this mastery or retention based on one answer.";
  if (opts.lessonAlreadyComplete)
    guidance = `This lesson is already complete; the learner is reviewing it. ${guidance}`;
  return guidance;
}

export function practiceGuidance(outcome: AssessmentOutcome, nextStep: PracticeNextStep, saved: boolean): string {
  return [
    "Share this feedback kindly in your own words. Do not change the result or praise an answer that was not correct. A successful practice is not mastery. When help was provided, recognise the useful step without calling it independent learning.",
    outcome.clarification
      ? "Ask ONLY clarification. Do not give the answer or label it wrong. Keep the same exercise open."
      : "",
    nextStep === "review_complete"
      ? "The review is finished. Name the useful idea she just applied in this new situation, then offer to continue from her saved course position or finish. Do not announce the course complete again."
      : "",
    outcome.result === "partial" || outcome.result === "needs_practice"
      ? "This exercise is STILL OPEN. Call record_practice_attempt for EVERY subsequent substantive answer, INCLUDING a word-for-word repeat of the same answer. An unchanged spoken retry is a NEW attempt, not a request to repeat your hint. Never recycle the previous evaluation or promote this result yourself. For a missing-detail reply, append only the caller's exact new words to their exact earlier answer for this same exercise; do not invent or rewrite either part."
      : "",
    outcome.modelAnswer === null
      ? "Do not supply a completed example answer. On partial, ask for just one missing part; do not make the learner repeat the entire answer."
      : "",
    nextStep === "next_concept"
      ? "When the caller chooses to continue, get_lesson_context request=current opens the next idea. Do not use move_on after a correct answer; the server already advanced the position."
      : "",
    nextStep === "retry" ? "Offer one retry, using the hint if there is one." : "",
    nextStep === "offer_move_on"
      ? "Offer a choice: try once more, hear a different explanation, or move on (get_lesson_context request='move_on')."
      : "",
    nextStep === "self_check" && !outcome.clarification
      ? "The rubric could not judge this answer. Compare it with the example answer together; do not call it right or wrong."
      : "",
    nextStep === "lesson_complete"
      ? "The lesson is complete. Mention the real-world action and ask whether to continue or finish."
      : "",
    saved ? "" : NOT_SAVED_SESSION_ONLY,
  ]
    .filter(Boolean)
    .join(" ");
}
