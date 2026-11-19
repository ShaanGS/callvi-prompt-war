"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowRight, BookmarkCheck } from "lucide-react";
import type { Messages } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";
import type { SessionView } from "@/server/services/views";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldError, Label, Notice, Tag, Textarea } from "@/components/ui/primitives";
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
import { ConceptCard, EndedView, FeedbackView, LessonOutline, RoomHeader } from "./room-parts";

export interface RoomCopy {
  app: Messages["app"];
  room: Messages["room"];
  common: Messages["common"];
}

export type Ended = { saved: boolean; summary: string | null };

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
      <RoomHeader view={view} durable={durable} busy={busy} onEnd={endSession} copy={copy} />

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
            <ConceptCard
              concept={concept}
              isVoice={isVoice}
              open={view.open}
              busy={busy}
              canStartPractice={practice !== null && !practiceOpen}
              onLoad={(request) => void loadLesson(request)}
              onStartPractice={() => setPracticeOpen(true)}
              copy={copy}
            />
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

        <LessonOutline view={view} copy={copy} />
      </main>
    </div>
  );
}
