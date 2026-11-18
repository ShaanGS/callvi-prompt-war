/** Languages the product is configured for. Shared by client and server. */
export const SUPPORTED_LANGUAGES = ["ta-IN", "en-IN"] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: LanguageCode = "ta-IN";

/** Sarvam Voice Agents identify languages by name (see SarvamToolLanguageName). */
export const SARVAM_LANGUAGE_NAME: Record<LanguageCode, "Tamil" | "English"> = {
  "ta-IN": "Tamil",
  "en-IN": "English",
};

export const LANGUAGE_LABEL: Record<LanguageCode, { native: string; english: string }> = {
  "ta-IN": { native: "தமிழ்", english: "Tamil" },
  "en-IN": { native: "English", english: "English" },
};

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** A string in every supported language. */
export type Localized = Record<LanguageCode, string>;

export function pick(text: Localized, language: LanguageCode): string {
  return text[language];
}
