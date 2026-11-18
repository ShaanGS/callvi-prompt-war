import type { Localized } from "@/lib/languages";

/** Build a localized string. English first, Tamil second, for readable source. */
export function L(en: string, ta: string): Localized {
  return { "en-IN": en, "ta-IN": ta };
}

export function terms(en: string[], ta: string[]): { "en-IN": string[]; "ta-IN": string[] } {
  return { "en-IN": en, "ta-IN": ta };
}

/**
 * Default "ungraded" feedback for open-ended practice. The assessment service
 * appends the rubric's criteria so the learner knows what to check for.
 */
export const OPEN_UNGRADED = L(
  "I can't judge this answer automatically, so I have not marked it right or wrong. Compare it with the example answer.",
  "இந்தப் பதிலைத் தானாக மதிப்பிட முடியவில்லை, அதனால் சரி அல்லது தவறு என்று குறிக்கவில்லை. உதாரணப் பதிலுடன் ஒப்பிட்டுப் பாருங்கள்.",
);

/** Default "ungraded" feedback for calculations where no number was heard. */
export const NUMBER_NOT_HEARD = L(
  "I couldn't find a number in that answer. Could you say the amount in rupees?",
  "அந்தப் பதிலில் ஒரு எண்ணைக் கண்டுபிடிக்க முடியவில்லை. தொகையை ரூபாயில் சொல்ல முடியுமா?",
);

export const TEAM_AUTHORED_NOTE = L(
  "Written by the project team. Not yet reviewed by a domain mentor. The Tamil wording also needs review by a native-speaking educator. Educational only: not financial, legal or tax advice.",
  "திட்டக் குழுவால் எழுதப்பட்டது. இன்னும் துறை வழிகாட்டியால் சரிபார்க்கப்படவில்லை. தமிழ்ச் சொற்களும் தமிழ் பேசும் ஒரு கல்வியாளரால் சரிபார்க்கப்பட வேண்டும். கற்றலுக்காக மட்டுமே: நிதி, சட்ட அல்லது வரி ஆலோசனை அல்ல.",
);
