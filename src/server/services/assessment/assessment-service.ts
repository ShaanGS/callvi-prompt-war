import type { Criterion, Exercise } from "@/content/schema";
import type { LanguageCode } from "@/lib/languages";
import type { PracticeResult } from "../../domain/types";
import { affirmativeText, hasNegation, interpretNumericAnswer } from "./interpretation";
import { countWords, normaliseAnswer, termMatches } from "./text";

/**
 * AssessmentService — evaluates a learner's practice answer against the
 * lesson's explicit rubric. Deterministic and grounded: the result depends
 * only on the rubric's criteria, never on encouragement. Answers the rubric
 * cannot judge are "ungraded" rather than guessed.
 */

export interface AssessmentOutcome {
  result: PracticeResult;
  /** Fraction of criteria met (0..1); null when ungraded. */
  score: number | null;
  /** Learner-facing feedback, in the requested language, grounded in the rubric. */
  feedback: string;
  metCriteria: string[];
  missedCriteria: string[];
  /** Explanation of a recognised common mistake, if one was detected. */
  mistakeExplanation: string | null;
  /** A hint for a retry (first unsuccessful attempt). */
  hint: string | null;
  /** The example answer, revealed after repeated unsuccessful attempts or when ungraded. */
  modelAnswer: string | null;
  rubricVersion: number;
  clarification: string | null;
}

/** Answers shorter than this, matching no criterion, are too thin to treat as open-ended. */
const SUBSTANTIVE_WORDS = 4;

export interface AssessInput {
  exercise: Exercise;
  answerText: string;
  language: LanguageCode;
  /** 1-based number of this attempt at the exercise for the learner. */
  attemptNumber: number;
}

function evaluateCriterion(criterion: Criterion, normalised: string, numbers: number[], original: string) {
  if (criterion.kind === "numeric") {
    const met = numbers.some((n) => Math.abs(n - criterion.expected) <= criterion.tolerance);
    const mistake = met
      ? undefined
      : criterion.commonMistakes.find((m) => numbers.some((n) => Math.abs(n - m.value) <= criterion.tolerance));
    return { met, evaluable: numbers.length > 0, mistake };
  }
  const allTerms = [...criterion.terms["en-IN"], ...criterion.terms["ta-IN"]];
  const matches = allTerms.filter((t) => termMatches(affirmativeText(original), t) || (criterion.acceptsNegation && hasNegation(t) && termMatches(normalised, t))).length;
  return { met: matches >= criterion.minMatches, evaluable: true, mistake: undefined };
}

export function assessAnswer(input: AssessInput): AssessmentOutcome {
  const { exercise, language } = input;
  const rubric = exercise.rubric;
  const normalised = normaliseAnswer(input.answerText);
  const numeric = interpretNumericAnswer(input.answerText);
  const numbers = numeric.value === null ? [] : [numeric.value];

  const evaluations = rubric.criteria.map((c) => ({ criterion: c, ...evaluateCriterion(c, normalised, numbers, input.answerText) }));
  const met = evaluations.filter((e) => e.met).map((e) => e.criterion);
  const missed = evaluations.filter((e) => !e.met).map((e) => e.criterion);
  const mistake = evaluations.find((e) => e.mistake)?.mistake ?? null;

  const numericCriteria = evaluations.filter((e) => e.criterion.kind === "numeric");
  const numericUnheard = numericCriteria.length > 0 && numericCriteria.every((e) => !e.evaluable);
  const allRequiredMet = rubric.requiredForCorrect.every((id) => met.some((c) => c.id === id));

  let result: PracticeResult;
  if (normalised.length === 0) {
    result = "ungraded";
  } else if (allRequiredMet) {
    result = "correct";
  } else if (numericUnheard && met.length === 0) {
    // A calculation answer with no number in it cannot be judged.
    result = "ungraded";
  } else if (met.length > 0) {
    result = "partial";
  } else if (rubric.mode === "open" && countWords(input.answerText) >= SUBSTANTIVE_WORDS) {
    // Open-ended answer the criteria can't recognise: don't mark it wrong.
    result = "ungraded";
  } else {
    result = "needs_practice";
  }

  const score = result === "ungraded" ? null : Math.round((met.length / rubric.criteria.length) * 100) / 100;

  const clarification = numericUnheard ? (language === "ta-IN" ? "கடைசியா ஒரு பாக்கெட்டுக்கு எவ்வளவு ரூபான்னு நினைக்கிறீங்க? அந்த தொகையை மட்டும் சொல்லுங்க." : "What is your final amount for one item? Please say just that amount.") : null;
  const parts: string[] = [clarification ?? rubric.feedback[result][language]];
  const mistakeExplanation = mistake ? mistake.explanation[language] : null;
  if (mistakeExplanation && result !== "correct") parts.push(mistakeExplanation);

  if (result === "partial" && missed.length > 0) {
    const label = language === "ta-IN" ? "இன்னும் சேர்க்க வேண்டியது" : "Still to include";
    parts.push(`${label}: ${missed.map((c) => c.description[language]).join("; ")}.`);
  }
  if (result === "ungraded" && rubric.mode === "open") {
    const label = language === "ta-IN" ? "சரிபார்க்க வேண்டியவை" : "Check that your answer covers";
    parts.push(`${label}: ${rubric.criteria.map((c) => c.description[language]).join("; ")}.`);
  }

  const unsuccessful = result !== "correct";
  const hintIndex = Math.min(Math.max(input.attemptNumber - 1, 0), exercise.hints.length - 1);
  const hint = !clarification && unsuccessful && input.attemptNumber <= exercise.hints.length ? exercise.hints[hintIndex][language] : null;
  const revealModel = !clarification && ((unsuccessful && input.attemptNumber >= 2) || (result === "ungraded" && rubric.mode === "open"));
  const modelAnswer = revealModel ? exercise.modelAnswer[language] : null;

  return {
    result,
    score,
    feedback: parts.join(" ").slice(0, 1400),
    metCriteria: met.map((c) => c.id),
    missedCriteria: missed.map((c) => c.id),
    mistakeExplanation,
    hint,
    modelAnswer,
    rubricVersion: rubric.version,
    clarification,
  };
}
