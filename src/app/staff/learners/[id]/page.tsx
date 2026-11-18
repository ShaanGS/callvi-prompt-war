import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { staffLearnerDetail } from "@/server/services/staff-service";
import { ButtonLink } from "@/components/ui/button";
import { DescriptionList, PageHeader, Section, Tag } from "@/components/ui/primitives";
import { EmptyRow, formatStaffDate, Table, Td, Th } from "@/components/staff/table";
import { SessionRows } from "../../sessions/session-rows";

export const metadata: Metadata = { title: "Learner" };

export default async function StaffLearnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const d = await staffLearnerDetail(await getDb(), id);
  if (!d) notFound();

  return (
    <div className="flex flex-col gap-10">
      <ButtonLink href="/staff/learners" variant="ghost" size="sm" className="-ml-3 self-start">
        Back to learners
      </ButtonLink>
      <PageHeader title={`Learner ${d.shortId}`} lead="Operational view. Practice answer text and transcripts are not shown to staff." />

      <DescriptionList
        items={[
          { term: "Sign-in methods", value: d.providers.join(", ") || "—" },
          { term: "Memory", value: <Tag tone={d.consentStatus === "granted" ? "accent" : "neutral"}>{d.consentStatus}</Tag> },
          { term: "Language", value: d.language },
          { term: "Joined", value: formatStaffDate(d.createdAt) },
          {
            term: "Practice results",
            value: Object.keys(d.practiceByResult).length
              ? Object.entries(d.practiceByResult)
                  .map(([k, n]) => `${k}: ${n}`)
                  .join(" · ")
              : "None",
          },
        ]}
      />

      <Section title="Enrolments">
        <Table caption="Enrolments">
          <thead>
            <tr>
              <Th>Course</Th>
              <Th>Status</Th>
              <Th>Current lesson</Th>
              <Th numeric>Ideas done</Th>
              <Th numeric>Needs practice</Th>
              <Th>Enrolled</Th>
            </tr>
          </thead>
          <tbody>
            {d.enrollments_.length === 0 ? <EmptyRow colSpan={6}>No enrolments.</EmptyRow> : null}
            {d.enrollments_.map((e) => (
              <tr key={`${e.courseId}-${e.enrolledAt.toISOString()}`}>
                <Td className="font-mono text-xs">{e.courseId}</Td>
                <Td>{e.status}</Td>
                <Td className="font-mono text-xs">{e.currentLessonId ?? "—"}</Td>
                <Td numeric>{e.mastered}</Td>
                <Td numeric>{e.needsPractice}</Td>
                <Td>{formatStaffDate(e.enrolledAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="Sessions">
        <SessionRows sessions={d.sessions_} showLearner={false} />
      </Section>

      <Section title="Consent history">
        <Table caption="Consent history">
          <thead>
            <tr>
              <Th>Decision</Th>
              <Th>Channel</Th>
              <Th>Version</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {d.consentHistory.length === 0 ? <EmptyRow colSpan={4}>No consent decisions recorded.</EmptyRow> : null}
            {d.consentHistory.map((c) => (
              <tr key={`${c.at.toISOString()}-${c.decision}`}>
                <Td>{c.decision}</Td>
                <Td>{c.channel}</Td>
                <Td className="font-mono text-xs">{c.version}</Td>
                <Td>{formatStaffDate(c.at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
