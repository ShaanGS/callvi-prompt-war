import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { requireStaffPage } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { staffTraces } from "@/server/services/staff-service";
import { PageHeader, Tag } from "@/components/ui/primitives";
import { EmptyRow, formatStaffDate, Table, Td, Th } from "@/components/staff/table";

export const metadata: Metadata = { title: "Tool traces" };

const FILTERS = ["all", "failed", "rejected", "succeeded"] as const;

export default async function StaffTracesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaffPage();
  const { status } = await searchParams;
  const filter = FILTERS.find((f) => f === status) ?? "all";
  const traces = await staffTraces(await getDb(), { status: filter === "all" ? undefined : filter, limit: 200 });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Tool traces"
        lead="Every learning-tool call, newest first. Arguments are recorded as names and sizes only — never their values."
      />
      <nav aria-label="Filter traces" className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/staff/traces" : `/staff/traces?status=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={clsx(
              "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium",
              filter === f ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-sunken hover:text-ink",
            )}
          >
            {f}
          </Link>
        ))}
      </nav>
      <Table caption="Tool traces">
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Tool</Th>
            <Th>Channel</Th>
            <Th>Result</Th>
            <Th>Error</Th>
            <Th numeric>Latency</Th>
            <Th numeric>Replays</Th>
            <Th>Arguments (redacted)</Th>
          </tr>
        </thead>
        <tbody>
          {traces.length === 0 ? <EmptyRow colSpan={8}>No tool calls recorded{filter === "all" ? "" : ` with status “${filter}”`}.</EmptyRow> : null}
          {traces.map((t) => (
            <tr key={t.id}>
              <Td>{formatStaffDate(t.at)}</Td>
              <Td className="font-mono text-xs">{t.tool}</Td>
              <Td>{t.channel}</Td>
              <Td>
                <Tag tone={t.status === "succeeded" ? "success" : t.status === "failed" ? "danger" : t.status === "rejected" ? "warning" : "info"}>{t.status}</Tag>
              </Td>
              <Td className="font-mono text-xs">{t.errorCode ?? "—"}</Td>
              <Td numeric>{t.latencyMs === null ? "—" : `${t.latencyMs} ms`}</Td>
              <Td numeric>{t.replays}</Td>
              <Td className="max-w-xs font-mono text-xs break-all text-muted">{JSON.stringify(t.argSummary)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
