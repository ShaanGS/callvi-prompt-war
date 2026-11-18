import type { Metadata } from "next";
import { Check, Circle, CircleDashed, CircleDot } from "lucide-react";
import { fmt, formatDate } from "@/lib/i18n";
import { requireLearnerPage } from "@/server/auth/actor";
import { getPageContext } from "@/server/auth/page-context";
import { getDb } from "@/server/db/client";
import { enrollmentViews, historyView } from "@/server/services/views";
import { Container, EmptyState, Meter, Notice, PageHeader, Section, Tag } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const learner = await requireLearnerPage("/progress");
  const { t, language } = await getPageContext();
  const db = await getDb();
  const [enrollments, history] = await Promise.all([enrollmentViews(db, learner, language), historyView(db, learner, language)]);
  const durable = learner.consentStatus === "granted";
  const p = t.progress;

  return (
    <Container className="flex flex-col gap-12 py-10">
      <PageHeader title={p.title} lead={p.lead} />
      {!durable ? <Notice tone="info">{p.sessionOnly}</Notice> : null}

      <Section title={p.courses} id="courses">
        {enrollments.length === 0 ? (
          <EmptyState title={p.noCourses} />
        ) : (
          <div className="flex flex-col gap-10">
            {enrollments.map((e) => (
              <article key={e.id} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold">{e.course.title}</h3>
                    {e.status === "completed" ? <Tag tone="success">{t.home.completed}</Tag> : null}
                  </div>
                  <Meter className="w-full sm:w-64" value={e.completedConcepts} max={e.totalConcepts} label={fmt(t.common.ideasDone, { done: e.completedConcepts, total: e.totalConcepts })} />
                </div>
                <ol className="flex flex-col divide-y divide-line border-y border-line">
                  {e.lessons.map((l) => (
                    <li key={l.id} className="grid gap-3 py-4 md:grid-cols-[16rem_1fr]">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm text-accent">{String(l.sequence).padStart(2, "0")}</span>
                        <span className="font-medium text-ink">{l.title}</span>
                      </div>
                      <ul className="flex flex-wrap gap-x-5 gap-y-2">
                        {l.concepts.map((cpt) => {
                          const signal = e.evidence.find((item) => item.concept_id === cpt.id);
                          return <li key={cpt.id} className="flex items-center gap-1.5 text-sm">
                            <StateIcon state={cpt.state} />
                            <span className="text-ink">{cpt.title}</span>
                            <span className="text-subtle">· {signal ? p.evidence[signal.status] : t.room.state[cpt.state]}</span>
                          </li>;
                        })}
                      </ul>
                    </li>
                  ))}
                </ol>
                {e.lastCheckpoint ? (
                  <p className="max-w-prose text-sm text-muted">
                    <span className="font-medium text-ink">
                      {p.lastCheckpoint} · {formatDate(e.lastCheckpoint.at, language)}:
                    </span>{" "}
                    {e.lastCheckpoint.summary}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title={p.sessions} id="sessions">
        {history.sessions.length === 0 ? (
          <EmptyState title={p.noSessions} />
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {history.sessions.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium text-ink">{formatDate(s.startedAt, language, true)}</span>
                  <span className="text-muted">{p.channel[s.channel]}</span>
                  {s.minutes ? <span className="text-subtle">{fmt(p.duration, { n: s.minutes })}</span> : null}
                  <Tag tone={s.status === "failed" ? "danger" : s.status === "completed" ? "neutral" : "info"}>{p.status[s.status]}</Tag>
                  <Tag tone={s.memoryMode === "durable" ? "accent" : "neutral"}>{s.memoryMode === "durable" ? p.savedSession : p.sessionOnlySession}</Tag>
                </div>
                {s.summary ? <p className="max-w-prose text-sm text-muted">{s.summary}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {durable ? (
        <Section title={p.practice} id="practice">
          {history.attempts.length === 0 ? (
            <EmptyState title={p.noPractice} />
          ) : (
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {history.attempts.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Tag tone={a.result === "correct" ? "success" : a.result === "ungraded" ? "info" : "warning"}>{t.room.text.result[a.result]}</Tag>
                    <span className="text-ink">{a.concept}</span>
                    <span className="text-subtle">
                      · {a.lesson} · {formatDate(a.at, language)}
                    </span>
                  </div>
                  {a.prompt ? <p className="text-sm text-muted">{a.prompt}</p> : null}
                  <p className="text-sm">
                    <span className="text-subtle">{p.yourAnswer}: </span>
                    <span className="text-ink">{a.answer}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-subtle">{p.feedback}: </span>
                    <span className="text-muted">{a.feedback}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </Container>
  );
}

function StateIcon({ state }: { state: string }) {
  if (state === "practised" || state === "mastered" || state === "carried_forward") return <Check aria-hidden className="size-4 text-success" />;
  if (state === "practising" || state === "needs_practice") return <CircleDot aria-hidden className="size-4 text-warning" />;
  if (state === "introduced") return <CircleDashed aria-hidden className="size-4 text-accent" />;
  return <Circle aria-hidden className="size-4 text-line-strong" />;
}
