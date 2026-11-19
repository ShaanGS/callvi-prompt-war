"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Phone, PhoneOff } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { fmt } from "@/lib/i18n";
import { formatCallDuration, isActivePhase } from "@/lib/voice/voice-state";
import { CallScreen } from "./call-screen";
import type { RoomCopy } from "./learning-room";
import { useSarvamVoice } from "./use-sarvam-voice";
import { useElevenLabsVoice } from "./use-elevenlabs-voice";
import type { BrowserVoiceConfig } from "@/lib/voice/config";

/**
 * Browser voice entry point. Before the call: a single "Call" action. During
 * the call: the full-screen call view, which the learner can minimise to read
 * the lesson while the call continues. Every status comes from the provider
 * SDK or the browser; nothing is simulated.
 */
export function VoicePanel({
  config,
  copy,
  onEnded,
  onActiveChange,
  courseId,
  conceptTitle,
}: {
  config: BrowserVoiceConfig | null;
  copy: RoomCopy;
  onEnded: () => void;
  onActiveChange: (active: boolean) => void;
  courseId: string | null;
  conceptTitle: string | null;
}) {
  const call = copy.room.call;
  const v = copy.room.voice;
  const name = copy.app.name;
  const sarvam = useSarvamVoice(config?.provider === "elevenlabs" ? null : config, onEnded);
  const elevenlabs = useElevenLabsVoice(config?.provider === "elevenlabs" ? config : null, onEnded);
  const { state, start, stop, toggleMute, reset } = config?.provider === "elevenlabs" ? elevenlabs : sarvam;
  const [minimised, setMinimised] = useState(false);
  const active = isActivePhase(state.phase);
  const fallbackHref = courseId ? `/learn?course=${courseId}` : "/learn";

  useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);

  if (!config) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-ink">
          <AlertCircle aria-hidden className="size-4 text-warning" />
          {v.errors.not_configured}
        </p>
        <ButtonLink href={fallbackHref} variant="secondary" size="sm">
          {v.switchToText}
        </ButtonLink>
      </div>
    );
  }

  const callOpen = state.phase !== "idle" && !(minimised && state.phase !== "error");

  return (
    <>
      {state.phase === "idle" ? (
        <section
          aria-label={fmt(call.dialogLabel, { name })}
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-muted sm:max-w-sm">{call.startHint}</p>
          <Button
            size="lg"
            onClick={() => void start()}
            icon={<Phone aria-hidden className="size-4" />}
            className="w-full sm:w-auto"
          >
            {fmt(call.start, { name })}
          </Button>
        </section>
      ) : null}

      {minimised && state.phase !== "idle" && state.phase !== "error" ? (
        <MinimisedCall
          since={active ? state.connectedAt : null}
          name={name}
          callingLabel={state.phase === "ended" ? call.ended : call.calling}
          returnLabel={call.returnToCall}
          endLabel={call.end}
          onReturn={() => setMinimised(false)}
          onEnd={() => void stop()}
        />
      ) : null}

      {callOpen ? (
        <CallScreen
          state={state}
          copy={copy}
          name={name}
          conceptTitle={conceptTitle}
          fallbackHref={fallbackHref}
          onMute={toggleMute}
          onToggleOutput={config.provider === "elevenlabs" ? elevenlabs.toggleOutput : undefined}
          outputMuted={elevenlabs.outputMuted}
          onEnd={() => void stop()}
          onRetry={() => {
            reset();
            void start();
          }}
          onClose={() => {
            setMinimised(false);
            reset();
          }}
          onMinimise={() => setMinimised(true)}
        />
      ) : null}
    </>
  );
}

/** Compact call bar shown above the lesson while the call continues in the background. */
function MinimisedCall({
  since,
  name,
  callingLabel,
  returnLabel,
  endLabel,
  onReturn,
  onEnd,
}: {
  since: number | null;
  name: string;
  callingLabel: string;
  returnLabel: string;
  endLabel: string;
  onReturn: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="sticky top-[4.5rem] z-10 flex items-center gap-2 rounded-lg bg-accent p-2 pl-4 text-on-accent shadow-md">
      <button
        type="button"
        onClick={onReturn}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left text-sm font-medium"
      >
        <Phone aria-hidden className="size-4 shrink-0" />
        <span className="truncate">
          {name} · {since !== null ? <Elapsed since={since} /> : callingLabel}
        </span>
        <span className="ml-auto hidden text-xs opacity-90 sm:inline">{returnLabel}</span>
      </button>
      <button
        type="button"
        onClick={onEnd}
        aria-label={endLabel}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-call-end text-white hover:bg-call-end-hover"
      >
        <PhoneOff aria-hidden className="size-4" />
      </button>
    </div>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{formatCallDuration(now - since)}</span>;
}
