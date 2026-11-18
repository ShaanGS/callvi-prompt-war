import type { LanguageCode } from "@/lib/languages";
import { en, type Messages } from "./en";
import { ta } from "./ta";

export type { Messages };

const DICTIONARIES: Record<LanguageCode, Messages> = { "en-IN": en, "ta-IN": ta };

export function getMessages(language: LanguageCode): Messages {
  return DICTIONARIES[language];
}

/** Replace {name}-style placeholders. Unknown placeholders are left as-is. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** HTML lang attribute value for a learner language. */
export function htmlLang(language: LanguageCode): string {
  return language === "ta-IN" ? "ta" : "en";
}

export function formatDate(date: Date | string, language: LanguageCode, withTime = false): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "Asia/Kolkata",
  }).format(d);
}

/** Look up a label by an untyped key (e.g. a database value), with a fallback. */
export function labelFor(labels: Readonly<Record<string, string>>, key: string, fallback = key): string {
  return Object.prototype.hasOwnProperty.call(labels, key) ? (labels[key] ?? fallback) : fallback;
}
