import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireStaffPage } from "@/server/auth/actor";
import { getConfig } from "@/server/config/env";
import { Wordmark } from "@/components/learner/shell";
import { NavLink } from "@/components/learner/nav-link";
import { Tag } from "@/components/ui/primitives";

export const metadata: Metadata = { title: { default: "Staff", template: "%s · Staff · Callvi" } };

const NAV = [
  { href: "/staff", label: "Overview" },
  { href: "/staff/courses", label: "Courses" },
  { href: "/staff/learners", label: "Learners" },
  { href: "/staff/sessions", label: "Sessions" },
  { href: "/staff/traces", label: "Tool traces" },
  { href: "/staff/setup", label: "Setup" },
];

/**
 * Staff workspace. A left rail is used here (unlike the learner app) because
 * staff move between several dense tables. Access requires a staff role.
 */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const { role, identity } = await requireStaffPage();
  const config = getConfig();
  return (
    <div className="flex min-h-dvh flex-col" lang="en">
      <header className="border-b border-line bg-canvas">
        <div className="mx-auto flex h-16 w-full max-w-wide items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Wordmark label="Callvi" />
            <Tag tone="accent">Staff</Tag>
            {identity.provider === "dev" ? <Tag tone="warning">Development identity</Tag> : null}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">Role: {role}</span>
            <NavLink href="/home">Learner app</NavLink>
          </div>
        </div>
        <nav aria-label="Staff" className="mx-auto flex w-full max-w-wide gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:hidden">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="mx-auto flex w-full max-w-wide flex-1 gap-10 px-4 py-8 sm:px-6">
        <nav aria-label="Staff" className="hidden w-48 shrink-0 flex-col gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href}>
              {n.label}
            </NavLink>
          ))}
          {config.problems.length > 0 ? (
            <p className="mt-6 border-t border-line pt-4 text-xs text-subtle">{config.problems.length} configuration item(s) need attention — see Setup.</p>
          ) : null}
        </nav>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
