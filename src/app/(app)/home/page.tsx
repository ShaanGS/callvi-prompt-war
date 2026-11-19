import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CircleDot, Pencil, Radio } from "lucide-react";
import { fmt, formatDate } from "@/lib/i18n";
import { requireOnboardedLearnerPage } from "@/server/auth/actor";
import { getPageContext } from "@/server/auth/page-context";
import { getDb } from "@/server/db/client";
import { homeView } from "@/server/services/views";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState, Meter, Notice, Section, Tag } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const learner = await requireOnboardedLearnerPage("/home");
  const { t, language } = await getPageContext();
  const view = await homeView(await getDb(), learner, language);
  const durable = learner.consentStatus === "granted";
  const focus = view.focus;

  return (
    <Container className="flex flex-col gap-10 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {learner.displayName ? fmt(t.home.greetingName, { name: learner.displayName }) : t.home.greeting}
        </h1>
      </header>

      {!durable ? (
        <Notice
          tone="info"
          action={
            <Link href="/privacy" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              {t.home.sessionOnlyAction}
            </Link>
          }
        >
          {t.home.sessionOnly}
        </Notice>
      ) : null}

      {view.openSession ? (
        <Notice
          tone="info"
          title={t.home.openSession}
          action={
            <ButtonLink
              href={`/learn/${view.openSession.id}`}
              size="sm"
              icon={<Radio aria-hidden className="size-4" />}
            >
              {t.home.rejoin}
            </ButtonLink>
          }
        />
      ) : null}

      {durable ? (
        <Section
          title={t.home.goalTitle}
          actions={
            <ButtonLink href="/privacy#goal" variant="ghost" size="sm" icon={<Pencil aria-hidden className="size-4" />}>
              {view.goal ? t.home.editGoal : t.home.setGoal}
            </ButtonLink>
          }
        >
          {view.goal ? (
            <p className="max-w-prose border-l-2 border-accent pl-4 text-lg text-ink">{view.goal.text}</p>
          ) : (
            <p className="text-muted">{t.home.noGoal}</p>
          )}
        </Section>
      ) : null}

      {focus ? (
        <section
          aria-labelledby="focus-title"
          className="grid gap-6 rounded-lg border border-line bg-surface p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-end"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p id="focus-title" className="text-sm font-medium text-subtle">
                {focus.status === "completed" ? t.home.completed : t.home.currentTitle}
              </p>
              <h2 className="text-xl font-semibold text-ink">{focus.course.title}</h2>
            </div>
            {focus.currentLesson && focus.status !== "completed" ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-subtle">{t.home.nextUp}</p>
                <p className="text-ink">
                  <span className="text-muted">
                    {fmt(t.common.lessonOf, { n: focus.currentLesson.sequence, total: focus.currentLesson.of })} ·{" "}
                  </span>
                  {focus.currentLesson.title}
                </p>
              </div>
            ) : null}
            {focus.lastCheckpoint ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                  {t.home.lastTime} · {formatDate(focus.lastCheckpoint.at, language)}
                </p>
                <p className="max-w-prose text-sm text-muted">{focus.lastCheckpoint.summary}</p>
              </div>
            ) : null}
            <Meter
              className="max-w-sm"
              value={focus.completedConcepts}
              max={focus.totalConcepts}
              label={fmt(t.common.ideasDone, { done: focus.completedConcepts, total: focus.totalConcepts })}
            />
          </div>
          <ButtonLink
            href={`/learn?course=${focus.course.id}`}
            size="lg"
            icon={<ArrowRight aria-hidden className="size-4" />}
          >
            {t.home.continue}
          </ButtonLink>
        </section>
      ) : (
        <EmptyState
          icon={<BookOpen aria-hidden className="size-6" />}
          title={t.home.noCourse}
          action={
            <ButtonLink href="/courses" icon={<ArrowRight aria-hidden className="size-4" />}>
              {t.home.chooseCourse}
            </ButtonLink>
          }
        />
      )}

      {view.others.length > 0 ? (
        <Section title={t.home.otherCourses}>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {view.others.map((e) => (
              <li key={e.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <CircleDot aria-hidden className="size-4 text-subtle" />
                    {e.course.title}
                    {e.status === "completed" ? <Tag tone="success">{t.home.completed}</Tag> : null}
                  </span>
                  <span className="text-sm text-subtle">
                    {fmt(t.common.ideasDone, { done: e.completedConcepts, total: e.totalConcepts })}
                  </span>
                </div>
                <ButtonLink href={`/learn?course=${e.course.id}`} variant="secondary" size="sm">
                  {t.home.continue}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </Container>
  );
}
