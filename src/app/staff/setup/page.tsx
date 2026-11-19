import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { getConfig } from "@/server/config/env";
import { getChannelReadiness } from "@/server/config/channels";
import { requireStaffPage } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { agentInstructions, sarvamToolSetup } from "@/server/providers/sarvam/agent-setup";
import { DescriptionList, Notice, PageHeader, Section, Tag } from "@/components/ui/primitives";
import { Table, Td, Th } from "@/components/staff/table";

export const metadata: Metadata = { title: "Setup" };

function Ready({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 aria-hidden className="size-4 text-success" />
      ) : (
        <CircleAlert aria-hidden className="size-4 text-warning" />
      )}
      {label}
    </span>
  );
}

/**
 * Configuration readiness and exact provider setup values, generated from the
 * code (tool registry and agent policy) so the dashboard cannot drift from it.
 * Shows names of missing settings only — never secret values.
 */
export default async function StaffSetupPage() {
  await requireStaffPage();
  const config = getConfig();
  const readiness = getChannelReadiness(config);
  const db = await getDb();
  const baseUrl = config.appUrl ?? "https://<your-deployment>";
  const browserTools = sarvamToolSetup(baseUrl, "browser");

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Setup"
        lead="What is configured on this server, and the exact values to enter in the Sarvam dashboard. See docs/SETUP.md."
      />

      {config.problems.length > 0 ? (
        <Notice tone="warning" title="Configuration items need attention">
          <ul className="list-disc pl-4">
            {config.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <Section title="Readiness">
        <DescriptionList
          items={[
            {
              term: "Database",
              value: (
                <Ready
                  ok={db.kind === "postgres"}
                  label={
                    db.kind === "postgres" ? "Postgres (DATABASE_URL)" : "Embedded local database (development only)"
                  }
                />
              ),
            },
            {
              term: "Learner sign-in",
              value: (
                <Ready
                  ok={config.auth.supabase !== null}
                  label={config.auth.supabase ? "Supabase email code" : "Not configured"}
                />
              ),
            },
            {
              term: "Development sign-in",
              value: config.auth.devAuthEnabled ? (
                <Tag tone="warning">Enabled (development only)</Tag>
              ) : (
                <Tag>Disabled</Tag>
              ),
            },
            {
              term: "Account deletion removes Auth user",
              value: (
                <Ready
                  ok={config.auth.supabaseServiceRoleKey !== undefined}
                  label={config.auth.supabaseServiceRoleKey ? "Yes" : "No — SUPABASE_SERVICE_ROLE_KEY not set"}
                />
              ),
            },
            {
              term: "Browser voice",
              value: (
                <Ready
                  ok={readiness.browserVoice.available}
                  label={
                    readiness.browserVoice.available
                      ? "Configured"
                      : `Missing: ${readiness.browserVoice.missing.join(", ")}`
                  }
                />
              ),
            },
            {
              term: "Phone",
              value: (
                <Ready
                  ok={readiness.phone.available}
                  label={
                    readiness.phone.available
                      ? `Live on ${readiness.phone.displayNumber ?? ""}`
                      : `Not live. Missing: ${readiness.phone.missing.join(", ")}`
                  }
                />
              ),
            },
            {
              term: "Public app URL (APP_URL)",
              value: config.appUrl ? (
                <code className="font-mono text-xs">{config.appUrl}</code>
              ) : (
                "Not set — tool URLs below use a placeholder"
              ),
            },
          ]}
        />
      </Section>

      <Section
        title="Sarvam agent: instructions"
        description="Paste into the agent's instructions. The browser agent and the phone agent are separate agents with separate tool secrets."
      >
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Browser agent instructions</summary>
          <pre className="overflow-x-auto border-t border-line p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
            {agentInstructions("browser")}
          </pre>
        </details>
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Phone agent instructions</summary>
          <pre className="overflow-x-auto border-t border-line p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
            {agentInstructions("phone")}
          </pre>
        </details>
      </Section>

      <Section
        title="Sarvam agent: API tools"
        description="Create one HTTPS API tool per row (POST, JSON body). Authentication: bearer token from a workspace secret holding SARVAM_TOOL_SECRET_BROWSER (browser agent) or SARVAM_TOOL_SECRET_PHONE (phone agent). Insert User Identifier and Interaction ID with the variable picker. Run `npm run sarvam:config` for the full JSON."
      >
        <Table caption="API tools">
          <thead>
            <tr>
              <Th>Tool</Th>
              <Th>When to run</Th>
              <Th>Kind</Th>
              <Th>URL</Th>
              <Th>Body fields</Th>
            </tr>
          </thead>
          <tbody>
            {browserTools.map((tool) => (
              <tr key={tool.name}>
                <Td className="font-mono text-xs">{tool.name}</Td>
                <Td>{tool.whenToRun}</Td>
                <Td>{tool.kind}</Td>
                <Td className="font-mono text-xs break-all">{tool.url}</Td>
                <Td className="font-mono text-xs">{Object.keys(tool.bodyTemplate).join(", ")}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
