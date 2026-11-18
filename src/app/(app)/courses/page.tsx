import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Layers } from "lucide-react";
import { fmt } from "@/lib/i18n";
import { getPageContext } from "@/server/auth/page-context";
import { getDb } from "@/server/db/client";
import { courseService } from "@/server/services/course-service";
import { enrollmentsRepo } from "@/server/repositories/learning";
import { Container, EmptyState, PageHeader, Tag } from "@/components/ui/primitives";
import { ReviewStatusTag } from "@/components/learner/review-status";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  const { t, language, learner } = await getPageContext();
  const db = await getDb();
  const courses = await courseService.listAvailable(db);
  const enrolled = learner && learner.consentStatus === "granted" ? await enrollmentsRepo.listForLearner(db, learner.id) : [];

  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeader title={t.courses.title} lead={t.courses.lead} />
      {courses.length === 0 ? (
        <EmptyState title={t.courses.empty} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {courses.map((c) => {
            const enrolment = enrolled.find((e) => e.courseId === c.id);
            return (
              <li key={c.id}>
                <Link href={`/courses/${c.id}`} className="group grid gap-4 py-6 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-ink group-hover:text-accent">{c.title[language]}</h2>
                      {enrolment ? <Tag tone="accent">{enrolment.status === "completed" ? t.home.completed : t.courses.enrolled}</Tag> : null}
                    </div>
                    <p className="max-w-prose text-muted">{c.summary[language]}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-sm text-subtle">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers aria-hidden className="size-4" />
                        {fmt(t.common.lessons, { n: c.lessons.length })}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock aria-hidden className="size-4" />
                        {fmt(t.common.minutes, { n: c.estimatedMinutes })}
                      </span>
                      <span>{t.courses.level[c.level]}</span>
                      <ReviewStatusTag status={c.contentReview.status} t={t} />
                    </div>
                    <ul className="flex flex-col gap-1 pt-2 text-sm text-ink">
                      {c.outcomes.slice(0, 3).map((o) => (
                        <li key={o[language]} className="flex gap-2">
                          <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                          {o[language]}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ArrowRight aria-hidden className="hidden size-5 text-subtle group-hover:text-accent md:block" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
