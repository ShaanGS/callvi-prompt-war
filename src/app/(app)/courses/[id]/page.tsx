import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, Flag, Layers, Target } from "lucide-react";
import { fmt } from "@/lib/i18n";
import { getPageContext } from "@/server/auth/page-context";
import { getDb } from "@/server/db/client";
import { courseService } from "@/server/services/course-service";
import { enrollmentsRepo } from "@/server/repositories/learning";
import { enrolInCourse } from "@/app/actions/learner";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form-controls";
import { Container, Notice, Section } from "@/components/ui/primitives";
import { ReviewStatusTag } from "@/components/learner/review-status";

export const metadata: Metadata = { title: "Course" };

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, language, learner } = await getPageContext();
  const db = await getDb();
  const course = await courseService.getAvailable(db, id).catch(() => null);
  if (!course) notFound();
  const enrolment = learner && learner.consentStatus === "granted" ? await enrollmentsRepo.findLatestForCourse(db, learner.id, course.id) : null;
  const onboarded = learner !== null && learner.consentStatus !== "pending" && learner.onboardingCompletedAt !== null;
  const lessons = [...course.lessons].sort((a, b) => a.sequence - b.sequence);
  const openEnrolment = enrolment !== null && (enrolment.status === "active" || enrolment.status === "paused");

  let primaryAction: React.ReactNode;
  if (!learner || !onboarded) {
    primaryAction = (
      <ButtonLink href="/onboarding" size="lg">
        {t.welcome.start}
      </ButtonLink>
    );
  } else if (openEnrolment) {
    primaryAction = (
      <ButtonLink href={`/learn?course=${course.id}`} size="lg" icon={<ArrowRight aria-hidden className="size-4" />}>
        {t.courses.continue}
      </ButtonLink>
    );
  } else {
    primaryAction = (
      <form action={enrolInCourse}>
        <input type="hidden" name="course_id" value={course.id} />
        <SubmitButton size="lg" pendingLabel={t.common.saving} icon={<ArrowRight aria-hidden className="size-4" />}>
          {learner.consentStatus === "granted" ? t.courses.enrol : t.courses.enrolSessionOnly}
        </SubmitButton>
      </form>
    );
  }

  return (
    <Container className="flex flex-col gap-10 py-10">
      <header className="flex flex-col gap-4 border-b border-line pb-8">
        <ButtonLink href="/courses" variant="ghost" size="sm" className="-ml-3 self-start">
          {t.common.back}
        </ButtonLink>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{course.title[language]}</h1>
        <p className="max-w-prose text-lg text-muted">{course.description[language]}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-subtle">
          <span className="inline-flex items-center gap-1.5">
            <Layers aria-hidden className="size-4" />
            {fmt(t.common.lessons, { n: course.lessons.length })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-4" />
            {fmt(t.common.minutes, { n: course.estimatedMinutes })}
          </span>
          <span>{t.courses.level[course.level]}</span>
          <span>
            {t.courses.languages}: {course.languages.map((l) => (l === "ta-IN" ? "தமிழ்" : "English")).join(", ")}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <ReviewStatusTag status={course.contentReview.status} t={t} />
          </div>
          <p className="max-w-prose text-sm text-subtle">
            {course.contentReview.note[language]} {t.review.notCertified}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">{primaryAction}</div>
        {onboarded && learner.consentStatus !== "granted" ? <Notice tone="info">{t.courses.sessionOnlyNote}</Notice> : null}
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-8">
          <Section title={t.courses.outcomes}>
            <ul className="flex flex-col gap-2">
              {course.outcomes.map((o) => (
                <li key={o[language]} className="flex gap-2 text-ink">
                  <Target aria-hidden className="mt-1 size-4 shrink-0 text-accent" />
                  {o[language]}
                </li>
              ))}
            </ul>
          </Section>
          <Section title={t.courses.audience}>
            <p className="text-muted">{course.audience[language]}</p>
          </Section>
        </div>

        <Section title={t.courses.lessonsTitle}>
          <ol className="flex flex-col divide-y divide-line border-y border-line">
            {lessons.map((l) => (
              <li key={l.id} className="flex flex-col gap-3 py-5">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-accent">{String(l.sequence).padStart(2, "0")}</span>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-ink">{l.title[language]}</h3>
                    <p className="text-sm text-muted">{l.objective[language]}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pl-8">
                  <p className="text-xs font-medium uppercase tracking-wide text-subtle">{t.courses.ideas}</p>
                  <ul className="flex flex-wrap gap-2">
                    {l.concepts.map((c) => (
                      <li key={c.id} className="rounded-sm bg-sunken px-2 py-1 text-sm text-ink">
                        {c.title[language]}
                      </li>
                    ))}
                  </ul>
                  <p className="pt-1 text-sm text-muted">
                    <span className="font-medium text-ink">{t.courses.realWorld}:</span> {l.realWorldAction[language]}
                  </p>
                  {l.reviewFlags.map((f) => (
                    <p key={f[language]} className="flex gap-2 text-sm text-warning">
                      <Flag aria-hidden className="mt-0.5 size-4 shrink-0" />
                      <span>
                        <span className="font-medium">{t.review.lessonFlag}:</span> {f[language]}
                      </span>
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </Container>
  );
}
