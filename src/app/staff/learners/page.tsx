import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { staffLearners } from "@/server/services/staff-service";
import { PageHeader, Tag } from "@/components/ui/primitives";
import { EmptyRow, formatStaffDate, Table, Td, Th } from "@/components/staff/table";

export const metadata: Metadata = { title: "Learners" };

export default async function StaffLearnersPage() {
  await requireStaffPage();
  const learners = await staffLearners(await getDb(), 200);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Learners"
        lead="Pseudonymous learner records (most recent 200). Names, emails and phone numbers are not shown here."
      />
      <Table caption="Learners">
        <thead>
          <tr>
            <Th>Learner</Th>
            <Th>Sign-in</Th>
            <Th>Memory</Th>
            <Th>Language</Th>
            <Th numeric>Enrolments</Th>
            <Th numeric>Sessions</Th>
            <Th>Last session</Th>
            <Th>Joined</Th>
          </tr>
        </thead>
        <tbody>
          {learners.length === 0 ? <EmptyRow colSpan={8}>No learners yet.</EmptyRow> : null}
          {learners.map((l) => (
            <tr key={l.id}>
              <Td>
                <Link href={`/staff/learners/${l.id}`} className="font-mono text-accent underline-offset-4 hover:underline">
                  {l.shortId}
                </Link>
              </Td>
              <Td>{l.providers.join(", ") || "—"}</Td>
              <Td>
                <Tag tone={l.consentStatus === "granted" ? "accent" : "neutral"}>{l.consentStatus}</Tag>
              </Td>
              <Td>{l.language}</Td>
              <Td numeric>{l.enrollments}</Td>
              <Td numeric>{l.sessions}</Td>
              <Td>{formatStaffDate(l.lastSessionAt)}</Td>
              <Td>{formatStaffDate(l.createdAt)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
