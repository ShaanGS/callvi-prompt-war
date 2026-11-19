"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
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
import type { Messages } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";
import type { SessionView } from "@/server/services/views";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldError, Label, Meter, Notice, Tag, Textarea } from "@/components/ui/primitives";
import { VoicePanel } from "./voice-panel";
import type { BrowserVoiceConfig } from "@/lib/voice/config";
import {
  callRoomTool,
  closeDataSchema,
  fetchSessionView,
  lessonDataSchema,
  practiceDataSchema,
  RoomApiError,
  type PracticeData,
} from "./room-api";

export interface RoomCopy {
  app: Messages["app"];
  room: Messages["room"];
  common: Messages["common"];
}

type Ended = { saved: boolean; summary: string | null };

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function LearningRoom({
  initialView,
  voice,
  copy,
}: {
  initialView: SessionView;
  voice: BrowserVoiceConfig | null;
  copy: RoomCopy;
}) {
  const { room: r, common: c } = copy;
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "info"; text: string } | null>(null);
  const [practice, setPractice] = useState<{ exerciseId: string; prompt: string } | null>(
    initialView.practice ? { exerciseId: initialView.practice.exerciseId, prompt: initialView.practice.prompt } : null,
  );
  const [practiceOpen, setPracticeOpen] = useState(initialView.practice !== null);
  const [answer, setAnswer] = useState("");
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PracticeData | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState<boolean>(false);
  const [ended, setEnded] = useState<Ended | null>(
    initialView.open
      ? null
      : { saved: initialView.memoryMode === "durable" && initialView.summary !== null, summary: initialView.summary },
  );
  const submitKey = useRef<string | null>(null);
  const loadedOnce = useRef(false);

  const isVoice = view.channel === "browser";
  const durable = view.memoryMode === "durable";

  const run = useCallback(
    async (tool: string, args: Record<string, unknown> = {}, key?: string) => {
      setBusy(tool);
      setError(null);
      try {
        const { response, session } = await callRoomTool(view.id, tool, args, key);
        if (session) setView(session);
        if (!response.ok) {
          setError(fmt(r.toolFailed, { message: response.error.message }));
          return null;
        }
        return response;
      } catch (e) {
        setError(e instanceof RoomApiError ? fmt(r.toolFailed, { message: e.message }) : c.unknownError);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [view.id, r.toolFailed, c.unknownError],
  );

  const loadLesson = useCallback(
    async (request: "current" | "different_explanation" | "repeat" | "move_on") => {
      const response = await run("get_lesson_context", { request });
      if (!response || !response.ok) return;
      const data = lessonDataSchema.safeParse(response.data);
      if (!data.success) return;
      setFeedback(null);
      setAnswer("");
      submitKey.current = null;
      setPractice(
        data.data.practice ? { exerciseId: data.data.practice.exercise_id, prompt: data.data.practice.prompt } : null,
      );
      if (request !== "different_explanation" && request !== "repeat") setPracticeOpen(false);
      if (request === "different_explanation" && data.data.explanation_status.all_used)
        setNotice({ tone: "info", text: r.text.allApproaches });
      else setNotice(null);
    },
    [run, r.text.allApproaches],
  );

  // Text room: introduce the current idea when the room opens.
  useEffect(() => {
    if (loadedOnce.current || isVoice || !initialView.open || !initialView.course) return;
    loadedOnce.current = true;
    void loadLesson("current");
  }, [isVoice, initialView.open, initialView.course, loadLesson]);

  const submitAnswer = async () => {
    if (!practice) return;
    const text = answer.trim();
    if (!text) return;
    if (text.length > 1000) {
      setAnswerError(r.text.answerTooLong);
      return;
    }
    setAnswerError(null);
    // One key per distinct submission: a network retry of the same answer never records twice.
    submitKey.current ??= newKey();
    const response = await run(
      "record_practice_attempt",
      { exercise_id: practice.exerciseId, answer_text: text },
      submitKey.current,
    );
    if (!response || !response.ok) return;
    submitKey.current = null;
    const data = practiceDataSchema.safeParse(response.data);
    if (data.success) {
      setFeedback(data.data);
      setFeedbackSaved(response.saved === true);
    }
  };

  const saveCheckpoint = async () => {
    const response = await run("save_checkpoint", {});
    if (!response || !response.ok) return;
    setNotice({
      tone: response.saved ? "success" : "info",
      text: response.saved ? r.text.checkpointSaved : r.text.checkpointNotSaved,
    });
  };

  const closeSession = useCallback(async () => {
    const response = await run("close_learning_session", { reason: "learner_ended" });
    if (response && response.ok) {
      const data = closeDataSchema.safeParse(response.data);
      setEnded({ saved: response.saved === true, summary: data.success ? (data.data.summary ?? null) : null });
    } else {
      const latest = await fetchSessionView(view.id);
      if (latest && !latest.open) setEnded({ saved: false, summary: latest.summary });
    }
  }, [run, view.id]);

  const endSession = async () => {
    if (!window.confirm(durable ? r.endConfirm : r.endConfirmSessionOnly)) return;
    await closeSession();
  };

  // Voice: keep the lesson panel in sync with what the agent's tools have changed.
  const [voiceActive, setVoiceActive] = useState(false);
  useEffect(() => {
    if (!isVoice || !voiceActive || ended) return;
    const timer = setInterval(async () => {
      // A backgrounded tab cannot see the panel; skip the request until it can.
      if (document.hidden) return;
      const latest = await fetchSessionView(view.id);
      if (latest) setView(latest);
    }, 4000);
    return () => clearInterval(timer);
  }, [isVoice, voiceActive, ended, view.id]);

  if (ended) return <EndedView ended={ended} copy={copy} courseId={view.course?.id ?? null} />;

  const concept = view.concept;
  const lesson = view.lesson;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
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
              <p className="truncate text-xs text-subtle">
                {fmt(c.lessonOf, { n: lesson.sequence, total: lesson.of })}
              </p>
            ) : null}
          </div>
          <span className="hidden sm:block">
            <Tag tone={durable ? "accent" : "neutral"}>{durable ? r.memoryOn : r.memoryOff}</Tag>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={endSession}
            disabled={busy !== null}
            icon={<Square aria-hidden className="size-3.5" />}
          >
            {busy === "close_learning_session" ? r.ending : r.end}
          </Button>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto grid w-full max-w-wide flex-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12 lg:py-10"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <span className="sm:hidden">
            <Tag tone={durable ? "accent" : "neutral"}>{durable ? r.memoryOn : r.memoryOff}</Tag>
          </span>

          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          {notice ? (
            <Notice tone={notice.tone} role="status">
              {notice.text}
            </Notice>
          ) : null}

          {isVoice ? (
            <VoicePanel
              config={voice}
              copy={copy}
              onEnded={closeSession}
              onActiveChange={setVoiceActive}
              courseId={view.course?.id ?? null}
              conceptTitle={concept?.title ?? null}
            />
          ) : null}

          {!view.course ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong p-5">
              <p className="text-ink">{r.noLesson}</p>
              {!isVoice ? (
                <ButtonLink href="/courses" icon={<ArrowRight aria-hidden className="size-4" />}>
                  {r.chooseCourse}
                </ButtonLink>
              ) : null}
            </div>
          ) : null}

          {lesson ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-accent">
                {r.lesson} {lesson.sequence} · {lesson.title}
              </p>
              <p className="text-sm text-muted">{lesson.objective}</p>
            </div>
          ) : null}

          {concept ? (
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

              {!isVoice && view.open ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => loadLesson("different_explanation")}
                    disabled={busy !== null}
                    icon={<RefreshCw aria-hidden className="size-4" />}
                  >
                    {r.text.differently}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => loadLesson("repeat")}
                    disabled={busy !== null}
                    icon={<Repeat2 aria-hidden className="size-4" />}
                  >
                    {r.text.repeat}
                  </Button>
                  {practice && !practiceOpen ? (
                    <Button
                      onClick={() => setPracticeOpen(true)}
                      disabled={busy !== null}
                      icon={<ListChecks aria-hidden className="size-4" />}
                    >
                      {r.text.practise}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ) : null}

          {/* Practice (typed study room) */}
          {!isVoice && practice && practiceOpen ? (
            <section
              aria-labelledby="practice-title"
              className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
            >
              <h2 id="practice-title" className="text-base font-semibold">
                {r.text.practiceTitle}
              </h2>
              <p className="text-ink">{practice.prompt}</p>
              {!feedback ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitAnswer();
                  }}
                >
                  <Label htmlFor="answer">{r.text.answerLabel}</Label>
                  <Textarea
                    id="answer"
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      submitKey.current = null;
                    }}
                    maxLength={1000}
                    required
                    aria-invalid={answerError ? true : undefined}
                  />
                  {answerError ? <FieldError>{answerError}</FieldError> : null}
                  <div>
                    <Button type="submit" disabled={busy !== null || answer.trim() === ""}>
                      {busy === "record_practice_attempt" ? r.text.checking : r.text.submit}
                    </Button>
                  </div>
                </form>
              ) : (
                <FeedbackView
                  feedback={feedback}
                  saved={feedbackSaved}
                  copy={copy}
                  busy={busy !== null}
                  onRetry={() => {
                    setFeedback(null);
                    setAnswer("");
                  }}
                  onDifferent={() => loadLesson("different_explanation")}
                  onMoveOn={() => loadLesson("move_on")}
                  onNext={() => loadLesson("current")}
                />
              )}
            </section>
          ) : null}

          {!isVoice && view.open && view.course ? (
            <div className="border-t border-line pt-4">
              <Button
                variant="ghost"
                onClick={saveCheckpoint}
                disabled={busy !== null}
                icon={<BookmarkCheck aria-hidden className="size-4" />}
              >
                {busy === "save_checkpoint" ? c.saving : r.text.checkpoint}
              </Button>
            </div>
          ) : null}
        </div>

        {/* Lesson outline */}
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
      </main>
    </div>
  );
}

const APPROACHES = ["plain", "everyday_example", "analogy", "step_by_step", "question_led"] as const;
type Approach = (typeof APPROACHES)[number];
function approachKey(value: string): Approach {
  return APPROACHES.find((a) => a === value) ?? "plain";
}

function ConceptIcon({ state }: { state: SessionView["lessonConcepts"][number]["state"] }) {
  if (state === "practised" || state === "mastered" || state === "carried_forward")
    return <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />;
  if (state === "practising" || state === "needs_practice")
    return <CircleDot aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />;
  if (state === "introduced") return <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />;
  return <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-line-strong" />;
}

function FeedbackView({
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

function EndedView({ ended, copy, courseId }: { ended: Ended; copy: RoomCopy; courseId: string | null }) {
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
