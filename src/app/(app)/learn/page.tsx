import type { Metadata } from "next";
import { Keyboard, Mic, Phone } from "lucide-react";
import { fmt } from "@/lib/i18n";
import { requireOnboardedLearnerPage } from "@/server/auth/actor";
import { getPageContext } from "@/server/auth/page-context";
import { getConfig } from "@/server/config/env";
import { getChannelReadiness } from "@/server/config/channels";
import { getDb } from "@/server/db/client";
import { courseService } from "@/server/services/course-service";
import { startSession } from "@/app/actions/learner";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form-controls";
import { Container, Notice, PageHeader, Tag } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Start a session" };

const KNOWN_ERRORS = ["NOT_CONFIGURED", "RATE_LIMITED", "CONSENT_REQUIRED", "NOT_FOUND"] as const;

export default async function LearnStartPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; error?: string }>;
}) {
  const learner = await requireOnboardedLearnerPage("/learn");
  const { t, language } = await getPageContext();
  const params = await searchParams;
  const db = await getDb();
  const course = params.course ? await courseService.getAvailable(db, params.course).catch(() => null) : null;
  const readiness = getChannelReadiness(getConfig());
  const durable = learner.consentStatus === "granted";
  const l = t.learnStart;
  const errorKey = KNOWN_ERRORS.find((k) => k === params.error);
  const errorText = params.error ? (errorKey ? l.errors[errorKey] : l.errors.generic) : null;

  return (
    <Container width="content" className="flex flex-col gap-8 py-10">
      <PageHeader
        title={l.title}
        lead={
          course ? (
            <>
              <span className="text-subtle">{l.course}: </span>
              <span className="font-medium text-ink">{course.title[language]}</span>
            </>
          ) : (
            l.noCourse
          )
        }
      />
      {errorText ? (
        <Notice tone="danger" role="alert">
          {errorText}
        </Notice>
      ) : null}
      <p className="flex items-center gap-2 text-sm text-muted">
        <Tag tone={durable ? "accent" : "neutral"}>{durable ? t.room.memoryOn : t.room.memoryOff}</Tag>
        {durable ? l.memoryOn : l.memoryOff}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <form
          action={startSession}
          className="flex flex-col justify-between gap-6 rounded-lg border border-line bg-surface p-5"
        >
          <input type="hidden" name="mode" value="voice" />
          {course ? <input type="hidden" name="course_id" value={course.id} /> : null}
          <div className="flex flex-col gap-2">
            <Mic aria-hidden className="size-6 text-accent" />
            <h2 className="text-lg font-semibold">{l.voice}</h2>
            <p className="text-sm text-muted">{readiness.browserVoice.available ? l.voiceBody : l.voiceUnavailable}</p>
          </div>
          <div>
            <SubmitButton
              size="lg"
              pendingLabel={t.common.loading}
              disabled={!readiness.browserVoice.available}
              icon={<Mic aria-hidden className="size-4" />}
            >
              {l.voiceStart}
            </SubmitButton>
          </div>
        </form>

        <form
          action={startSession}
          className="flex flex-col justify-between gap-6 rounded-lg border border-line bg-surface p-5"
        >
          <input type="hidden" name="mode" value="text" />
          {course ? <input type="hidden" name="course_id" value={course.id} /> : null}
          <div className="flex flex-col gap-2">
            <Keyboard aria-hidden className="size-6 text-accent" />
            <h2 className="text-lg font-semibold">{l.text}</h2>
            <p className="text-sm text-muted">{l.textBody}</p>
          </div>
          <div>
            <SubmitButton
              size="lg"
              variant={readiness.browserVoice.available ? "secondary" : "primary"}
              pendingLabel={t.common.loading}
              icon={<Keyboard aria-hidden className="size-4" />}
            >
              {l.textStart}
            </SubmitButton>
          </div>
        </form>
      </div>

      <div className="flex items-start gap-3 border-t border-line pt-6 text-sm">
        <Phone aria-hidden className="mt-0.5 size-4 text-subtle" />
        {readiness.phone.available && readiness.phone.displayNumber ? (
          <a
            href={`tel:${readiness.phone.displayNumber.replace(/[^\d+]/g, "")}`}
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            {fmt(l.phoneCall, { number: readiness.phone.displayNumber })}
          </a>
        ) : (
          <span className="text-muted">{l.phoneUnavailable}</span>
        )}
      </div>

      {!course ? (
        <div>
          <ButtonLink href="/courses" variant="ghost" size="sm">
            {t.room.chooseCourse}
          </ButtonLink>
        </div>
      ) : null}
    </Container>
  );
}
