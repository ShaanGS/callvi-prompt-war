import type { ReactNode } from "react";

/** Focused learning surfaces: no app navigation, so the lesson has the learner's full attention. */
export default function FocusLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
