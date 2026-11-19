/**
 * Extract numbers from a spoken or typed answer.
 *
 * Supports digits ("12", "₹12", "12.5", "1,200"), English number words up to
 * the thousands ("twelve", "one hundred and twenty") and common Tamil number
 * words up to the hundreds ("பன்னிரண்டு", "நூற்று இருபது"). Tamil coverage is
 * deliberately limited to forms the team has listed; it is documented as a
 * known limitation and should be extended with native-speaker testing.
 */

const EN_UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const EN_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/** Tamil number words (stems), mapped to values. Longer stems are tried first. */
const TA_WORDS: Array<[string, number]> = [
  ["தொள்ளாயிர", 900],
  ["எண்ணூற", 800],
  ["எழுநூற", 700],
  ["அறுநூற", 600],
  ["ஐநூற", 500],
  ["நானூற", 400],
  ["முன்னூற", 300],
  ["இருநூற", 200],
  ["நூத்தி", 100],
  ["நூத்து", 100],
  ["நூற்றி", 100],
  ["நூற்று", 100],
  ["நூறு", 100],
  ["ஆயிர", 1000],
  ["தொண்ணூற்று", 90],
  ["தொண்ணூறு", 90],
  ["எண்பத்து", 80],
  ["எண்பது", 80],
  ["எழுபத்து", 70],
  ["எழுபது", 70],
  ["அறுபத்து", 60],
  ["அறுபது", 60],
  ["ஐம்பத்து", 50],
  ["ஐம்பது", 50],
  ["நாற்பத்து", 40],
  ["நாற்பது", 40],
  ["முப்பத்து", 30],
  ["முப்பது", 30],
  ["இருபத்து", 20],
  ["இருபது", 20],
  ["பத்தொன்பது", 19],
  ["பதினெட்டு", 18],
  ["பதினேழு", 17],
  ["பதினாறு", 16],
  ["பதினைந்து", 15],
  ["பதினான்கு", 14],
  ["பதிமூன்று", 13],
  ["பன்னிரண்டு", 12],
  ["பன்னிரெண்டு", 12],
  ["பன்னெண்டு", 12],
  ["பனிரெண்டு", 12],
  ["பண்ணிரெண்டு", 12],
  ["பதினொன்று", 11],
  ["பத்து", 10],
  ["ஒன்பது", 9],
  ["எட்டு", 8],
  ["ஏழு", 7],
  ["ஆறு", 6],
  ["ஐந்து", 5],
  ["நான்கு", 4],
  ["நாலு", 4],
  ["அஞ்சு", 5],
  ["மூன்று", 3],
  ["மூனு", 3],
  ["இரண்டு", 2],
  ["ரெண்டு", 2],
  ["ஒன்று", 1],
  ["ஒண்ணு", 1],
  ["ஒரு", 1],
];

function digitNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d+)?/g;
  for (const m of text.matchAll(re)) {
    const value = Number(`${m[1].replace(/,/g, "")}${m[2] ?? ""}`);
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

function englishWordNumbers(text: string): number[] {
  const tokens = text
    .toLowerCase()
    .replace(/-/g, " ")
    .split(/[^a-z]+/)
    .filter(Boolean);
  const out: number[] = [];
  let current: number | null = null;
  let total = 0;
  const flush = () => {
    if (current !== null || total > 0) out.push(total + (current ?? 0));
    current = null;
    total = 0;
  };
  for (const tok of tokens) {
    if (tok in EN_UNITS) current = (current ?? 0) + EN_UNITS[tok];
    else if (tok in EN_TENS) current = (current ?? 0) + EN_TENS[tok];
    else if (tok === "hundred") current = (current ?? 1) * 100;
    else if (tok === "thousand") {
      total += (current ?? 1) * 1000;
      current = null;
    } else if (tok === "and" && (current !== null || total > 0)) continue;
    else flush();
  }
  flush();
  return out;
}

function tamilWordNumbers(text: string): number[] {
  const out: Array<{ value: number; tokenIndex: number }> = [];
  for (const [tokenIndex, rawToken] of text.split(/\s+/).entries()) {
    let token = rawToken.replace(/^[^\p{L}\p{M}]+/u, "");
    let value = 0;
    let matchedAny = false;
    // A token may concatenate parts, e.g. "நூற்றிருபது"; consume stems left to right.
    let guard = 0;
    while (token.length > 0 && guard++ < 6) {
      const hit = TA_WORDS.find(([stem]) => token.startsWith(stem));
      if (!hit) break;
      matchedAny = true;
      value = hit[1] >= 100 && value > 0 && value < 10 ? value * hit[1] : value + hit[1];
      token = token.slice(hit[0].length).replace(/^[ிுூெேைொோௌ்]+/, "");
    }
    if (matchedAny) out.push({ value, tokenIndex });
  }
  // Merge adjacent tokens like "நூற்று இருபது" (100 + 20).
  const merged: number[] = [];
  let previousTokenIndex = -2;
  for (const { value: n, tokenIndex } of out) {
    const prev = merged[merged.length - 1];
    const adjacent = tokenIndex === previousTokenIndex + 1;
    if (adjacent && prev !== undefined && prev >= 100 && prev % 100 === 0 && n < 100)
      merged[merged.length - 1] = prev + n;
    else if (adjacent && prev !== undefined && prev >= 10 && prev % 10 === 0 && prev < 100 && n < 10)
      merged[merged.length - 1] = prev + n;
    else merged.push(n);
    previousTokenIndex = tokenIndex;
  }
  return merged;
}

export function extractNumbers(text: string): number[] {
  const normalised = text.replace(/[௦-௯]/g, (digit) => String(digit.charCodeAt(0) - 0x0be6));
  const values = [...digitNumbers(normalised), ...englishWordNumbers(normalised), ...tamilWordNumbers(normalised)];
  return Array.from(new Set(values));
}
