import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, Bot, Check, ShieldCheck, X } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { fmt } from "@/lib/i18n";
import { requireLearnerPage } from "@/server/auth/actor";
import { getPageContext } from "@/server/auth/page-context";
import { SESSION_GOAL_COOKIE } from "@/server/auth/cookies";
import { getDb } from "@/server/db/client";
import { goalsRepo } from "@/server/repositories/learning";
import { courseService } from "@/server/services/course-service";
import { describeRecommendationReason, recommendCourses } from "@/server/services/recommendation-service";
import { chooseConsent, chooseLanguage, confirmGoal, finishOnboarding, saveName, submitGoal } from "@/app/actions/learner";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form-controls";
import { Container, FieldError, FieldHint, Input, Label, Notice, Tag, Textarea } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Getting started" };

const STEPS = ["language", "consent", "name", "goal", "confirm", "courses"] as const;
type Step = (typeof STEPS)[number];

/** Steps shown to the learner (confirm is part of the goal step). */
const VISIBLE: Record<Step, number> = { language: 1, consent: 2, name: 3, goal: 4, confirm: 4, courses: 5 };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string; error?: string; deleted?: string }> }) {
  const learner = await requireLearnerPage("/onboarding");
  const { t } = await getPageContext();
  const params = await searchParams;
  if (!params.step && !params.deleted) redirect("/");
  let step: Step = STEPS.find((s) => s === params.step) ?? "language";
  // A consent decision is required before anything after it.
  if (learner.consentStatus === "pending" && step !== "language" && step !== "consent") step = "consent";

  const db = await getDb();
  const store = await cookies();
  const pendingGoal = store.get(SESSION_GOAL_COOKIE)?.value ?? null;
  const savedGoal = learner.consentStatus === "granted" ? await goalsRepo.findActive(db, learner.id) : null;
  const goalText = savedGoal?.goalText ?? pendingGoal;
  if (step === "confirm" && !pendingGoal) step = "goal";

  const o = t.onboarding;

  return (
    <Container width="prose" className="flex flex-col gap-8 py-10 sm:py-14">
      {params.deleted ? <Notice tone="success" role="status" title={t.privacy.deleted}>{params.deleted === "auth_pending" ? t.privacy.authPending : null}</Notice> : null}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-subtle">{fmt(o.stepOf, { n: VISIBLE[step], total: 5 })}</p>
        <div className="flex gap-1.5" aria-hidden>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`h-1 flex-1 rounded-full ${n <= VISIBLE[step] ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
      </div>

      {step === "language" ? (
        <section className="flex flex-col gap-6" aria-labelledby="step-title">
          <div className="flex flex-col gap-2">
            <h1 id="step-title" className="text-2xl font-semibold tracking-tight">
              {o.language.title}
            </h1>
            <p className="text-muted">{o.language.body}</p>
          </div>
          <form action={chooseLanguage} className="grid gap-3 sm:grid-cols-2">
            {SUPPORTED_LANGUAGES.map((code) => (
              <button
                key={code}
                type="submit"
                name="language"
                value={code}
                lang={code === "ta-IN" ? "ta" : "en"}
                className={`flex h-16 items-center justify-between rounded-lg border px-5 text-left text-lg font-medium transition-colors hover:border-accent ${
                  learner.preferredLanguage === code ? "border-accent bg-accent-soft" : "border-line-strong bg-surface"
                }`}
              >
                {code === "ta-IN" ? "தமிழ்" : "English"}
                {learner.preferredLanguage === code ? <Check aria-hidden className="size-5 text-accent" /> : null}
              </button>
            ))}
          </form>
        </section>
      ) : null}

      {step === "consent" ? (
        <section className="flex flex-col gap-6" aria-labelledby="step-title">
          <h1 id="step-title" className="text-2xl font-semibold tracking-tight">
            {o.consent.title}
          </h1>
          <div className="flex gap-3 rounded-md border border-line bg-surface px-4 py-3">
            <Bot aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
            <p className="text-sm text-ink">{o.consent.disclosure}</p>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{o.consent.question}</h2>
            <p className="text-muted">{o.consent.explain}</p>
            <ul className="flex flex-col gap-2 text-sm text-muted">
              <li className="flex gap-2">
                <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                {o.consent.notSaved}
              </li>
              <li className="flex gap-2">
                <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                {o.consent.control}
              </li>
            </ul>
          </div>
          <form action={chooseConsent} className="flex flex-col gap-3 sm:flex-row">
            <SubmitButton name="decision" value="granted" size="lg" pendingLabel={t.common.saving} icon={<Check aria-hidden className="size-4" />}>
              {o.consent.grant}
            </SubmitButton>
            <SubmitButton name="decision" value="declined" size="lg" variant="secondary" pendingLabel={t.common.saving} icon={<X aria-hidden className="size-4" />}>
              {o.consent.decline}
            </SubmitButton>
          </form>
          <p className="text-sm text-subtle">{o.consent.declineNote}</p>
        </section>
      ) : null}

      {step === "name" ? (
        <section className="flex flex-col gap-6" aria-labelledby="step-title">
          <div className="flex flex-col gap-2">
            <h1 id="step-title" className="text-2xl font-semibold tracking-tight">
              {o.name.title}
            </h1>
            <p className="text-muted">{o.name.body}</p>
          </div>
          {learner.consentStatus !== "granted" ? <Notice tone="info">{o.name.sessionOnly}</Notice> : null}
          <form action={saveName} className="flex flex-col gap-4">
            {learner.consentStatus === "granted" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{o.name.label}</Label>
                <Input id="name" name="name" maxLength={80} autoComplete="given-name" defaultValue={learner.displayName ?? ""} />
              </div>
            ) : null}
            <div className="flex gap-3">
              <SubmitButton pendingLabel={t.common.saving} icon={<ArrowRight aria-hidden className="size-4" />}>
                {t.common.continue}
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {step === "goal" ? (
        <section className="flex flex-col gap-6" aria-labelledby="step-title">
          <div className="flex flex-col gap-2">
            <h1 id="step-title" className="text-2xl font-semibold tracking-tight">
              {o.goal.title}
            </h1>
            <p className="text-muted">{o.goal.body}</p>
          </div>
          <form action={submitGoal} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal">{o.goal.label}</Label>
              <Textarea
                id="goal"
                name="goal"
                required
                minLength={3}
                maxLength={500}
                defaultValue={goalText ?? ""}
                aria-invalid={params.error === "short" ? true : undefined}
                aria-describedby="goal-examples"
              />
              {params.error === "short" ? <FieldError>{o.goal.tooShort}</FieldError> : null}
            </div>
            <div id="goal-examples" className="flex flex-col gap-2">
              <FieldHint>
                <Tag>{o.goal.examplesTitle}</Tag>
              </FieldHint>
              <ul className="flex flex-col gap-1 text-sm text-muted">
                {o.goal.examples.map((ex) => (
                  <li key={ex}>“{ex}”</li>
                ))}
              </ul>
            </div>
            <div>
              <SubmitButton pendingLabel={t.common.saving} icon={<ArrowRight aria-hidden className="size-4" />}>
                {t.common.continue}
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {step === "confirm" && pendingGoal ? (
        <section className="flex flex-col gap-6" aria-labelledby="step-title">
          <h1 id="step-title" className="text-2xl font-semibold tracking-tight">
            {o.goal.confirmTitle}
          </h1>
          <blockquote className="border-l-2 border-accent pl-4 text-lg text-ink">{pendingGoal}</blockquote>
          <div className="flex flex-col gap-3 sm:flex-row">
            <form action={confirmGoal}>
              <SubmitButton size="lg" pendingLabel={t.common.saving} icon={<Check aria-hidden className="size-4" />}>
                {o.goal.confirm}
              </SubmitButton>
            </form>
            <ButtonLink href="/onboarding?step=goal" variant="secondary" size="lg">
              {o.goal.change}
            </ButtonLink>
          </div>
        </section>
      ) : null}

      {step === "courses" ? <CoursesStep goalText={goalText} /> : null}

      {step !== "language" && step !== "courses" ? (
        <div>
          <ButtonLink href={`/onboarding?step=${STEPS[Math.max(0, STEPS.indexOf(step) - 1)]}`} variant="ghost" size="sm">
            {t.common.back}
          </ButtonLink>
        </div>
      ) : null}
    </Container>
  );
}

async function CoursesStep({ goalText }: { goalText: string | null }) {
  const { t, language } = await getPageContext();
  const courses = await courseService.listAvailable(await getDb());
  if (courses.length === 0) redirect("/courses");
  const recs = goalText ? recommendCourses(courses, goalText, 3) : [];
  const list = recs.length > 0 ? recs.map((r) => ({ course: courses.find((c) => c.id === r.courseId), reason: describeRecommendationReason(r, language) })) : courses.map((c) => ({ course: c, reason: null }));
  const o = t.onboarding.courses;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="step-title">
      <div className="flex flex-col gap-2">
        <h1 id="step-title" className="text-2xl font-semibold tracking-tight">
          {o.title}
        </h1>
        <p className="text-muted">{o.body}</p>
      </div>
      {goalText && recs.length === 0 ? <Notice tone="info">{o.noMatch}</Notice> : null}
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {list.map(({ course, reason }) =>
          course ? (
            <li key={course.id} className="flex flex-col gap-3 py-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{course.title[language]}</h2>
                <p className="text-sm text-muted">{course.summary[language]}</p>
                <p className="text-xs text-subtle">
                  {fmt(t.common.lessons, { n: course.lessons.length })} · {fmt(t.common.minutes, { n: course.estimatedMinutes })} · {t.review[course.contentReview.status]}
                </p>
                {reason ? (
                  <p className="pt-1 text-sm text-accent-ink">
                    <span className="font-medium">{o.why}:</span> {reason}
                  </p>
                ) : null}
              </div>
              <form action={finishOnboarding}>
                <input type="hidden" name="course_id" value={course.id} />
                <SubmitButton pendingLabel={t.common.saving} icon={<ArrowRight aria-hidden className="size-4" />}>
                  {o.choose}
                </SubmitButton>
              </form>
            </li>
          ) : null,
        )}
      </ul>
      <form action={finishOnboarding}>
        <SubmitButton variant="ghost" pendingLabel={t.common.loading}>
          {o.browseAll}
        </SubmitButton>
      </form>
    </section>
  );
}
