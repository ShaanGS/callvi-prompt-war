import { clsx } from "clsx";
import type { ReactNode } from "react";

/** Plain, dense data table for the staff workspace. Scrolls horizontally on small screens. */
export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, numeric }: { children: ReactNode; className?: string; numeric?: boolean }) {
  return (
    <th scope="col" className={clsx("border-b border-line bg-sunken px-3 py-2 text-xs font-semibold text-subtle", numeric && "text-right", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, numeric }: { children: ReactNode; className?: string; numeric?: boolean }) {
  return <td className={clsx("border-b border-line px-3 py-2.5 align-top text-ink", numeric && "text-right tabular-nums", className)}>{children}</td>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}

export function formatStaffDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(date);
}
