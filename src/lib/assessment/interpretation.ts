import { extractNumbers } from "./numbers";
import { normaliseAnswer } from "./text";

// Deliberately bounded interpretation, not a general semantic grader. When
// several answers remain possible we ask again rather than choose the rubric's
// expected number. Keep punctuation until after clause/answer selection.
const NEGATION = /\b(?:not|never|cannot|cant|dont|doesnt|wont|isnt|no longer)\b|மாட்ட|முடியாத|முடியல|இல்லை|இல்லங்க|இல்லன்னு|வேண்டாம்|கிடையா/u;

export function hasNegation(text: string): boolean {
  return NEGATION.test(normaliseAnswer(text));
}

export function affirmativeText(text: string, preserveNumbers = false): string {
  return text.split(/(?<!\d)[.!;?]|[.!;?](?!\d)|\b(?:but|however)\b|ஆனா(?:ல்)?/iu)
    .filter((clause) => !hasNegation(clause))
    .map((clause) => preserveNumbers ? clause : normaliseAnswer(clause)).join(" ");
}

export function interpretNumericAnswer(text: string): { value: number | null; reason: string | null } {
  let answer = text.normalize("NFC").toLowerCase().replace(/[’']/g, "");
  if (/\b(?:or|maybe|perhaps|minus|negative)\b|அல்லது|இருக்கலாம்|மைனஸ்|மினஸ்|(?:^|\s)[−-]\s*\d|\?/u.test(answer)) {
    return { value: null, reason: "ambiguous_or_unsupported_number" };
  }
  // Explicit answer/equality wins over numbers quoted from the question.
  const segments = answer.split(/\b(?:my answer is|the answer is|answer is|actually|i mean|equals|equal to|so)\b|என் பதில்|பதில் என்னன்னா|அதனால|ஆகவே|வகுத்தா(?:ல்)?|=/u);
  if (segments.length > 1) answer = segments.at(-1)!;
  answer = answer.split(/\b(?:because|since)\b|ஏன்னா|ஏனென்றால்/u)[0];
  answer = affirmativeText(answer, true);
  // A denominator is not a proposed answer: "12 rupees for one packet".
  answer = answer.replace(/\b(?:for|per)\s+(?:one|1)\b(?:\s+(?:packet|piece|item))?/g, " ")
    .replace(/(?:ஒரு|ஒவ்வொரு|1)\s*(?:பாக்கெட்|பேக்கெட்|packet|பொருள்|துண்டு|முறுக்கு)[\p{L}\p{M}]*/gu, " ");
  const numbers = extractNumbers(answer);
  return numbers.length === 1
    ? { value: numbers[0], reason: null }
    : { value: null, reason: numbers.length ? "multiple_possible_answers" : "number_not_understood" };
}
