import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Home, LineChart, LogOut, Mic, ShieldCheck, Wrench } from "lucide-react";
import type { PageContext } from "@/server/auth/page-context";
import { signOut } from "@/app/actions/auth";
import { BottomNavLink, NavLink } from "./nav-link";
import { LanguageSwitch } from "./language-switch";

export function Wordmark({ label }: { label: string }) {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md text-base font-semibold tracking-tight text-ink">
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-accent text-on-accent">
        <Mic className="size-4" />
      </span>
      {label}
    </Link>
  );
}

/**
 * Learner application frame: a quiet top bar on desktop and a bottom
 * navigation bar on mobile (thumb-reachable, five destinations).
 */
export function LearnerShell({ ctx, children }: { ctx: PageContext; children: ReactNode }) {
  const { t, learner, staffRole, language } = ctx;
  const signedIn = learner !== null;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-[2px]">
        <div className="mx-auto flex h-16 w-full max-w-wide items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark label={t.app.name} />
          {signedIn ? (
            <nav aria-label={t.nav.primary} className="hidden items-center gap-1 md:flex">
              <NavLink href="/home">{t.nav.home}</NavLink>
              <NavLink href="/courses">{t.nav.courses}</NavLink>
              <NavLink href="/progress">{t.nav.progress}</NavLink>
              <NavLink href="/privacy">{t.nav.privacy}</NavLink>
              {staffRole ? <NavLink href="/staff">{t.nav.staff}</NavLink> : null}
            </nav>
          ) : null}
          <div className="flex items-center gap-1">
            <LanguageSwitch language={language} t={t} />
            {staffRole ? (
              <form action={signOut} className="hidden md:block">
                <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted hover:bg-sunken hover:text-ink">
                  <LogOut aria-hidden className="size-4" />
                  {t.nav.signOut}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <main id="main" className={signedIn ? "flex-1 pb-24 md:pb-0" : "flex-1"}>
        {children}
      </main>

      {signedIn ? (
        <nav aria-label={t.nav.primary} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="flex">
            <BottomNavLink href="/home" label={t.nav.home} icon={<Home aria-hidden className="size-5" />} />
            <BottomNavLink href="/courses" label={t.nav.courses} icon={<BookOpen aria-hidden className="size-5" />} />
            <BottomNavLink href="/learn" label={t.nav.learn} icon={<Mic aria-hidden className="size-5" />} />
            <BottomNavLink href="/progress" label={t.nav.progress} icon={<LineChart aria-hidden className="size-5" />} />
            <BottomNavLink href="/privacy" label={t.nav.privacy} icon={<ShieldCheck aria-hidden className="size-5" />} />
            {staffRole ? <BottomNavLink href="/staff" label={t.nav.staff} icon={<Wrench aria-hidden className="size-5" />} /> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

/** Mobile-only sign-out, placed at the bottom of the Privacy page. */
export function MobileSignOut({ label }: { label: string }) {
  return (
    <form action={signOut} className="md:hidden">
      <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted hover:bg-sunken hover:text-ink">
        <LogOut aria-hidden className="size-4" />
        {label}
      </button>
    </form>
  );
}
