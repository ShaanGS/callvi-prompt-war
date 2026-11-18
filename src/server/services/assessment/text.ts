/**
 * Text normalisation for rubric matching. Handles Tamil and English answers
 * as transcribed by speech recognition or typed by the learner.
 */
export function normaliseAnswer(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[“”"(),;:!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ASCII_TERM = /^[a-z0-9 -]+$/;

/**
 * Match one rubric term against a normalised answer.
 * - Tamil (non-ASCII) terms are stems: substring match, which tolerates suffixes.
 * - Short ASCII terms (≤3 letters) must match a whole word ("for", "who").
 * - Longer ASCII terms match at a word start, so "famil" matches "family".
 */
export function termMatches(normalisedAnswer: string, term: string): boolean {
  const t = normaliseAnswer(term);
  if (t.length === 0) return false;
  if (!ASCII_TERM.test(t)) return normalisedAnswer.includes(t);
  // ASCII_TERM guarantees only [a-z0-9 -], none of which are regex metacharacters here.
  const pattern = t.length <= 3 ? new RegExp(`(^|[^a-z0-9])${t}($|[^a-z0-9])`) : new RegExp(`(^|[^a-z0-9])${t}`);
  return pattern.test(normalisedAnswer);
}

export function countWords(text: string): number {
  return normaliseAnswer(text).split(" ").filter((w) => w.length > 0).length;
}
