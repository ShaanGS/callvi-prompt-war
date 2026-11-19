"use client";

import Link from "next/link";

import { clsx } from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  CircleDashed,
  CircleDot,
  Flag,
  Lightbulb,
  ListChecks,
  RefreshCw,
  Repeat2,
  SkipForward,
  Square,
} from "lucide-react";

import { fmt } from "@/lib/i18n";
import type { SessionView } from "@/server/services/views";
import { Button, ButtonLink } from "@/components/ui/button";
import { Meter, Notice, Tag } from "@/components/ui/primitives";

import { type PracticeData } from "./room-api";
import type { Ended, RoomCopy } from "./learning-room";

/** Presentational pieces of the study room. Each takes props only; the room owns all state. */

/** The room's top bar: back, where the learner is, memory mode, and ending the session. */
export function RoomHeader({
  view,
  durable,
  busy,
  onEnd,
  copy,
}: {
  view: SessionView;
  durable: boolean;
  busy: string | null;
  onEnd: () => void;
  copy: RoomCopy;
}) {
  const { room: r, common: c } = copy;
  const lesson = view.lesson;
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas">
      <div className="mx-auto flex h-16 w-full max-w-wide items-center gap-3 px-4 sm:px-6">
        <Link
          href="/home"
          className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink"
          aria-label={c.back}
        >
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-sm font-semibold text-ink">{view.course?.title ?? r.title}</p>
          {lesson ? (
            <p className="truncate text-xs text-subtle">{fmt(c.lessonOf, { n: lesson.sequence, total: lesson.of })}</p>
          ) : null}
        </div>
        <span className="hidden sm:block">
          <Tag tone={durable ? "accent" : "neutral"}>{durable ? r.memoryOn : r.memoryOff}</Tag>
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={onEnd}
          disabled={busy !== null}
          icon={<Square aria-hidden className="size-3.5" />}
        >
          {busy === "close_learning_session" ? r.ending : r.end}
        </Button>
      </div>
    </header>
  );
}

/** The idea being taught: its explanation, key points, check question and the learner's options. */
export function ConceptCard({
  concept,
  isVoice,
  open,
  busy,
  canStartPractice,
  onLoad,
  onStartPractice,
  copy,
}: {
  concept: NonNullable<SessionView["concept"]>;
  isVoice: boolean;
  open: boolean;
  busy: string | null;
  canStartPractice: boolean;
  onLoad: (request: "different_explanation" | "repeat") => void;
  onStartPractice: () => void;
  copy: RoomCopy;
}) {
  const r = copy.room;
  return (
    <article className="flex flex-col gap-5" aria-labelledby="concept-title">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">{r.idea}</p>
        <h1 id="concept-title" className="text-2xl font-semibold tracking-tight text-ink">
          {concept.title}
        </h1>
      </div>

      {!isVoice ? (
        <section aria-label={r.explanation} className="flex flex-col gap-3 border-l-2 border-accent pl-4">
          <p className="text-xs text-subtle">
            {r.approach[approachKey(concept.approach)]} ·{" "}
            {fmt(r.approachCount, {
              used: Math.max(1, concept.approachesUsed),
              total: concept.approachesTotal,
            })}
          </p>
          <p className="text-lg leading-relaxed text-ink">{concept.explanation}</p>
        </section>
      ) : null}

      <section aria-labelledby="key-points" className="flex flex-col gap-2">
        <h2 id="key-points" className="text-sm font-semibold text-ink">
          {r.keyPoints}
        </h2>
        <ul className="flex flex-col gap-2">
          {concept.keyPoints.map((k) => (
            <li key={k} className="flex gap-2 text-ink">
              <Check aria-hidden className="mt-1 size-4 shrink-0 text-accent" />
              {k}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-3 rounded-md bg-sunken px-4 py-3">
        <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-subtle">{r.check}</p>
          <p className="text-ink">{concept.checkQuestion}</p>
        </div>
      </div>

      {!isVoice && open ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => onLoad("different_explanation")}
            disabled={busy !== null}
            icon={<RefreshCw aria-hidden className="size-4" />}
          >
            {r.text.differently}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onLoad("repeat")}
            disabled={busy !== null}
            icon={<Repeat2 aria-hidden className="size-4" />}
          >
            {r.text.repeat}
          </Button>
          {canStartPractice ? (
            <Button
              onClick={onStartPractice}
              disabled={busy !== null}
              icon={<ListChecks aria-hidden className="size-4" />}
            >
              {r.text.practise}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** The side panel: the ideas in this lesson, course progress, review notes and the real-world action. */
export function LessonOutline({ view, copy }: { view: SessionView; copy: RoomCopy }) {
  const { room: r, common: c } = copy;
  const concept = view.concept;
  const lesson = view.lesson;
  return (
    <aside className="flex flex-col gap-6 lg:border-l lg:border-line lg:pl-8">
      {view.lessonConcepts.length > 0 ? (
        <section aria-labelledby="ideas-title" className="flex flex-col gap-3">
          <h2 id="ideas-title" className="text-sm font-semibold text-ink">
            {r.ideasInLesson}
          </h2>
          <ol className="flex flex-col gap-1">
            {view.lessonConcepts.map((lc) => (
              <li
                key={lc.id}
                className={clsx(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                  lc.id === concept?.id ? "bg-accent-soft text-accent-ink" : "text-ink",
                )}
                aria-current={lc.id === concept?.id ? "step" : undefined}
              >
                <ConceptIcon state={lc.state} />
                <span className="flex flex-col">
                  <span>{lc.title}</span>
                  <span className="text-xs text-subtle">{r.state[lc.state]}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {view.course && view.courseProgress.totalConcepts > 0 ? (
        <Meter
          value={view.courseProgress.completedConcepts}
          max={view.courseProgress.totalConcepts}
          label={fmt(c.ideasDone, {
            done: view.courseProgress.completedConcepts,
            total: view.courseProgress.totalConcepts,
          })}
        />
      ) : null}

      {lesson && lesson.reviewNotes.length > 0 ? (
        <div className="flex flex-col gap-2">
          {lesson.reviewNotes.map((n) => (
            <p key={n} className="flex gap-2 text-sm text-warning">
              <Flag aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">{r.reviewNotes}:</span> {n}
              </span>
            </p>
          ))}
        </div>
      ) : null}

      {lesson ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">{r.realWorld}</p>
          <p className="text-sm text-muted">{lesson.realWorldAction}</p>
        </div>
      ) : null}
    </aside>
  );
}

export const APPROACHES = ["plain", "everyday_example", "analogy", "step_by_step", "question_led"] as const;
type Approach = (typeof APPROACHES)[number];
export function approachKey(value: string): Approach {
  return APPROACHES.find((a) => a === value) ?? "plain";
}

export function ConceptIcon({ state }: { state: SessionView["lessonConcepts"][number]["state"] }) {
  if (state === "practised" || state === "mastered" || state === "carried_forward")
    return <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />;
  if (state === "practising" || state === "needs_practice")
    return <CircleDot aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />;
  if (state === "introduced") return <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />;
  return <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-line-strong" />;
}

export function FeedbackView({
  feedback,
  saved,
  copy,
  busy,
  onRetry,
  onDifferent,
  onMoveOn,
  onNext,
}: {
  feedback: PracticeData;
  saved: boolean;
  copy: RoomCopy;
  busy: boolean;
  onRetry: () => void;
  onDifferent: () => void;
  onMoveOn: () => void;
  onNext: () => void;
}) {
  const t = copy.room.text;
  const tone = feedback.result === "correct" ? "success" : feedback.result === "ungraded" ? "info" : "warning";
  const correct = feedback.result === "correct";
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={tone}>{t.result[feedback.result]}</Tag>
        <span className="text-xs text-subtle">{saved ? t.savedNote : t.notSavedNote}</span>
      </div>
      <p className="text-ink">{feedback.feedback}</p>
      {feedback.met.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-subtle">{t.whatWorked}</p>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {feedback.met.map((m) => (
              <li key={m} className="flex gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {feedback.missing.length > 0 && !correct ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-subtle">{t.whatsMissing}</p>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {feedback.missing.map((m) => (
              <li key={m} className="flex gap-2">
                <ChevronDown aria-hidden className="mt-0.5 size-4 shrink-0 -rotate-90 text-subtle" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {feedback.hint && !correct ? (
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{t.hint}:</span> {feedback.hint}
        </p>
      ) : null}
      {feedback.model_answer ? (
        <div className="rounded-md bg-sunken px-4 py-3">
          <p className="text-xs font-medium text-subtle">{t.modelAnswer}</p>
          <p className="text-sm text-ink">{feedback.model_answer}</p>
        </div>
      ) : null}
      {feedback.lesson_complete ? (
        <Notice tone="success" title={t.lessonComplete}>
          {feedback.real_world_action}
        </Notice>
      ) : null}
      {feedback.course_complete ? <Notice tone="success">{t.courseComplete}</Notice> : null}

      <div className="flex flex-wrap gap-2">
        {correct && !feedback.course_complete ? (
          <Button onClick={onNext} disabled={busy} icon={<ArrowRight aria-hidden className="size-4" />}>
            {feedback.lesson_complete ? t.nextLesson : t.next}
          </Button>
        ) : null}
        {!correct ? (
          <>
            <Button onClick={onRetry} disabled={busy} icon={<Repeat2 aria-hidden className="size-4" />}>
              {t.tryAgain}
            </Button>
            <Button
              variant="secondary"
              onClick={onDifferent}
              disabled={busy}
              icon={<RefreshCw aria-hidden className="size-4" />}
            >
              {t.differently}
            </Button>
            <Button
              variant={
                feedback.next_step === "offer_move_on" || feedback.next_step === "self_check" ? "secondary" : "ghost"
              }
              onClick={onMoveOn}
              disabled={busy}
              icon={<SkipForward aria-hidden className="size-4" />}
            >
              {t.moveOn}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function EndedView({ ended, copy, courseId }: { ended: Ended; copy: RoomCopy; courseId: string | null }) {
  const e = copy.room.ended;
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-prose flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{e.title}</h1>
      <Notice tone={ended.saved ? "success" : "info"} role="status">
        {ended.saved ? e.saved : e.notSaved}
      </Notice>
      {ended.summary ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-subtle">{e.summary}</h2>
          <p className="text-ink">{ended.summary}</p>
        </section>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/home">{e.home}</ButtonLink>
        <ButtonLink href="/progress" variant="secondary">
          {e.progress}
        </ButtonLink>
        <ButtonLink href={courseId ? `/learn?course=${courseId}` : "/learn"} variant="ghost">
          {e.again}
        </ButtonLink>
      </div>
    </main>
  );
}
