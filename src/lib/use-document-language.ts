"use client";

import { useEffect } from "react";
import type { LanguageCode } from "@/lib/languages";

/**
 * Keeps `<html lang>` and the tab title in step with the language a learner
 * picks in the standalone preview.
 *
 * The static build ships one `index.html` with `lang="en"`, and the toggle
 * changes the language inside the page without a navigation. Without this, a
 * screen reader keeps pronouncing Tamil text with English rules, and the tab
 * still reads in English. The Next app sets `lang` on the server per request,
 * so callers there pass `enabled: false` rather than fight the layout.
 */
export function useDocumentLanguage(language: LanguageCode, title: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    document.documentElement.lang = language === "ta-IN" ? "ta" : "en";
    document.title = title;
  }, [enabled, language, title]);
}
