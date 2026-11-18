import { Languages } from "lucide-react";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/languages";
import type { Messages } from "@/lib/i18n";
import { Suspense } from "react";
import { setUiLanguage } from "@/app/actions/auth";
import { CurrentPathInput } from "./current-path-input";

/** Two-option language switch. A plain form so it works without JavaScript. */
export function LanguageSwitch({ language, t }: { language: LanguageCode; t: Messages }) {
  const other = SUPPORTED_LANGUAGES.find((l) => l !== language) ?? language;
  return (
    <form action={setUiLanguage}>
      <input type="hidden" name="language" value={other} />
      <Suspense fallback={null}>
        <CurrentPathInput />
      </Suspense>
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted hover:bg-sunken hover:text-ink"
        aria-label={`${t.nav.language}: ${t.languageNames[other]}`}
        lang={other === "ta-IN" ? "ta" : "en"}
      >
        <Languages aria-hidden className="size-4" />
        {other === "ta-IN" ? "தமிழ்" : "English"}
      </button>
    </form>
  );
}
