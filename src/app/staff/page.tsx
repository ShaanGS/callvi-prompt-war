import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { staffOverview } from "@/server/services/staff-service";
import { PageHeader, Section } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Overview" };

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-line pl-4">
      <dt className="text-sm text-subtle">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString("en-IN")}</dd>
      {note ? <dd className="text-xs text-subtle">{note}</dd> : null}
    </div>
  );
}

export default async function StaffOverviewPage() {
  const o = await staffOverview(await getDb());
  const empty = o.learners.total === 0 && o.sessions.total === 0;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Overview" lead="Live counts from the application database. No estimates or sample data." />

      {empty ? (
        <p className="rounded-lg border border-dashed border-line-strong px-5 py-6 text-muted">
          No learner activity yet. Once learners sign in and start sessions, counts appear here. Check{" "}
          <Link href="/staff/setup" className="font-medium text-accent underline-offset-4 hover:underline">
            Setup
          </Link>{" "}
          to confirm which channels are configured.
        </p>
      ) : null}

      <Section title="Learners">
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Total" value={o.learners.total} />
          <Stat label="Memory on" value={o.learners.consentGranted} />
          <Stat label="Memory declined" value={o.learners.consentDeclined} />
          <Stat label="Memory revoked" value={o.learners.consentRevoked} />
          <Stat label="Not yet chosen" value={o.learners.consentPending} />
        </dl>
      </Section>

      <Section title="Sessions">
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Total" value={o.sessions.total} />
          <Stat label="Last 7 days" value={o.sessions.last7Days} />
          <Stat label="Open now" value={o.sessions.open} />
          <Stat label="Browser voice" value={o.sessions.byChannel.browser ?? 0} />
          <Stat label="Study room" value={o.sessions.byChannel.text ?? 0} />
          <Stat label="Phone" value={o.sessions.byChannel.phone ?? 0} />
          <Stat label="Simulated (evaluation)" value={o.sessions.byChannel.simulated ?? 0} />
        </dl>
      </Section>

      <Section title="Learning">
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Enrolments" value={o.enrollments.total} />
          <Stat label="Courses completed" value={o.enrollments.completed} />
          <Stat label="Practice attempts" value={o.practice.total} />
          <Stat label="Correct" value={o.practice.byResult.correct ?? 0} />
          <Stat label="Partly correct" value={o.practice.byResult.partial ?? 0} />
          <Stat label="Needs practice" value={o.practice.byResult.needs_practice ?? 0} />
          <Stat label="Ungraded (self-check)" value={o.practice.byResult.ungraded ?? 0} />
        </dl>
      </Section>

      <Section title="Operations">
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Tool calls" value={o.tools.total} />
          <Stat label="Tool failures" value={o.tools.failed} />
          <Stat label="Tool calls (24h)" value={o.tools.last24h} />
          <Stat label="Failures (24h)" value={o.tools.failedLast24h} />
          <Stat label="Deletion requests completed" value={o.deletions.total} />
        </dl>
      </Section>
    </div>
  );
}
