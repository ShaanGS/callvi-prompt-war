import type { Metadata } from "next";
import { requireStaffPage } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { staffSessions } from "@/server/services/staff-service";
import { PageHeader } from "@/components/ui/primitives";
import { SessionRows } from "./session-rows";

export const metadata: Metadata = { title: "Sessions" };

export default async function StaffSessionsPage() {
  await requireStaffPage();
  const sessions = await staffSessions(await getDb(), { limit: 200 });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Sessions"
        lead="The most recent 200 learning sessions across all channels. Transcripts and audio are not stored."
      />
      <SessionRows sessions={sessions} showLearner />
    </div>
  );
}
