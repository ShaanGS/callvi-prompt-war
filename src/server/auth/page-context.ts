import "server-only";
import { cache } from "react";
import type { LanguageCode } from "@/lib/languages";
import { getMessages, type Messages } from "@/lib/i18n";
import type { Learner, StaffRole } from "../domain/types";
import { getCurrentLearner, getStaffRole, getUiLanguage } from "./actor";

export interface PageContext {
  learner: Learner | null;
  staffRole: StaffRole | null;
  language: LanguageCode;
  t: Messages;
}

/** Interface language follows the learner's chosen language, else the language cookie. */
export const getPageContext = cache(async (): Promise<PageContext> => {
  const [learner, staffRole, cookieLanguage] = await Promise.all([
    getCurrentLearner(),
    getStaffRole(),
    getUiLanguage(),
  ]);
  const language = learner?.preferredLanguage ?? cookieLanguage;
  return { learner, staffRole, language, t: getMessages(language) };
});
