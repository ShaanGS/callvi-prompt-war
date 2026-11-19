import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { ta } from "@/lib/i18n/ta";
import { fmt, formatDate, getMessages, htmlLang, labelFor } from "@/lib/i18n";
import { voiceCopy } from "@/lib/voice/copy";

/** Every string in a dictionary, keyed by its dotted path. */
function strings(value: unknown, path = ""): Map<string, string> {
  if (typeof value === "string") return new Map([[path, value]]);
  if (typeof value !== "object" || value === null) return new Map();
  return new Map(Object.entries(value).flatMap(([key, child]) => [...strings(child, path ? `${path}.${key}` : key)]));
}

const TAMIL_SCRIPT = /[஀-௿]/;
// Deliberately identical in both languages: the brand, and the word a learner
// types to confirm account deletion (kept in Latin letters so it is unambiguous).
const SAME_IN_BOTH = new Set(["app.name", "privacy.deleteAccountWord"]);

describe("both languages, always", () => {
  for (const [name, english, tamil] of [
    ["interface", en, ta],
    ["voice entry", voiceCopy("en-IN"), voiceCopy("ta-IN")],
  ] as const) {
    it(`every ${name} string has a Tamil translation written in Tamil`, () => {
      const enStrings = strings(english);
      const taStrings = strings(tamil);
      expect([...taStrings.keys()].sort()).toEqual([...enStrings.keys()].sort());
      const untranslated = [...taStrings]
        .filter(([key, value]) => !SAME_IN_BOTH.has(key) && (value.trim() === "" || !TAMIL_SCRIPT.test(value)))
        .map(([key]) => key);
      expect(untranslated).toEqual([]);
    });
  }

  it("serves each learner the dictionary for their language", () => {
    expect(getMessages("en-IN")).toBe(en);
    expect(getMessages("ta-IN")).toBe(ta);
  });

  it("tells screen readers which language the page is in", () => {
    expect(htmlLang("ta-IN")).toBe("ta");
    expect(htmlLang("en-IN")).toBe("en");
  });
});

describe("message formatting", () => {
  it("fills named placeholders and leaves unknown ones visible rather than blank", () => {
    expect(fmt("Lesson {n} of {total}", { n: 2, total: 5 })).toBe("Lesson 2 of 5");
    expect(fmt("Hello {name}", {})).toBe("Hello {name}");
  });

  it("shows dates in India time, so a late-evening session is not dated tomorrow", () => {
    // 20:00 UTC is 01:30 the next day in India.
    expect(formatDate("2026-11-19T20:00:00Z", "en-IN")).toBe("20 Nov 2026");
  });

  it("looks up labels for database values without reaching inherited properties", () => {
    const labels = { granted: "Remembered" };
    expect(labelFor(labels, "granted")).toBe("Remembered");
    expect(labelFor(labels, "unknown_state")).toBe("unknown_state");
    expect(labelFor(labels, "toString", "fallback")).toBe("fallback");
    expect(labelFor(labels, "__proto__", "fallback")).toBe("fallback");
  });
});
