import type { ReactNode } from "react";
import { getPageContext } from "@/server/auth/page-context";
import { LearnerShell } from "@/components/learner/shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getPageContext();
  return <LearnerShell ctx={ctx}>{children}</LearnerShell>;
}
