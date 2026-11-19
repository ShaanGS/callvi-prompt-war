"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { ReactNode } from "react";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors",
        active ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-sunken hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

export function BottomNavLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-medium leading-tight",
        active ? "text-accent" : "text-subtle hover:text-ink",
      )}
    >
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
