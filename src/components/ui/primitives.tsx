import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/* ------------------------------------------------------------------ layout */

export function Container({ width = "content", className, children }: { width?: "prose" | "content" | "wide"; className?: string; children: ReactNode }) {
  const max = width === "prose" ? "max-w-prose" : width === "wide" ? "max-w-wide" : "max-w-content";
  return <div className={clsx("mx-auto w-full px-4 sm:px-6", max, className)}>{children}</div>;
}

export function PageHeader({ title, lead, eyebrow, actions }: { title: string; lead?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        {eyebrow ? <p className="text-sm font-medium text-accent">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {lead ? <p className="max-w-prose text-base text-muted">{lead}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({ title, description, actions, children, className, id }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={clsx("flex flex-col gap-4", className)} aria-labelledby={title && id ? `${id}-title` : undefined} id={id}>
      {title ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {description ? <p className="text-sm text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** A bordered panel. Use sparingly — prefer dividers and whitespace. */
export function Panel({ className, children, as: Tag = "div" }: { className?: string; children: ReactNode; as?: "div" | "article" | "section" | "li" }) {
  return <Tag className={clsx("rounded-lg border border-line bg-surface", className)}>{children}</Tag>;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={clsx("border-0 border-t border-line", className)} />;
}

/* ------------------------------------------------------------------ status */

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const tagTones: Record<Tone, string> = {
  neutral: "bg-sunken text-muted",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Tag({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium", tagTones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const noticeTones: Record<Exclude<Tone, "accent" | "neutral">, { box: string; icon: ReactNode }> = {
  info: { box: "border-info/25 bg-info-soft text-ink", icon: <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" /> },
  success: { box: "border-success/25 bg-success-soft text-ink", icon: <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> },
  warning: { box: "border-warning/25 bg-warning-soft text-ink", icon: <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" /> },
  danger: { box: "border-danger/25 bg-danger-soft text-ink", icon: <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" /> },
};

export function Notice({ tone = "info", title, children, action, role }: { tone?: keyof typeof noticeTones; title?: string; children?: ReactNode; action?: ReactNode; role?: "status" | "alert" }) {
  const t = noticeTones[tone];
  return (
    <div role={role} className={clsx("flex gap-3 rounded-md border px-4 py-3 text-sm", t.box)}>
      {t.icon}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-muted">{children}</div> : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * A progress meter for a real, countable ratio (e.g. ideas completed). Always
 * shows the numbers as text too; never used for estimates.
 */
export function Meter({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-subtle">{label}</p>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong px-5 py-6">
      {icon ? <div className="text-subtle">{icon}</div> : null}
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ink">{title}</p>
        {body ? <p className="text-sm text-muted">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ forms */

export function Label({ className, ...rest }: ComponentProps<"label">) {
  return <label className={clsx("text-sm font-medium text-ink", className)} {...rest} />;
}

const fieldBase =
  "w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-subtle hover:border-subtle focus-visible:border-accent aria-[invalid=true]:border-danger";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={clsx(fieldBase, "h-11", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={clsx(fieldBase, "min-h-28 py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={clsx(fieldBase, "h-11", className)} {...rest} />;
}

export function FieldHint({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="text-sm text-subtle">
      {children}
    </p>
  );
}

export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ data */

export function DescriptionList({ items }: { items: Array<{ term: string; value: ReactNode }> }) {
  return (
    <dl className="divide-y divide-line">
      {items.map((item) => (
        <div key={item.term} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-subtle">{item.term}</dt>
          <dd className="text-sm text-ink sm:col-span-2">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.8125rem] text-muted">{children}</code>;
}
