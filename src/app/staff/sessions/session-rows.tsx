import Link from "next/link";
import type { StaffSessionRow } from "@/server/services/staff-service";
import { Tag } from "@/components/ui/primitives";
import { EmptyRow, formatStaffDate, Table, Td, Th } from "@/components/staff/table";

export function SessionRows({ sessions, showLearner }: { sessions: StaffSessionRow[]; showLearner: boolean }) {
  const cols = showLearner ? 10 : 9;
  return (
    <Table caption="Sessions">
      <thead>
        <tr>
          <Th>Started</Th>
          {showLearner ? <Th>Learner</Th> : null}
          <Th>Channel</Th>
          <Th>Status</Th>
          <Th>Memory</Th>
          <Th>Language</Th>
          <Th>End reason</Th>
          <Th numeric>Tool calls</Th>
          <Th numeric>Failures</Th>
          <Th>Checkpoint</Th>
        </tr>
      </thead>
      <tbody>
        {sessions.length === 0 ? <EmptyRow colSpan={cols}>No sessions yet.</EmptyRow> : null}
        {sessions.map((s) => (
          <tr key={s.id}>
            <Td>{formatStaffDate(s.startedAt)}</Td>
            {showLearner ? (
              <Td>
                <Link
                  href={`/staff/learners/${s.learnerId}`}
                  className="font-mono text-accent underline-offset-4 hover:underline"
                >
                  {s.learnerShortId}
                </Link>
              </Td>
            ) : null}
            <Td>
              {s.channel}
              <span className="text-subtle"> · {s.provider}</span>
            </Td>
            <Td>
              <Tag tone={s.status === "failed" ? "danger" : s.status === "completed" ? "neutral" : "info"}>
                {s.status}
              </Tag>
            </Td>
            <Td>{s.memoryMode === "durable" ? "saved" : "session only"}</Td>
            <Td>{s.language}</Td>
            <Td>{s.endReason ?? "—"}</Td>
            <Td numeric>{s.toolCalls}</Td>
            <Td numeric className={s.toolFailures > 0 ? "text-danger" : undefined}>
              {s.toolFailures}
            </Td>
            <Td>{s.hasCheckpoint ? "yes" : "—"}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
